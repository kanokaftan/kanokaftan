import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Store, Loader2, ChevronLeft, BadgeCheck, Package, Star } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function BecomeVendor() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isVendor } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    store_name: "",
    store_description: "",
    phone: "",
  });

  // Redirect if not authenticated
  if (!authLoading && !user) {
    navigate("/auth?redirect=/become-vendor");
    return null;
  }

  // Already a vendor
  if (isVendor) {
    return (
      <MobileLayout>
        <div className="px-4 py-6 pb-24">
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h1 className="font-display text-xl font-bold">Become a Vendor</h1>
          </div>
          
          <Card className="border-primary">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <BadgeCheck className="h-16 w-16 text-primary mb-4" />
              <h3 className="font-display text-xl font-bold mb-2">You're Already a Vendor!</h3>
              <p className="text-muted-foreground mb-6">
                You can access your vendor dashboard to manage your products and orders.
              </p>
              <Button onClick={() => navigate("/vendor/dashboard")}>
                Go to Vendor Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </MobileLayout>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.store_name.trim()) {
      toast.error("Please enter a store name");
      return;
    }

    setIsSubmitting(true);
    try {
      // Add vendor role to user
      const { error: roleError } = await supabase
        .from("user_roles")
        .insert({
          user_id: user!.id,
          role: "vendor",
        });

      if (roleError) {
        if (roleError.message.includes("duplicate")) {
          toast.error("You already have a vendor account");
        } else {
          throw roleError;
        }
        return;
      }

      // Update profile with store info
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          store_name: formData.store_name,
          store_description: formData.store_description || null,
          phone: formData.phone || null,
        })
        .eq("id", user!.id);

      if (profileError) throw profileError;

      toast.success("Congratulations! You're now a vendor!", {
        description: "You can start adding products to your store.",
      });

      // Navigate to vendor dashboard
      navigate("/vendor/dashboard");
      
      // Force reload to update auth context
      window.location.href = "/vendor/dashboard";
    } catch (error: any) {
      console.error("Failed to create vendor account:", error);
      toast.error(error.message || "Failed to create vendor account");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MobileLayout>
      <div className="px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-display text-xl font-bold">Become a Vendor</h1>
            <p className="text-sm text-muted-foreground">Start selling on K² Kaftan</p>
          </div>
        </div>

        {/* Benefits */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <Store className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-xs font-medium">Your Own Store</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <Package className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-xs font-medium">Easy Listings</p>
            </CardContent>
          </Card>
          <Card className="bg-primary/5 border-primary/20">
            <CardContent className="p-4 text-center">
              <Star className="h-8 w-8 text-primary mx-auto mb-2" />
              <p className="text-xs font-medium">Grow Sales</p>
            </CardContent>
          </Card>
        </div>

        {/* Form */}
        <Card>
          <CardHeader>
            <CardTitle>Store Information</CardTitle>
            <CardDescription>
              Tell us about your store. You can update these details later.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="store_name">Store Name *</Label>
                <Input
                  id="store_name"
                  placeholder="e.g., Alhaji Musa Tailoring"
                  value={formData.store_name}
                  onChange={(e) => setFormData(prev => ({ ...prev, store_name: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+234..."
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="store_description">Store Description</Label>
                <Textarea
                  id="store_description"
                  placeholder="Tell customers about your store, specialties, and experience..."
                  value={formData.store_description}
                  onChange={(e) => setFormData(prev => ({ ...prev, store_description: e.target.value }))}
                  rows={4}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Vendor Account
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">
          By becoming a vendor, you agree to our Terms of Service and Vendor Guidelines.
        </p>
      </div>
    </MobileLayout>
  );
}