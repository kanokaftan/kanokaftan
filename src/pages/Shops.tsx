import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, LocateFixed, Search, Store, X } from "lucide-react";
import { toast } from "sonner";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopTile } from "@/components/shop/ShopTile";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import {
  useBrowseShops, useGoldShops, useShopFilterCounts, useShopTowns,
  type ShopBadgeFilter, type ShopFilterCounts, type ShopSort, type ShopTypeFilter,
} from "@/hooks/useShops";
import { useNearMe } from "@/hooks/useNearMe";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 300;
/** Start loading the next page this far before the end of the list. */
const PRELOAD_MARGIN = "600px";
const SKELETON_TILES = 6;
const ALL_TOWNS = "__all";

const BADGES: { value: ShopBadgeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "gold", label: "Gold" },
  { value: "verified", label: "Verified" },
  { value: "unverified", label: "Not verified" },
];

const TYPES: { value: ShopTypeFilter; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "tailor", label: "Tailors" },
  { value: "seller", label: "Sellers" },
];

const SORTS: { value: ShopSort; label: string }[] = [
  { value: "recommended", label: "Recommended" },
  { value: "near", label: "Nearest to me" },
  { value: "followers", label: "Most followed" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
];

const isBadge = (v: string | null): v is ShopBadgeFilter => BADGES.some((b) => b.value === v);
const isType = (v: string | null): v is ShopTypeFilter => TYPES.some((t) => t.value === v);
const isSort = (v: string | null): v is ShopSort => SORTS.some((s) => s.value === v);

const badgeCount = (counts: ShopFilterCounts | undefined, key: ShopBadgeFilter) => counts?.[key];
const typeCount = (counts: ShopFilterCounts | undefined, key: ShopTypeFilter) => counts?.[key === "all" ? "everyone" : key];

/** Gold shops in a row of round logos, like stories. */
function GoldStrip() {
  const { data: gold } = useGoldShops();
  if (!gold?.length) return null;
  return (
    <section aria-label="Gold shops">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#9A7400]">Gold shops</p>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {gold.map((shop) => (
          <Link key={shop.id} to={`/shop/${shop.store_slug}`} className="flex w-[68px] shrink-0 flex-col items-center gap-1 active:opacity-70">
            <Avatar className="h-[60px] w-[60px] ring-2 ring-[#9A7400] ring-offset-2 ring-offset-background">
              <AvatarImage src={shop.avatar_url || undefined} alt="" loading="lazy" />
              <AvatarFallback className="bg-primary font-bold text-primary-foreground">{shop.store_name.charAt(0)}</AvatarFallback>
            </Avatar>
            <span className="flex w-full items-center justify-center gap-0.5">
              <span className="truncate text-[11px] font-medium">{shop.store_name}</span>
              <VerifiedBadge tier="gold" className="h-3 w-3" />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function Shops() {
  const [params, setParams] = useSearchParams();
  const badge: ShopBadgeFilter = isBadge(params.get("badge")) ? (params.get("badge") as ShopBadgeFilter) : "all";
  const type: ShopTypeFilter = isType(params.get("type")) ? (params.get("type") as ShopTypeFilter) : "all";
  const requestedSort: ShopSort = isSort(params.get("sort")) ? (params.get("sort") as ShopSort) : "recommended";
  const town = params.get("town") || null;
  const [input, setInput] = useState(params.get("q") ?? "");
  const [search, setSearch] = useState(input.trim());
  const nearMe = useNearMe();
  // "Nearest" needs a position; until we have one, keep the normal order.
  const sort: ShopSort = requestedSort === "near" && !nearMe.position ? "recommended" : requestedSort;

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useBrowseShops({
    search, badge, type, town, sort, position: nearMe.position,
  });
  const { data: counts } = useShopFilterCounts({ search, badge, type, town });
  const { data: towns } = useShopTowns();
  const shops = data?.pages.flat() ?? [];
  const sentinel = useRef<HTMLDivElement>(null);
  const filtered = badge !== "all" || type !== "all" || !!search || !!town;

  useDocumentMeta({
    title: "Shops - Kano Kaftan",
    description: "Browse tailors and sellers on Kano Kaftan: shops near you, verified and gold shops, clothing, fabrics, shoes, caps and accessories.",
  });

  const updateParams = (changes: Record<string, string | null>) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [key, value] of Object.entries(changes)) {
        if (value === null || value === "" || value === "all" || value === "recommended") next.delete(key);
        else next.set(key, value);
      }
      return next;
    }, { replace: true });

  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    updateParams({ q: search || null });
    // updateParams only wraps setParams, which is stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Opening a shared "?sort=near" link asks for the position once.
  useEffect(() => {
    if (requestedSort === "near" && !nearMe.position && nearMe.status === "idle") nearMe.locate();
  }, [requestedSort, nearMe]);

  useEffect(() => {
    const node = sentinel.current;
    if (!node || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) fetchNextPage();
      },
      { rootMargin: PRELOAD_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, shops.length]);

  const chooseSort = async (value: ShopSort) => {
    if (value !== "near") {
      updateParams({ sort: value });
      return;
    }
    const result = nearMe.position ? { position: nearMe.position, status: "ready" as const } : await nearMe.locate();
    if (result.position) {
      updateParams({ sort: "near" });
    } else {
      toast.error(
        result.status === "denied"
          ? "Location is turned off for Kano Kaftan. Allow it in your phone's settings to see shops near you."
          : "Couldn't find your location. Check that location is on and try again.",
      );
    }
  };

  const clearAll = () => {
    setInput("");
    setSearch("");
    setParams({}, { replace: true });
  };

  const showingNear = sort === "near";

  return (
    <MobileLayout>
      <div className="space-y-3 px-4 pb-24 pt-4">
        <div>
          <h1 className="font-display text-xl font-bold">Shops</h1>
          <p className="text-sm text-muted-foreground">
            {counts ? `${counts.total.toLocaleString()} tailors and sellers on Kano Kaftan` : "Tailors and sellers on Kano Kaftan"}
          </p>
        </div>

        {!filtered && !showingNear && <GoldStrip />}

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search shops or towns"
            className="h-11 rounded-full pl-9 pr-9"
            aria-label="Search shops"
          />
          {input && (
            <button type="button" onClick={() => setInput("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground" aria-label="Clear search">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div role="tablist" aria-label="Shop type" className="grid grid-cols-3 rounded-full bg-muted p-1">
          {TYPES.map((t) => {
            const n = typeCount(counts, t.value);
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={type === t.value}
                onClick={() => updateParams({ type: t.value })}
                className={cn("h-9 rounded-full text-[13px] font-medium transition-all", type === t.value ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                {t.label}{n !== undefined && t.value !== "all" && <span className="ml-1 text-muted-foreground">{n}</span>}
              </button>
            );
          })}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filter shops">
          <button
            type="button"
            aria-pressed={showingNear}
            onClick={() => (showingNear ? updateParams({ sort: null }) : chooseSort("near"))}
            className={cn(
              "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
              showingNear ? "border-foreground bg-foreground text-background" : "bg-background",
            )}
          >
            {nearMe.status === "locating" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
            Near me
          </button>
          {BADGES.map((b) => {
            const n = badgeCount(counts, b.value);
            const active = badge === b.value;
            return (
              <button
                key={b.value}
                type="button"
                aria-pressed={active}
                onClick={() => updateParams({ badge: b.value })}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors",
                  active ? "border-foreground bg-foreground text-background" : "bg-background text-foreground",
                )}
              >
                {b.value === "gold" && <span className="h-2 w-2 rounded-full bg-[#9A7400]" aria-hidden="true" />}
                {b.value === "verified" && <span className="h-2 w-2 rounded-full bg-[#1D9BF0]" aria-hidden="true" />}
                {b.label}
                {n !== undefined && <span className={cn("tabular-nums", active ? "text-background/70" : "text-muted-foreground")}>{n}</span>}
              </button>
            );
          })}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Select value={town ?? ALL_TOWNS} onValueChange={(v) => updateParams({ town: v === ALL_TOWNS ? null : v })}>
            <SelectTrigger className="h-10 rounded-full text-[13px]" aria-label="Town"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_TOWNS}>All towns</SelectItem>
              {(towns ?? []).map((t) => <SelectItem key={t.town} value={t.town}>{t.town} ({t.shops})</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={(v) => chooseSort(v as ShopSort)}>
            <SelectTrigger className="h-10 rounded-full text-[13px]" aria-label="Sort shops"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {showingNear && (
          <p className="text-xs text-muted-foreground">
            Closest first. Exact distances show for shops that saved their exact spot; others are placed by their town.
          </p>
        )}

        {isLoading ? (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: SKELETON_TILES }, (_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
            <p>Couldn't load shops.</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : !shops.length ? (
          <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
            <Store className="mb-3 h-12 w-12 opacity-50" />
            <p>{filtered ? "No shops match these filters." : "No shops yet."}</p>
            {filtered && <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={clearAll}>Show all shops</Button>}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
              {shops.map((shop) => <ShopTile key={shop.id} shop={shop} showDistance={showingNear} />)}
            </div>
            <div ref={sentinel} className="flex justify-center py-4">
              {isFetchingNextPage ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : hasNextPage ? (
                <Button variant="ghost" size="sm" onClick={() => fetchNextPage()}>Show more shops</Button>
              ) : shops.length > SKELETON_TILES ? (
                <p className="text-xs text-muted-foreground">That's every shop{filtered ? " for these filters" : ""}.</p>
              ) : null}
            </div>
          </>
        )}
      </div>
    </MobileLayout>
  );
}
