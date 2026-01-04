import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Store, Building, CreditCard, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { VendorLayout } from "@/components/vendor/VendorLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

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
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

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
      }
      setIsLoading(false);
    };

    loadProfile();
  }, [form]);

  const onSubmit = async (data: SettingsFormData) => {
    setIsSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

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
    </VendorLayout>
  );
}
