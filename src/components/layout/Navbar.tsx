import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Menu, X, ShoppingCart, Heart, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import type { User as SupabaseUser } from "@supabase/supabase-js";

export function Navbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const { count: cartCount } = useCart();
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
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2">
          <span className="font-display text-2xl font-bold text-primary">
            K<sup className="text-sm">2</sup>
          </span>
          <span className="hidden font-display text-lg sm:inline">Kano Kaftan</span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden items-center gap-8 md:flex">
          <Link 
            to="/products" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Shop
          </Link>
          <Link 
            to="/products?category=agbada" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Agbada
          </Link>
          <Link 
            to="/products?category=kaftan" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Kaftan
          </Link>
          <Link 
            to="/products?category=dashiki" 
            className="text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            Dashiki
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="hidden sm:flex" asChild>
            <Link to="/wishlist">
              <Heart className="h-5 w-5" />
              <span className="sr-only">Wishlist</span>
            </Link>
          </Button>
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link to="/cart">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-xs flex items-center justify-center">
                  {cartCount > 9 ? "9+" : cartCount}
                </Badge>
              )}
              <span className="sr-only">Cart</span>
            </Link>
          </Button>
          
          {user ? (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="ghost" size="icon" asChild>
                <Link to="/account">
                  <User className="h-5 w-5" />
                  <span className="sr-only">Account</span>
                </Link>
              </Button>
              <Button variant="ghost" size="icon" onClick={handleLogout}>
                <LogOut className="h-5 w-5" />
                <span className="sr-only">Logout</span>
              </Button>
            </div>
          ) : (
            <Button variant="default" size="sm" className="hidden sm:flex" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
          )}

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="border-t md:hidden">
          <div className="container flex flex-col gap-4 py-4">
            <Link 
              to="/products" 
              className="text-sm font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Shop All
            </Link>
            <Link 
              to="/products?category=agbada" 
              className="text-sm font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Agbada
            </Link>
            <Link 
              to="/products?category=kaftan" 
              className="text-sm font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Kaftan
            </Link>
            <Link 
              to="/products?category=dashiki" 
              className="text-sm font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Dashiki
            </Link>
            <Link 
              to="/wishlist" 
              className="text-sm font-medium"
              onClick={() => setIsMenuOpen(false)}
            >
              Wishlist
            </Link>
            {user ? (
              <>
                <Link 
                  to="/account" 
                  className="text-sm font-medium"
                  onClick={() => setIsMenuOpen(false)}
                >
                  My Account
                </Link>
                <button 
                  className="text-left text-sm font-medium text-destructive"
                  onClick={() => {
                    handleLogout();
                    setIsMenuOpen(false);
                  }}
                >
                  Sign Out
                </button>
              </>
            ) : (
              <Link 
                to="/auth" 
                className="text-sm font-medium text-primary"
                onClick={() => setIsMenuOpen(false)}
              >
                Sign In / Register
              </Link>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
