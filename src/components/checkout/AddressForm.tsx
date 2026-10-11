import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { AddressAutocomplete, type AddressSuggestion } from "@/components/address/AddressAutocomplete";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddresses, AddressFormData } from "@/hooks/useAddresses";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { NIGERIAN_STATES } from "@/lib/nigeria";

const addressSchema = z.object({
  label: z.string().min(1, "Label is required"),
  full_name: z.string().min(2, "Full name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  street_address: z.string().min(5, "Street address is required"),
  city: z.string().min(2, "City is required"),
  state: z.string().min(2, "State is required"),
  landmark: z.string().optional(),
  is_default: z.boolean().optional(),
});


interface AddressFormProps {
  onSuccess: () => void;
  editAddress?: AddressFormData & { id: string };
}

export function AddressForm({ onSuccess, editAddress }: AddressFormProps) {
  const { addAddress, updateAddress } = useAddresses();
  const [isGeocoding, setIsGeocoding] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<AddressFormData>({
    resolver: zodResolver(addressSchema),
    defaultValues: editAddress || {
      label: "Home",
      full_name: "",
      phone: "",
      street_address: "",
      city: "",
      state: "",
      landmark: "",
      is_default: false,
    },
  });

  const selectedState = watch("state");
  const streetValue = watch("street_address");
  // The street box is a custom input, so register the field by hand for validation.
  useEffect(() => {
    register("street_address");
  }, [register]);
  /** Coordinates from a picked suggestion (exact), used instead of looking the address up again. */
  const [picked, setPicked] = useState<{ street: string; latitude: number; longitude: number } | null>(null);

  const applySuggestion = (s: AddressSuggestion) => {
    if (s.city) setValue("city", s.city, { shouldValidate: true });
    if (s.state) setValue("state", s.state, { shouldValidate: true });
    setPicked({ street: s.street, latitude: s.latitude, longitude: s.longitude });
  };

  const geocodeAddress = async (street_address: string, city: string, state: string) => {
    try {
      setIsGeocoding(true);
      const { data, error } = await supabase.functions.invoke('geocode-address', {
        body: { street_address, city, state }
      });

      if (error) {
        console.error('Geocoding error:', error);
        return null;
      }

      if (data?.success && data.latitude && data.longitude) {
        return { latitude: data.latitude, longitude: data.longitude };
      }
      
      return null;
    } catch (error) {
      console.error('Geocoding failed:', error);
      return null;
    } finally {
      setIsGeocoding(false);
    }
  };

  const onSubmit = async (data: AddressFormData) => {
    try {
      // A picked suggestion already has exact coordinates; otherwise look the address up.
      const coords =
        picked && picked.street === data.street_address
          ? { latitude: picked.latitude, longitude: picked.longitude }
          : await geocodeAddress(data.street_address, data.city, data.state);
      
      const addressData: AddressFormData = {
        ...data,
        latitude: coords?.latitude ?? null,
        longitude: coords?.longitude ?? null,
      };

      if (editAddress) {
        await updateAddress.mutateAsync({ id: editAddress.id, ...addressData });
        toast.success("Address updated");
      } else {
        await addAddress.mutateAsync(addressData);
        toast.success("Address added");
      }
      onSuccess();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save address";
      toast.error(message);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
      <div>
        <Label htmlFor="label">Address Label</Label>
        <Select
          defaultValue={editAddress?.label || "Home"}
          onValueChange={(value) => setValue("label", value)}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="Home">Home</SelectItem>
            <SelectItem value="Work">Work</SelectItem>
            <SelectItem value="Other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label htmlFor="full_name">Full Name</Label>
        <Input id="full_name" {...register("full_name")} placeholder="John Doe" />
        {errors.full_name && (
          <p className="mt-1 text-xs text-destructive">{errors.full_name.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="phone">Phone Number</Label>
        <Input id="phone" {...register("phone")} placeholder="08012345678" type="tel" />
        {errors.phone && (
          <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>
        )}
      </div>

      <div>
        <Label htmlFor="street_address">Street Address</Label>
        <AddressAutocomplete
          id="street_address"
          value={streetValue ?? ""}
          onChange={(v) => setValue("street_address", v, { shouldValidate: !!errors.street_address })}
          onSelectSuggestion={applySuggestion}
          stateHint={selectedState || undefined}
          placeholder="Start typing your street, e.g. Zoo Road"
        />
        {errors.street_address && (
          <p className="mt-1 text-xs text-destructive">{errors.street_address.message}</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="city">City</Label>
          <Input id="city" {...register("city")} placeholder="Lagos" />
          {errors.city && (
            <p className="mt-1 text-xs text-destructive">{errors.city.message}</p>
          )}
        </div>

        <div>
          <Label htmlFor="state">State</Label>
          <Select value={selectedState} onValueChange={(value) => setValue("state", value)}>
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
          {errors.state && (
            <p className="mt-1 text-xs text-destructive">{errors.state.message}</p>
          )}
        </div>
      </div>

      <div>
        <Label htmlFor="landmark">Landmark (Optional)</Label>
        <Input
          id="landmark"
          {...register("landmark")}
          placeholder="Near XYZ Bank"
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <Label htmlFor="is_default" className="cursor-pointer">
          Set as default address
        </Label>
        <Switch
          id="is_default"
          checked={watch("is_default")}
          onCheckedChange={(checked) => setValue("is_default", checked)}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || isGeocoding}>
        {isSubmitting || isGeocoding ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {isGeocoding ? "Getting location..." : "Saving..."}
          </>
        ) : editAddress ? (
          <>
            <MapPin className="mr-2 h-4 w-4" />
            Update Address
          </>
        ) : (
          <>
            <MapPin className="mr-2 h-4 w-4" />
            Save Address
          </>
        )}
      </Button>
    </form>
  );
}
