import { Link } from "react-router-dom";
import { MapPin, Scissors, ShoppingBag, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import type { DirectoryShop } from "@/hooks/useShops";
import { cn } from "@/lib/utils";

/** Below this, distances read better in metres. */
const METRES_BELOW_KM = 1;

function formatDistance(km: number): string {
  return km < METRES_BELOW_KM ? `${Math.max(100, Math.round((km * 1000) / 100) * 100)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/** Small shop card for the directory grid: two per row on a phone. */
export function ShopTile({ shop, showDistance = false }: { shop: DirectoryShop; showDistance?: boolean }) {
  const gold = shop.verification_tier === "gold";
  const tailor = shop.shop_type === "tailor";
  const place = shop.city || shop.state;

  return (
    <Link
      to={`/shop/${shop.store_slug}`}
      className={cn(
        "group flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow active:scale-[0.99] hover:shadow-md",
        gold && "border-[#9A7400]/40",
      )}
    >
      <div className="relative h-14 bg-gradient-to-br from-primary/15 via-primary/5 to-muted">
        {shop.store_banner_url && (
          <img src={shop.store_banner_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        )}
      </div>
      <div className="-mt-6 flex flex-1 flex-col px-2.5 pb-2.5">
        <Avatar className={cn("h-12 w-12 border-[3px] border-card", gold && "ring-2 ring-[#9A7400]/60")}>
          <AvatarImage src={shop.avatar_url || undefined} alt="" loading="lazy" />
          <AvatarFallback className="bg-primary text-sm font-bold text-primary-foreground">{shop.store_name.charAt(0)}</AvatarFallback>
        </Avatar>
        <div className="mt-1 flex min-w-0 items-center gap-1">
          <h3 className="truncate text-sm font-semibold leading-tight">{shop.store_name}</h3>
          {shop.is_verified && <VerifiedBadge tier={shop.verification_tier} className="h-3.5 w-3.5" />}
        </div>
        <p className="mt-0.5 flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
          {tailor ? <Scissors className="h-3 w-3 shrink-0" /> : <ShoppingBag className="h-3 w-3 shrink-0" />}
          <span className="shrink-0">{tailor ? "Tailor" : "Seller"}</span>
          {showDistance && shop.distance_km != null ? (
            <>
              <span aria-hidden="true">·</span>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate font-medium text-foreground">{formatDistance(shop.distance_km)}</span>
            </>
          ) : place && (
            <>
              <span aria-hidden="true">·</span>
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{place}</span>
            </>
          )}
        </p>
        <div className="mt-auto flex items-center gap-2 overflow-hidden whitespace-nowrap pt-1.5 text-[11px] text-muted-foreground">
          <span className="shrink-0">{shop.product_count} items</span>
          {shop.rating !== null && (
            <span className="flex shrink-0 items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              {Number(shop.rating).toFixed(1)}
            </span>
          )}
          {shop.follower_count > 0 && <span className="truncate">{shop.follower_count} followers</span>}
        </div>
      </div>
    </Link>
  );
}
