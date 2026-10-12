import { Link } from "react-router-dom";
import { BadgeCheck, MapPin, Star } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { Shop } from "@/hooks/useShops";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";

export function ShopCard({ shop, compact = false }: { shop: Shop; compact?: boolean }) {
  return (
    <Link
      to={`/shop/${shop.store_slug}`}
      className={cn("block overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md", compact && "w-56 flex-shrink-0")}
    >
      <div className="h-20 bg-gradient-to-br from-primary/20 via-primary/10 to-muted">
        {shop.store_banner_url && (
          <img src={shop.store_banner_url} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
      </div>
      <div className="-mt-7 px-3 pb-3">
        <Avatar className="h-14 w-14 border-4 border-card">
          <AvatarImage src={shop.avatar_url || undefined} alt={shop.store_name} />
          <AvatarFallback className="bg-primary text-primary-foreground font-bold">
            {shop.store_name.charAt(0)}
          </AvatarFallback>
        </Avatar>
        <div className="mt-1 flex items-center gap-1">
          <h3 className="truncate font-semibold">{shop.store_name}</h3>
          {shop.is_verified && <VerifiedBadge tier={shop.verification_tier} />}
        </div>
        {(shop.city || shop.state) && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {[shop.city, shop.state].filter(Boolean).join(", ")}
          </p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
          <span>{shop.product_count} products</span>
          <span>{shop.follower_count} followers</span>
          {shop.rating !== null && (
            <span className="flex items-center gap-0.5">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              {Number(shop.rating).toFixed(1)}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
