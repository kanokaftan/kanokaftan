import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Search, ShoppingCart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Badge } from "@/components/ui/badge";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { LiveSearch } from "@/components/search/LiveSearch";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/hooks/useCart";

/**
 * Top bar: the logo on its own on the left and a small glass pill of actions
 * on the right (notifications, cart). The search icon is only shown where a
 * page asks for it (the home page); Products and Shops have their own search
 * box, and chat and profile don't need one.
 */
export function MobileHeader({ showSearch = false }: { showSearch?: boolean }) {
  const { count: cartCount } = useCart();
  const { user } = useAuth();
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const [searching, setSearching] = useState(false);

  // Close search after choosing a result (the page changes).
  useEffect(() => setSearching(false), [pathname]);

  return (
    <header className="sticky top-0 z-50 w-full bg-gradient-to-b from-background via-background/85 to-transparent px-3 pb-2 pt-2">
      {searching && showSearch ? (
        <div className="flex h-12 items-center gap-2">
          <LiveSearch className="min-w-0 flex-1" placeholder={t("products.searchPlaceholder")} autoFocus />
          <button
            type="button"
            onClick={() => setSearching(false)}
            className="shrink-0 px-2 text-sm font-medium text-foreground active:opacity-60"
          >
            {t("common.cancel", "Cancel")}
          </button>
        </div>
      ) : (
        <div className="flex h-12 items-center justify-between">
          <Link to="/" className="flex shrink-0 items-center gap-2 rounded-full active:opacity-70" aria-label="Kano Kaftan home">
            <BrandLogo className="h-10 w-10" alt="" />
          </Link>

          <div className="liquid-glass flex h-11 items-center gap-0.5 rounded-full px-1">
            {showSearch && (
              <button
                type="button"
                onClick={() => setSearching(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-foreground/5 active:scale-95"
                aria-label={t("products.searchPlaceholder")}
              >
                <Search className="h-[21px] w-[21px]" />
              </button>
            )}
            {user && <NotificationBell />}
            <Link
              to="/cart"
              className="relative flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-foreground/5 active:scale-95"
              aria-label={cartCount > 0 ? `Cart (${cartCount})` : "Cart"}
            >
              <ShoppingCart className="h-[21px] w-[21px] text-foreground" />
              {cartCount > 0 && (
                <Badge className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full px-1 py-0 text-[10px]">
                  {cartCount > 9 ? "9+" : cartCount}
                </Badge>
              )}
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
