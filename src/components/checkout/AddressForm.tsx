import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAddresses, AddressFormData } from "@/hooks/useAddresses";
import { toast } from "sonner";

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

const NIGERIAN_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue",
  "Borno", "Cross River", "Delta", "Ebonyi", "Edo", "Ekiti", "Enugu",
  "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun",
  "Oyo", "Plateau", "Rivers", "Sokoto", "Taraba", "Yobe", "Zamfara",
];

interface AddressFormProps {
  onSuccess: () => void;
  editAddress?: AddressFormData & { id: string };
}

export function AddressForm({ onSuccess, editAddress }: AddressFormProps) {
  const { addAddress, updateAddress } = useAddresses();

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

  const onSubmit = async (data: AddressFormData) => {
    try {
      if (editAddress) {
        await updateAddress.mutateAsync({ id: editAddress.id, ...data });
        toast.success("Address updated");
      } else {
        await addAddress.mutateAsync(data);
        toast.success("Address added");
      }
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || "Failed to save address");
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
        <Input
          id="street_address"
          {...register("street_address")}
          placeholder="123 Main Street, Ikeja"
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

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : editAddress ? "Update Address" : "Save Address"}
      </Button>
    </form>
  );
}
