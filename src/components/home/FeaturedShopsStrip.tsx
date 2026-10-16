import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";

const FEATURED_SHOPS_LIMIT = 20;
/** Each loop half holds at least this many logos so the strip is always wider than the screen. */
const MIN_LOGOS_PER_LOOP = 10;
const SECONDS_PER_LOGO = 2.5;
const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

interface FeaturedShop {
  id: string;
  store_name: string;
  store_slug: string;
  avatar_url: string;
  verification_tier: string;
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" && typeof window.matchMedia === "function"
      ? window.matchMedia(REDUCED_MOTION_QUERY).matches
      : false,
  );

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(REDUCED_MOTION_QUERY);
    const onChange = () => setReduced(media.matches);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function useFeaturedShops() {
  return useQuery({
    queryKey: ["featured-shops", FEATURED_SHOPS_LIMIT],
    queryFn: async (): Promise<FeaturedShop[]> => {
      const { data, error } = await supabase.rpc("featured_shop_strip", { p_limit: FEATURED_SHOPS_LIMIT });
      if (error) {
        console.error("[FeaturedShopsStrip] Failed to load featured shops", error);
        throw error;
      }
      return (data || []).filter((shop) => shop.store_slug && shop.avatar_url);
    },
    staleTime: REFRESH_INTERVAL_MS,
  });
}

function ShopLogo({ shop, hidden = false, className }: { shop: FeaturedShop; hidden?: boolean; className?: string }) {
  return (
    <Link
      to={`/shop/${shop.store_slug}`}
      aria-hidden={hidden || undefined}
      tabIndex={hidden ? -1 : undefined}
      className={cn("group flex w-20 flex-shrink-0 flex-col items-center gap-1.5 focus-visible:outline-none", className)}
    >
      <span className="relative block h-16 w-16 rounded-full bg-gradient-to-br from-primary to-primary/40 p-[2px] transition-transform group-hover:scale-105 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <img
          src={shop.avatar_url}
          alt={hidden ? "" : shop.store_name}
          loading="lazy"
          className="h-full w-full rounded-full border-2 border-background bg-card object-cover"
        />
        <VerifiedBadge className="absolute -bottom-0.5 -right-0.5 h-5 w-5" tier={shop.verification_tier} />
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium text-foreground">{shop.store_name}</span>
    </Link>
  );
}

/** Homepage strip of paid "featured shop" logos that slides continuously. */
export function FeaturedShopsStrip() {
  const { t } = useTranslation();
  const { data: shops = [], isError } = useFeaturedShops();
  const reducedMotion = usePrefersReducedMotion();
  const [touchPaused, setTouchPaused] = useState(false);

  if (isError || shops.length === 0) return null;

  const header = (
    <div className="mb-3 flex items-center justify-between px-4">
      <h2 className="font-display text-base font-bold text-foreground">
        {t("home.featuredShops", "Featured shops")}
      </h2>
      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
        {t("home.sponsored", "Sponsored")}
      </span>
    </div>
  );

  if (reducedMotion) {
    return (
      <section className="py-3" aria-label={t("home.featuredShops", "Featured shops")}>
        {header}
        <div className="flex gap-3 overflow-x-auto px-4 py-1 scrollbar-hide">
          {shops.map((shop) => <ShopLogo key={shop.id} shop={shop} />)}
        </div>
      </section>
    );
  }

  // Repeat the list so one half of the track is always wider than the viewport,
  // then render that half twice and slide by -50% for a seamless loop.
  const repeats = Math.max(1, Math.ceil(MIN_LOGOS_PER_LOOP / shops.length));
  const loop = Array.from({ length: repeats }, () => shops).flat();
  const durationSeconds = loop.length * SECONDS_PER_LOGO;

  return (
    <section className="py-3" aria-label={t("home.featuredShops", "Featured shops")}>
      <style>{`
        @keyframes kk-featured-shops-marquee {
          from { transform: translate3d(0, 0, 0); }
          to { transform: translate3d(-50%, 0, 0); }
        }
        .kk-featured-shops-track {
          animation: kk-featured-shops-marquee var(--kk-marquee-duration, 30s) linear infinite;
        }
        .kk-featured-shops:hover .kk-featured-shops-track,
        .kk-featured-shops:focus-within .kk-featured-shops-track,
        .kk-featured-shops-track.is-paused {
          animation-play-state: paused;
        }
        @media ${REDUCED_MOTION_QUERY} {
          .kk-featured-shops-track { animation: none !important; }
        }
      `}</style>
      {header}
      <div
        className="kk-featured-shops relative overflow-hidden"
        onTouchStart={() => setTouchPaused(true)}
        onTouchEnd={() => setTouchPaused(false)}
        onTouchCancel={() => setTouchPaused(false)}
      >
        {/* Soft fade at the edges */}
        <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-background to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-background to-transparent" />
        {/* No flex gap: each logo carries its own right margin so -50% lands exactly on the copy. */}
        <div
          className={cn("kk-featured-shops-track flex w-max pb-1", touchPaused && "is-paused")}
          style={{ "--kk-marquee-duration": `${durationSeconds}s` } as CSSProperties}
        >
          {[0, 1].map((half) =>
            loop.map((shop, index) => (
              <ShopLogo
                key={`${half}-${index}-${shop.id}`}
                shop={shop}
                className="mr-3"
                // Only the very first copy of each shop is announced / focusable.
                hidden={half === 1 || index >= shops.length}
              />
            )),
          )}
        </div>
      </div>
    </section>
  );
}
