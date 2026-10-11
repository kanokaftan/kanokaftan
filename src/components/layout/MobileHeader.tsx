import { Link } from "react-router-dom";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useCart } from "@/hooks/useCart";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LiveSearch } from "@/components/search/LiveSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

export function MobileHeader() {
  const { count: cartCount } = useCart();
  const { user } = useAuth();
  const { t } = useTranslation();

  return (
    <header className="liquid-glass sticky top-0 z-50 w-full border-b border-white/30 dark:border-white/10">
      <div className="flex h-14 items-center gap-3 px-4">
        <Link to="/" className="flex-shrink-0">
          <BrandLogo className="h-9 w-9" alt="Kano Kaftan home" />
        </Link>

        <LiveSearch className="flex-1" placeholder={t("products.searchPlaceholder")} />

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
