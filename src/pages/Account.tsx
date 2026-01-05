import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  User, 
  Mail, 
  Phone, 
  Save, 
  Loader2, 
  LogOut, 
  ShieldCheck, 
  Key, 
  Store, 
  Camera,
  ChevronRight,
  MapPin,
  CreditCard,
  Bell
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

const accountSchema = z.object({
  full_name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().optional(),
});

type AccountFormData = z.infer<typeof accountSchema>;

export default function Account() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLoading: authLoading, signOut, isVendor } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const form = useForm<AccountFormData>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      full_name: "",
      phone: "",
    },
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      navigate("/auth");
      return;
    }

    const loadProfile = async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        form.reset({
          full_name: profile.full_name || "",
          phone: profile.phone || "",
        });
        setAvatarUrl(profile.avatar_url);
      }
      setIsLoading(false);
    };

    loadProfile();
  }, [user, authLoading, form, navigate]);

  const onSubmit = async (data: AccountFormData) => {
    if (!user) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: data.full_name,
          phone: data.phone,
        })
        .eq("id", user.id);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your account information has been saved.",
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

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="container max-w-2xl py-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <Card className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="h-20 w-20 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-6 w-40" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full mt-4" />
          </Card>
        </div>
      </MobileLayout>
    );
  }

  const quickLinks = [
    { icon: MapPin, label: "Delivery Addresses", description: "Manage your saved addresses", href: "/account" },
    { icon: CreditCard, label: "Payment Methods", description: "Add or remove payment options", href: "/account", disabled: true },
    { icon: Bell, label: "Notification Settings", description: "Manage your preferences", href: "/settings" },
  ];

  return (
    <MobileLayout>
      <div className="container max-w-2xl py-6 space-y-6 pb-24">
        <div>
          <h1 className="text-2xl font-bold">Account Settings</h1>
          <p className="text-muted-foreground">Manage your personal information and preferences</p>
        </div>

        {/* Profile Header Card */}
        <Card className="overflow-hidden">
          <div className="h-16 bg-gradient-to-r from-primary/20 to-primary/5" />
          <CardContent className="pt-0 -mt-8">
            <div className="flex items-end gap-4 mb-6">
              <div className="relative">
                <Avatar className="h-20 w-20 border-4 border-background">
                  <AvatarImage src={avatarUrl || undefined} />
                  <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                    {form.watch("full_name")?.charAt(0) || user?.email?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <button 
                  className="absolute bottom-0 right-0 p-1.5 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors"
                  onClick={() => toast({ title: "Coming soon", description: "Avatar upload will be available soon" })}
                >
                  <Camera className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="flex-1 pb-1">
                <p className="font-semibold text-lg">{form.watch("full_name") || "Set your name"}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full Name</Label>
                  <Input
                    id="full_name"
                    {...form.register("full_name")}
                    placeholder="Enter your full name"
                  />
                  {form.formState.errors.full_name && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.full_name.message}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    {...form.register("phone")}
                    placeholder="+234 xxx xxx xxxx"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{user?.email}</span>
                  <Badge variant="outline" className="ml-auto text-xs">Verified</Badge>
                </div>
              </div>

              <Button type="submit" disabled={isSaving} className="w-full">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Quick Links */}
        <Card className="divide-y">
          {quickLinks.map((link) => (
            <Link
              key={link.label}
              to={link.disabled ? "#" : link.href}
              className={`flex items-center gap-4 p-4 transition-colors ${
                link.disabled ? "opacity-50 cursor-not-allowed" : "hover:bg-muted/50"
              }`}
              onClick={(e) => link.disabled && e.preventDefault()}
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <link.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{link.label}</p>
                <p className="text-sm text-muted-foreground">{link.description}</p>
              </div>
              {link.disabled ? (
                <Badge variant="secondary" className="text-xs">Soon</Badge>
              ) : (
                <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              )}
            </Link>
          ))}
        </Card>

        {/* Vendor Account */}
        {isVendor && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-background overflow-hidden relative">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-2">
                <Store className="h-5 w-5 text-primary" />
                Vendor Account
              </CardTitle>
              <CardDescription>
                Manage your store, products, and orders
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                className="w-full" 
                onClick={() => navigate("/vendor/dashboard")}
              >
                <Store className="mr-2 h-4 w-4" />
                Go to Vendor Dashboard
                <ChevronRight className="ml-auto h-4 w-4" />
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Security
            </CardTitle>
            <CardDescription>
              Manage your account security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button 
              variant="outline" 
              className="w-full justify-between" 
              onClick={() => toast({ title: "Coming soon", description: "Password change will be available soon" })}
            >
              <span className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Change Password
              </span>
              <Badge variant="secondary" className="text-xs">Soon</Badge>
            </Button>
          </CardContent>
        </Card>

        {/* Sign Out */}
        <Card className="border-destructive/30">
          <CardContent className="pt-6">
            <Button 
              variant="outline" 
              className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </CardContent>
        </Card>
      </div>
    </MobileLayout>
  );
}