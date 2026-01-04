import { useState, useEffect } from "react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { User, Settings, HelpCircle, LogOut, ChevronRight, Store } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export default function Profile() {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isVendor, setIsVendor] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        checkVendorStatus(session.user.id);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          checkVendorStatus(session.user.id);
        } else {
          setIsVendor(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const checkVendorStatus = async (userId: string) => {
    const { data } = await supabase.rpc("has_role", {
      _role: "vendor",
      _user_id: userId,
    });
    setIsVendor(!!data);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (!user) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          <h1 className="font-display text-xl font-bold text-foreground">Profile</h1>
          
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <User className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium text-foreground">Sign in to view your profile</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Access your orders, favorites, and more.
            </p>
            <div className="mt-6 flex gap-3">
              <Button asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/auth?mode=register">Register</Link>
              </Button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  const menuItems = [
    { icon: User, label: "Account Settings", href: "/account" },
    { icon: Settings, label: "Preferences", href: "/settings" },
    { icon: HelpCircle, label: "Help & Support", href: "/help" },
  ];

  if (isVendor) {
    menuItems.unshift({ icon: Store, label: "Vendor Dashboard", href: "/vendor/dashboard" });
  }

  return (
    <MobileLayout>
      <div className="px-4 py-6">
        <h1 className="font-display text-xl font-bold text-foreground">Profile</h1>
        
        {/* User Info */}
        <div className="mt-6 flex items-center gap-4 rounded-xl bg-muted/50 p-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <span className="text-xl font-bold">
              {user.email?.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="font-medium text-foreground">{user.email}</p>
            <p className="text-sm text-muted-foreground">
              {isVendor ? "Vendor Account" : "Customer Account"}
            </p>
          </div>
        </div>

        {/* Menu Items */}
        <div className="mt-6 space-y-2">
          {menuItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="flex items-center justify-between rounded-xl bg-background p-4 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium text-foreground">{item.label}</span>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </Link>
          ))}
        </div>

        {/* Become a Vendor CTA */}
        {!isVendor && (
          <div className="mt-6 rounded-xl bg-primary/10 p-4">
            <h3 className="font-medium text-foreground">Become a Vendor</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Start selling your products on K² Kano Kaftan
            </p>
            <Button size="sm" className="mt-3" asChild>
              <Link to="/auth?mode=register&role=vendor">Get Started</Link>
            </Button>
          </div>
        )}

        {/* Logout Button */}
        <Button
          variant="ghost"
          className="mt-6 w-full justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-5 w-5" />
          Sign Out
        </Button>
      </div>
    </MobileLayout>
  );
}
