import { Link } from "react-router-dom";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/hooks/useCart";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LiveSearch } from "@/components/search/LiveSearch";
import { useAuth } from "@/contexts/AuthContext";

export function MobileHeader() {
  const { count: cartCount } = useCart();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-3 px-4">
        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <span className="font-display text-xl font-bold text-primary">
            K<sup className="text-xs">2</sup>
          </span>
        </Link>

        {/* Live Search */}
        <LiveSearch className="flex-1" placeholder="Search products..." />

        {/* Notifications & Cart */}
        {user && <NotificationBell />}
        
        <Link to="/cart" className="relative flex-shrink-0">
          <ShoppingCart className="h-6 w-6 text-foreground" />
          {cartCount > 0 && (
            <Badge className="absolute -right-2 -top-2 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center">
              {cartCount > 9 ? "9+" : cartCount}
            </Badge>
          )}
        </Link>
      </div>
    </header>
  );
}
