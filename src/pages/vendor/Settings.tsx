import { Link } from "react-router-dom";
import { useRefreshShopSetup } from "@/hooks/useShopSetup";
import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Store, Save, Loader2, Camera, BadgeCheck, 
  ShieldCheck, MapPin, LocateFixed
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { withProfilePrivate } from "@/lib/profilePrivate";
import { VendorLayout } from "@/components/vendor/VendorLayout";
import { PayoutAccountCard } from "@/components/vendor/PayoutAccountCard";
import { ShopBrandingCard } from "@/components/vendor/ShopBrandingCard";
import { ShopTypePicker } from "@/components/vendor/ShopTypePicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { AVATAR_MAX_DIMENSION, compressImage } from "@/lib/compressImage";
import { AddressAutocomplete } from "@/components/address/AddressAutocomplete";


/** How long to wait for a GPS fix inside a shop. */
const GPS_TIMEOUT_MS = 20000;

const settingsSchema = z.object({
  store_name: z.string().min(2, "Store name must be at least 2 characters"),
  store_description: z.string().optional(),
  phone: z.string().trim().refine(
    (v) => /^(234|0)?[789][01]\d{8}$/.test(v.replace(/\D/g, "")),
    "Enter a Nigerian phone number customers and riders can reach, e.g. 0803 123 4567",
  ),
  store_street: z.string().trim().min(3, "Enter your shop's street address"),
  store_city: z.string().trim().min(2, "Enter your town or city"),
  store_state: z.string().min(2, "Choose your state"),
});

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function VendorSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const refreshShopSetup = useRefreshShopSetup();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [isGeocodingStore, setIsGeocodingStore] = useState(false);
  /** Exact spot from a picked address suggestion. */
  const [pickedStoreSpot, setPickedStoreSpot] = useState<{ street: string; latitude: number; longitude: number } | null>(null);
  /** Exact spot from "Use my current location" (the seller standing in the shop). */
  const [gpsSpot, setGpsSpot] = useState<{ latitude: number; longitude: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  /** The exact spot already saved, kept when the street hasn't changed. */
  const [savedSpot, setSavedSpot] = useState<{ street: string; latitude: number; longitude: number } | null>(null);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      store_name: "",
      store_description: "",
      phone: "",
      store_street: "",
      store_city: "",
      store_state: "",
    },
  });

  /** Seller in their shop: take the phone's GPS position as the exact pickup spot (saved with the form). */
  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({ title: "Location isn't available on this device", variant: "destructive" });
      return;
    }
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsSpot({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setIsLocating(false);
        toast({ title: "Location found", description: "Tap Save to keep it." });
      },
      (error) => {
        console.warn("[VendorSettings] GPS failed", { code: error.code, message: error.message });
        setIsLocating(false);
        toast({
          title: error.code === error.PERMISSION_DENIED ? "Location is turned off for Kano Kaftan" : "Couldn't find your location",
          description: error.code === error.PERMISSION_DENIED ? "Allow location in your phone's settings, then try again." : "Move near a window or outside and try again.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS, maximumAge: 0 },
    );
  };

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      try {
        const { data: row, error } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, store_name, store_description, store_slug, store_banner_url, is_verified, verification_tier, verified_until")
          .eq("id", user.id)
          .single();

        if (error) {
          console.error("Error loading profile:", error);
          throw error;
        }
        // Phone, address and bank details are private fields (get_profile_private).
        const [profile] = await withProfilePrivate([row]);

        if (profile) {
          // Parse store_address JSON if it exists
          const storeAddress = profile.store_address as { 
            street?: string; 
            city?: string; 
            state?: string; 
            latitude?: number; 
            longitude?: number;
            location_precise?: boolean;
          } | null;
          
          form.reset({
            store_name: profile.store_name || "",
            store_description: profile.store_description || "",
            phone: profile.phone || "",
            store_street: storeAddress?.street || "",
            store_city: storeAddress?.city || "",
            store_state: storeAddress?.state || "",
          });
          setAvatarUrl(profile.avatar_url);
          setIsVerified(profile.is_verified || false);
          if (storeAddress?.location_precise && storeAddress.latitude != null && storeAddress.longitude != null) {
            setSavedSpot({ street: storeAddress.street || "", latitude: storeAddress.latitude, longitude: storeAddress.longitude });
          }
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadProfile();
  }, [user, form]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (!picked || !user) return;

    setIsUploadingAvatar(true);
    try {
      const file = await compressImage(picked, { maxDimension: AVATAR_MAX_DIMENSION });
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      console.log("Uploading avatar:", fileName);

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) {
        console.error("Upload error:", uploadError);
        throw uploadError;
      }

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      const newAvatarUrl = `${data.publicUrl}?t=${Date.now()}`;
      console.log("New avatar URL:", newAvatarUrl);

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("id", user.id);

      if (updateError) {
        console.error("Profile update error:", updateError);
        throw updateError;
      }

      setAvatarUrl(newAvatarUrl);
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been uploaded successfully.",
      });
    } catch (error: unknown) {
      console.error("Avatar upload failed:", error);
      toast({
        title: "Upload failed",
        description: (error instanceof Error && error.message) || "Failed to upload profile picture",
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  /** Required fields missing: say which, since the field may be off screen on a phone. */
  const onInvalid = (errors: Record<string, { message?: string } | undefined>) => {
    const first = Object.values(errors).find((e) => e?.message);
    toast({ title: "Some required details are missing", description: first?.message, variant: "destructive" });
  };

  const onSubmit = async (data: SettingsFormData) => {
    if (!user) return;
    
    // An exact spot is required so riders find the shop and "Near me" is accurate.
    const hasExactSpot = !!gpsSpot
      || (!!pickedStoreSpot && pickedStoreSpot.street === data.store_street)
      || (!!savedSpot && savedSpot.street === data.store_street);
    if (!hasExactSpot) {
      toast({
        title: "Add your exact shop location",
        description: "Tap \"Use my current location\" while in your shop, or pick your street from the suggestions.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Geocode store address if provided
      let storeAddress = null;
      if (data.store_street && data.store_city && data.store_state) {
        setIsGeocodingStore(true);
        try {
          // GPS in the shop, a picked suggestion or an unchanged saved spot is exact; otherwise look it up.
          const exact = gpsSpot
            ?? (pickedStoreSpot && pickedStoreSpot.street === data.store_street ? pickedStoreSpot : null)
            ?? (savedSpot && savedSpot.street === data.store_street ? savedSpot : null);
          const { data: geoData } = exact
            ? { data: { latitude: exact.latitude, longitude: exact.longitude } }
            : await supabase.functions.invoke('geocode-address', {
            body: { 
              street_address: data.store_street, 
              city: data.store_city, 
              state: data.store_state 
            }
          });
          storeAddress = {
            street: data.store_street,
            city: data.store_city,
            state: data.store_state,
            latitude: geoData?.latitude || null,
            longitude: geoData?.longitude || null,
            // Only exact spots show a distance under "Near me"; looked-up ones may be the town centre.
            location_precise: !!exact,
          } as unknown as Record<string, unknown>;
        } catch (geoError) {
          console.error('Geocoding failed:', geoError);
          storeAddress = {
            street: data.store_street,
            city: data.store_city,
            state: data.store_state,
          } as unknown as Record<string, unknown>;
        } finally {
          setIsGeocodingStore(false);
        }
      }

      const { error } = await supabase
        .from("profiles")
        .update({
          store_name: data.store_name,
          store_description: data.store_description,
          phone: data.phone,
          store_address: storeAddress,
        })
        .eq("id", user.id);

      if (error) throw error;

      refreshShopSetup();
      toast({
        title: "Settings saved",
        description: "Your store settings have been updated successfully.",
      });
    } catch (error: unknown) {
      console.error("Saving store settings failed:", error);
      toast({
        title: "Couldn't save your settings",
        description: (error instanceof Error && error.message) || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <VendorLayout title="Settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout title="Settings">
      <div className="space-y-4 md:space-y-6">
        {/* Profile Picture & Verification - First and prominent */}
        <Card>
          <CardHeader className="pb-3 md:pb-6">
            <CardTitle className="text-base md:text-lg flex items-center gap-2">
              <Camera className="h-4 w-4 md:h-5 md:w-5" />
              Profile & Verification
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Avatar Section */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Avatar className="h-20 w-20 md:h-24 md:w-24">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-xl md:text-2xl bg-muted">
                    {form.watch("store_name")?.charAt(0) || "V"}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-md"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingAvatar}
                >
                  {isUploadingAvatar ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4" />
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">
                    {form.watch("store_name") || "Your Store"}
                  </h3>
                  {isVerified && (
                    <Badge className="flex-shrink-0 bg-[#1D9BF0] hover:bg-[#1A8CD8]">
                      <BadgeCheck className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <p className="text-xs md:text-sm text-muted-foreground mt-1">
                  Tap camera to update photo
                </p>
              </div>
            </div>

            {/* Verification Section */}
            {!isVerified && (
              <div className="p-3 md:p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-blue-900 text-sm md:text-base">Get Verified</h4>
                    <p className="text-xs md:text-sm text-blue-700 mt-1">
                      Get a verified badge on your profile and listings.
                    </p>
                    <Button size="sm" className="mt-3" asChild>
                      <Link to="/vendor/verification">
                        <BadgeCheck className="h-4 w-4 mr-1.5" />
                        Get verified
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-4 md:space-y-6">
          {/* Store Information */}
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <Store className="h-4 w-4 md:h-5 md:w-5" />
                Store Information
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Displayed to customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ShopTypePicker />

              <div className="space-y-2">
                <Label htmlFor="store_name" className="text-sm">Store Name *</Label>
                <Input
                  id="store_name"
                  {...form.register("store_name")}
                  placeholder="Enter your store name"
                />
                {form.formState.errors.store_name && (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.store_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="store_description" className="text-sm">Description</Label>
                <Textarea
                  id="store_description"
                  {...form.register("store_description")}
                  placeholder="Tell customers about your store..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm">Phone Number *</Label>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  placeholder="0803 123 4567"
                  inputMode="tel"
                />
                {form.formState.errors.phone && (
                  <p className="text-xs text-destructive">{form.formState.errors.phone.message}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Store Location Card */}
          <Card>
            <CardHeader className="pb-3 md:pb-6">
              <CardTitle className="text-base md:text-lg flex items-center gap-2">
                <MapPin className="h-4 w-4 md:h-5 md:w-5" />
                Store Location (Pickup Point)
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">
                Set your store location for accurate shipping calculations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Location Status Indicator */}
              {form.watch("store_street") && form.watch("store_city") && form.watch("store_state") ? (
                <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-2 rounded-lg">
                  <ShieldCheck className="h-4 w-4" />
                  <span>Location set - coordinates will be saved on submit</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-2 rounded-lg">
                  <MapPin className="h-4 w-4" />
                  <span>Location required for accurate shipping rates</span>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="store_street" className="text-sm">Street Address *</Label>
                <AddressAutocomplete
                  id="store_street"
                  value={form.watch("store_street") ?? ""}
                  onChange={(v) => form.setValue("store_street", v, { shouldDirty: true })}
                  onSelectSuggestion={(s) => {
                    if (s.city) form.setValue("store_city", s.city, { shouldDirty: true });
                    if (s.state) form.setValue("store_state", s.state, { shouldDirty: true });
                    setPickedStoreSpot({ street: s.street, latitude: s.latitude, longitude: s.longitude });
                  }}
                  stateHint={form.watch("store_state") || undefined}
                  placeholder="Start typing, e.g. Ibrahim Taiwo Road"
                />
                {form.formState.errors.store_street && (
                  <p className="text-xs text-destructive">{form.formState.errors.store_street.message}</p>
                )}
              </div>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="store_city" className="text-sm">City *</Label>
                  <Input
                    id="store_city"
                    {...form.register("store_city")}
                    placeholder="e.g., Kano"
                  />
                  {form.formState.errors.store_city && (
                    <p className="text-xs text-destructive">{form.formState.errors.store_city.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="store_state" className="text-sm">State *</Label>
                  <Select
                    value={form.watch("store_state")}
                    onValueChange={(value) => form.setValue("store_state", value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {NIGERIAN_STATES.map((state) => (
                        <SelectItem key={state} value={state}>
                          {state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="rounded-lg border p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">Exact shop location *</p>
                    <p className="text-xs text-muted-foreground">
                      {gpsSpot || savedSpot
                        ? "Saved. Customers nearby see how far your shop is."
                        : "Stand in your shop and tap the button, so nearby customers find you first."}
                    </p>
                  </div>
                  <Button type="button" size="sm" variant={gpsSpot || savedSpot ? "outline" : "default"} disabled={isLocating} onClick={useCurrentLocation} className="shrink-0">
                    {isLocating ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <LocateFixed className="mr-1.5 h-4 w-4" />}
                    {gpsSpot ? "Updated" : "Use my current location"}
                  </Button>
                </div>
              </div>

              {isGeocodingStore && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Getting coordinates...</span>
                </div>
              )}
            </CardContent>
          </Card>

          {user && <ShopBrandingCard vendorId={user.id} />}

          {user && <PayoutAccountCard vendorId={user.id} />}

          <Button type="submit" disabled={isSaving} className="w-full">
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Settings
              </>
            )}
          </Button>
        </form>
      </div>

    </VendorLayout>
  );
}
