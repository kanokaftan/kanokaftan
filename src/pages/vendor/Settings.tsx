import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  Store, CreditCard, Save, Loader2, Camera, BadgeCheck, 
  ShieldCheck, Star 
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VendorLayout } from "@/components/vendor/VendorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

const VERIFICATION_CODE = "K2AA221";

const settingsSchema = z.object({
  store_name: z.string().min(2, "Store name must be at least 2 characters"),
  store_description: z.string().optional(),
  phone: z.string().optional(),
  bank_name: z.string().optional(),
  account_number: z.string().optional(),
  account_name: z.string().optional(),
  payout_preference: z.enum(["daily", "weekly", "monthly"]).optional(),
});

type SettingsFormData = z.infer<typeof settingsSchema>;

export default function VendorSettings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isVerified, setIsVerified] = useState(false);
  const [showVerifyDialog, setShowVerifyDialog] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const form = useForm<SettingsFormData>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      store_name: "",
      store_description: "",
      phone: "",
      bank_name: "",
      account_number: "",
      account_name: "",
      payout_preference: "weekly",
    },
  });

  useEffect(() => {
    if (!user) return;

    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        form.reset({
          store_name: profile.store_name || "",
          store_description: profile.store_description || "",
          phone: profile.phone || "",
          bank_name: profile.bank_name || "",
          account_number: profile.account_number || "",
          account_name: profile.account_name || "",
          payout_preference: (profile.payout_preference as "daily" | "weekly" | "monthly") || "weekly",
        });
        setAvatarUrl(profile.avatar_url);
        setIsVerified(profile.is_verified || false);
      }
      setIsLoading(false);
    };

    loadProfile();
  }, [user, form]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploadingAvatar(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("product-images")
        .getPublicUrl(fileName);

      const newAvatarUrl = `${data.publicUrl}?t=${Date.now()}`;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_url: newAvatarUrl })
        .eq("id", user.id);

      if (updateError) throw updateError;

      setAvatarUrl(newAvatarUrl);
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been uploaded successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleVerification = async () => {
    if (!user) return;
    
    setIsVerifying(true);
    try {
      if (verificationCode.toUpperCase() !== VERIFICATION_CODE) {
        throw new Error("Invalid verification code");
      }

      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: true })
        .eq("id", user.id);

      if (error) throw error;

      setIsVerified(true);
      setShowVerifyDialog(false);
      setVerificationCode("");
      
      toast({
        title: "Verification successful! 🎉",
        description: "Your account is now verified. A badge will appear on your profile.",
      });
    } catch (error: any) {
      toast({
        title: "Verification failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const onSubmit = async (data: SettingsFormData) => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          store_name: data.store_name,
          store_description: data.store_description,
          phone: data.phone,
          bank_name: data.bank_name,
          account_number: data.account_number,
          account_name: data.account_name,
          payout_preference: data.payout_preference,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Settings saved",
        description: "Your store settings have been updated successfully.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <VendorLayout title="Store Settings">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout title="Store Settings">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Store Settings</h1>
          <p className="text-muted-foreground">Manage your store profile and payout information</p>
        </div>

        {/* Profile Picture & Verification */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Profile & Verification
            </CardTitle>
            <CardDescription>
              Your profile picture and verification status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-6">
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-2xl">
                    {form.watch("store_name")?.charAt(0) || "V"}
                  </AvatarFallback>
                </Avatar>
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full"
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
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold">{form.watch("store_name") || "Your Store"}</h3>
                  {isVerified && (
                    <Badge className="bg-blue-500 hover:bg-blue-600">
                      <BadgeCheck className="h-3 w-3 mr-1" />
                      Verified
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Click the camera icon to update your profile picture
                </p>
              </div>
            </div>

            {!isVerified && (
              <div className="p-4 rounded-lg bg-blue-50 border border-blue-200">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-blue-600 mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-medium text-blue-900">Get Verified</h4>
                    <p className="text-sm text-blue-700 mt-1">
                      Verified vendors get a badge on their profile and listings, building trust with customers.
                    </p>
                    <Button 
                      size="sm" 
                      className="mt-3"
                      onClick={() => setShowVerifyDialog(true)}
                    >
                      <BadgeCheck className="h-4 w-4 mr-2" />
                      Enter Verification Code
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Store Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5" />
                Store Information
              </CardTitle>
              <CardDescription>
                This information will be displayed to customers
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="store_name">Store Name *</Label>
                <Input
                  id="store_name"
                  {...form.register("store_name")}
                  placeholder="Enter your store name"
                />
                {form.formState.errors.store_name && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.store_name.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="store_description">Store Description</Label>
                <Textarea
                  id="store_description"
                  {...form.register("store_description")}
                  placeholder="Tell customers about your store..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  {...form.register("phone")}
                  placeholder="+234 xxx xxx xxxx"
                />
              </div>
            </CardContent>
          </Card>

          {/* Bank Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payout Information
              </CardTitle>
              <CardDescription>
                Bank account details for receiving payments
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bank_name">Bank Name</Label>
                  <Input
                    id="bank_name"
                    {...form.register("bank_name")}
                    placeholder="e.g., First Bank"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    {...form.register("account_number")}
                    placeholder="10-digit account number"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="account_name">Account Name</Label>
                <Input
                  id="account_name"
                  {...form.register("account_name")}
                  placeholder="Name on bank account"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="payout_preference">Payout Frequency</Label>
                <Select
                  value={form.watch("payout_preference")}
                  onValueChange={(value) => form.setValue("payout_preference", value as "daily" | "weekly" | "monthly")}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select frequency" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={isSaving} className="w-full sm:w-auto">
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

      {/* Verification Dialog */}
      <Dialog open={showVerifyDialog} onOpenChange={setShowVerifyDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeCheck className="h-5 w-5 text-blue-600" />
              Get Verified
            </DialogTitle>
            <DialogDescription>
              Enter your verification code to get a verified badge on your profile.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="verificationCode">Verification Code</Label>
            <Input
              id="verificationCode"
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value.toUpperCase())}
              placeholder="Enter code"
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerifyDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleVerification} disabled={isVerifying || !verificationCode}>
              {isVerifying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                "Verify"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VendorLayout>
  );
}
