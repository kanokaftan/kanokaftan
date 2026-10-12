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
    // Floating rounded bar (matches the bottom tab bar); the page fades out behind it.
    <header className="sticky top-0 z-50 w-full bg-gradient-to-b from-background via-background/85 to-transparent px-3 pb-2 pt-2">
      <div className="liquid-glass flex h-14 items-center gap-2.5 rounded-full pl-2 pr-2">
        <Link to="/" className="flex-shrink-0 rounded-full" aria-label="Kano Kaftan home">
          <BrandLogo className="h-10 w-10" alt="" />
        </Link>

        <LiveSearch className="min-w-0 flex-1" placeholder={t("products.searchPlaceholder")} />

        {user && <NotificationBell />}

        <Link
          to="/cart"
          className="relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full transition-colors hover:bg-foreground/5 active:scale-95"
          aria-label={cartCount > 0 ? `Cart (${cartCount})` : "Cart"}
        >
          <ShoppingCart className="h-[22px] w-[22px] text-foreground" />
          {cartCount > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full px-1 py-0 text-[10px]">
              {cartCount > 9 ? "9+" : cartCount}
            </Badge>
          )}
        </Link>
      </div>
    </header>
  );
}
