import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Search, Store, X } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopTile } from "@/components/shop/ShopTile";
import {
  useBrowseShops, useShopFilterCounts,
  type ShopBadgeFilter, type ShopFilterCounts, type ShopTypeFilter,
} from "@/hooks/useShops";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 300;
/** Start loading the next page this far before the end of the list. */
const PRELOAD_MARGIN = "600px";
const SKELETON_TILES = 6;

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

const isBadge = (v: string | null): v is ShopBadgeFilter => BADGES.some((b) => b.value === v);
const isType = (v: string | null): v is ShopTypeFilter => TYPES.some((t) => t.value === v);

function badgeCount(counts: ShopFilterCounts | undefined, key: ShopBadgeFilter): number | undefined {
  return counts?.[key];
}

function typeCount(counts: ShopFilterCounts | undefined, key: ShopTypeFilter): number | undefined {
  return counts?.[key === "all" ? "everyone" : key];
}

export default function Shops() {
  const [params, setParams] = useSearchParams();
  const badge: ShopBadgeFilter = isBadge(params.get("badge")) ? (params.get("badge") as ShopBadgeFilter) : "all";
  const type: ShopTypeFilter = isType(params.get("type")) ? (params.get("type") as ShopTypeFilter) : "all";
  const [input, setInput] = useState(params.get("q") ?? "");
  const [search, setSearch] = useState(input.trim());

  const { data, isLoading, isError, refetch, fetchNextPage, hasNextPage, isFetchingNextPage } = useBrowseShops({ search, badge, type });
  const { data: counts } = useShopFilterCounts({ search, badge, type });
  const shops = data?.pages.flat() ?? [];
  const sentinel = useRef<HTMLDivElement>(null);

  useDocumentMeta({
    title: "Shops - Kano Kaftan",
    description: "Browse tailors and sellers on Kano Kaftan: verified and gold shops, clothing, fabrics, shoes, caps and accessories.",
  });

  // Search as you type, and keep it in the address so Back returns to the same list.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (search) next.set("q", search); else next.delete("q");
      return next;
    }, { replace: true });
  }, [search, setParams]);

  // Load the next page when the end of the list comes into view.
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

  const setFilter = (key: "badge" | "type", value: string) =>
    setParams((prev) => {
      const next = new URLSearchParams(prev);
      if (value === "all") next.delete(key); else next.set(key, value);
      return next;
    }, { replace: true });

  const filtered = badge !== "all" || type !== "all" || !!search;
  const clearAll = () => {
    setInput("");
    setSearch("");
    setParams({}, { replace: true });
  };

  return (
    <MobileLayout>
      <div className="space-y-3 px-4 pb-24 pt-4">
        <div>
          <h1 className="font-display text-xl font-bold">Shops</h1>
          <p className="text-sm text-muted-foreground">
            {counts ? `${counts.total.toLocaleString()} tailors and sellers on Kano Kaftan` : "Tailors and sellers on Kano Kaftan"}
          </p>
        </div>

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

        {/* Shop type */}
        <div role="tablist" aria-label="Shop type" className="grid grid-cols-3 rounded-full bg-muted p-1">
          {TYPES.map((t) => {
            const n = typeCount(counts, t.value);
            return (
              <button
                key={t.value}
                type="button"
                role="tab"
                aria-selected={type === t.value}
                onClick={() => setFilter("type", t.value)}
                className={cn("h-9 rounded-full text-[13px] font-medium transition-all", type === t.value ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                {t.label}{n !== undefined && t.value !== "all" && <span className="ml-1 text-muted-foreground">{n}</span>}
              </button>
            );
          })}
        </div>

        {/* Badge */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Filter by badge">
          {BADGES.map((b) => {
            const n = badgeCount(counts, b.value);
            const active = badge === b.value;
            return (
              <button
                key={b.value}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter("badge", b.value)}
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
              {shops.map((shop) => <ShopTile key={shop.id} shop={shop} />)}
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
