import { useState, useEffect } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, Heart, User, LogOut, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { forgetThisDevice } from "@/lib/push";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import type { User as SupabaseUser } from "@supabase/supabase-js";
import { useTranslation } from "react-i18next";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { t } = useTranslation();
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setUser(session?.user ?? null);
      }
    );
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await forgetThisDevice();
    await supabase.auth.signOut({ scope: "local" });
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <BrandLogo alt="Kano Kaftan" className="h-8 w-8" />
          <span className="font-display text-lg font-bold text-primary">
            Kano Kaftan
          </span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          <Link to="/products" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Shop</Link>
          <Link to="/shops" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">{t("nav.sellers")}</Link>
          <Link to="/products?category=kaftan" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Kaftan</Link>
          <Link to="/products?category=shoes" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Shoes</Link>
          <Link to="/products?category=caps" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Caps</Link>
          <Link to="/products?category=accessories" className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary">Accessories</Link>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden sm:flex" asChild>
            <Link to="/wishlist"><Heart className="h-5 w-5" /></Link>
          </Button>
          <Button variant="ghost" size="icon" asChild>
            <Link to="/chat"><MessageCircle className="h-5 w-5" /></Link>
          </Button>
          {user ? (
            <div className="hidden items-center gap-1 sm:flex">
              <NotificationBell />
              <Button variant="ghost" size="icon" asChild>
                <Link to="/profile"><User className="h-5 w-5" /></Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
              </Button>
            </div>
          ) : (
            <Button variant="default" size="sm" className="hidden sm:flex" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setIsMenuOpen(!isMenuOpen)}>
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="border-t md:hidden">
          <div className="container flex flex-col gap-4 py-4">
            <Link to="/products" className="text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Shop All</Link>
            <Link to="/shops" className="text-sm font-medium" onClick={() => setIsMenuOpen(false)}>{t("nav.sellers")}</Link>
            <Link to="/products?category=kaftan" className="text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Kaftan</Link>
            <Link to="/products?category=shoes" className="text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Shoes</Link>
            <Link to="/products?category=caps" className="text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Caps</Link>
            <Link to="/products?category=accessories" className="text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Accessories</Link>
            <Link to="/wishlist" className="text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Wishlist</Link>
            <Link to="/chat" className="text-sm font-medium" onClick={() => setIsMenuOpen(false)}>Chat to order</Link>
            {user ? (
              <>
                <Link to="/profile" className="text-sm font-medium" onClick={() => setIsMenuOpen(false)}>My Profile</Link>
                <button className="text-left text-sm font-medium text-destructive" onClick={() => { handleLogout(); setIsMenuOpen(false); }}>
                  Sign Out
                </button>
              </>
            ) : (
              <Link to="/auth" className="text-sm font-medium text-primary" onClick={() => setIsMenuOpen(false)}>
                Sign In / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
