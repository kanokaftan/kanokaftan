import { MobileLayout } from "@/components/layout/MobileLayout";
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  ChevronRight,
  Shield,
  Heart,
  Package,
  MapPin,
  Bell
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTranslation } from "react-i18next";

export default function Profile() {
  const { t } = useTranslation();
  const { user, isAdmin, isLoading, signOut } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ["user-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, phone")
        .eq("id", user.id)
        .single();
      return data;
    },
    enabled: !!user?.id,
  });

  const { data: stats } = useQuery({
    queryKey: ["user-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return { orders: 0, wishlist: 0, addresses: 0 };

      const [ordersRes, wishlistRes, addressesRes] = await Promise.all([
        supabase.from("orders").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("wishlists").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("delivery_addresses").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      ]);

      return {
        orders: ordersRes.count || 0,
        wishlist: wishlistRes.count || 0,
        addresses: addressesRes.count || 0,
      };
    },
    enabled: !!user?.id,
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/");
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="px-4 py-6 space-y-6">
          <Skeleton className="h-8 w-32" />
          <Card className="p-6">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-28" />
              </div>
            </div>
          </Card>
          <div className="grid grid-cols-3 gap-3">
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
            <Skeleton className="h-24" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!user) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          <h1 className="font-display text-2xl font-bold text-foreground">{t("profile.title")}</h1>

          <div className="mt-16 flex flex-col items-center justify-center text-center">
            <div className="mb-6 h-24 w-24 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
              <User className="h-12 w-12 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground">{t("profile.welcomeTitle")}</h2>
            <p className="mt-2 text-muted-foreground max-w-xs">
              {t("profile.welcomeDesc")}
            </p>
            <div className="mt-8 flex gap-3 w-full max-w-xs">
              <Button asChild className="flex-1" size="lg">
                <Link to="/auth">{t("auth.signIn")}</Link>
              </Button>
              <Button variant="outline" asChild className="flex-1" size="lg">
                <Link to="/auth?mode=register">{t("profile.register")}</Link>
              </Button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const quickActions = [
    { icon: Package, label: t("profile.ordersLabel"), count: stats?.orders, href: "/orders" },
    { icon: Heart, label: t("profile.wishlist"), count: stats?.wishlist, href: "/wishlist" },
    { icon: MapPin, label: t("profile.addresses"), count: stats?.addresses, href: "/account" },
  ];

  const menuItems = [
    { icon: User, label: t("profile.accountSettings"), description: t("profile.accountSettingsDesc"), href: "/account" },
    { icon: Bell, label: t("settings.notifications"), description: t("profile.notificationsDesc"), href: "/settings" },
    { icon: HelpCircle, label: t("profile.help"), description: "FAQs & contact us", href: "/help" },
  ];

  if (isAdmin) {
    menuItems.unshift({
      icon: Shield,
      label: t("profile.adminDashboard"),
      description: t("profile.adminDashboardDesc"),
      href: "/admin/dashboard"
    });
  }

  return (
    <MobileLayout>
      <div className="px-4 py-6 space-y-6 pb-24">
        <h1 className="font-display text-2xl font-bold text-foreground">{t("profile.title")}</h1>

        {/* User Card */}
        <Card className="p-5 bg-gradient-to-br from-primary/5 via-background to-background border-primary/20 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="relative flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/20">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="text-xl bg-primary text-primary-foreground">
                {profile?.full_name?.charAt(0) || user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-lg truncate">
                {profile?.full_name || t("chat.welcome")}
              </h2>
              <p className="text-sm text-muted-foreground truncate">{user.email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant="secondary" className="text-xs">{t("profile.customer")}</Badge>
                {isAdmin && (
                  <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                    <Shield className="h-3 w-3 mr-1" />
                    {t("profile.admin")}
                  </Badge>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" asChild className="flex-shrink-0">
              <Link to="/account">
                <Settings className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-3">
          {quickActions.map((action) => (
            <Link key={action.href} to={action.href}>
              <Card className="p-4 text-center hover:bg-muted/50 transition-colors h-full">
                <div className="mx-auto w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                  <action.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="text-2xl font-bold">{action.count ?? 0}</p>
                <p className="text-xs text-muted-foreground">{action.label}</p>
              </Card>
            </Link>
          ))}
        </div>

        {/* Menu Items */}
        <Card className="divide-y">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="flex items-center gap-4 p-4 hover:bg-muted/50 transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <item.icon className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium">{item.label}</p>
                <p className="text-sm text-muted-foreground">{item.description}</p>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
            </Link>
          ))}
        </Card>

        {/* Logout Button */}
        <Button
          variant="outline"
          className="w-full justify-center gap-2 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4" />
          {t("profile.signOut")}
        </Button>
      </div>
    </MobileLayout>
  );
}
