import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, Loader2, LocateFixed, Search, SlidersHorizontal, Store, X } from "lucide-react";
import { toast } from "sonner";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
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

/** The few filters people use most, one tap away. The rest live in the Filters sheet. */
const QUICK_CHIPS: { kind: "badge" | "type"; value: string; label: string; dot?: string }[] = [
  { kind: "badge", value: "gold", label: "Gold", dot: "bg-[#9A7400]" },
  { kind: "badge", value: "verified", label: "Verified", dot: "bg-[#1D9BF0]" },
  { kind: "type", value: "tailor", label: "Tailors" },
  { kind: "type", value: "seller", label: "Sellers" },
];

const sortLabel = (value: ShopSort) => SORTS.find((s) => s.value === value)?.label ?? "Recommended";

const isBadge = (v: string | null): v is ShopBadgeFilter => BADGES.some((b) => b.value === v);
const isType = (v: string | null): v is ShopTypeFilter => TYPES.some((t) => t.value === v);
const isSort = (v: string | null): v is ShopSort => SORTS.some((s) => s.value === v);

const badgeCount = (counts: ShopFilterCounts | undefined, key: ShopBadgeFilter) => counts?.[key];
const typeCount = (counts: ShopFilterCounts | undefined, key: ShopTypeFilter) => counts?.[key === "all" ? "everyone" : key];

/** One pill in the quick filter bar. Removable chips show an x. */
function Chip({ active, onClick, removable = false, children }: { active: boolean; onClick: () => void; removable?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors active:scale-95",
        active ? "border-foreground bg-foreground text-background" : "bg-background text-foreground",
      )}
    >
      {children}
      {removable && <X className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />}
    </button>
  );
}

/** A tappable row in the Filters sheet with a tick when chosen. */
function OptionRow({ selected, onClick, label, count }: { selected: boolean; onClick: () => void; label: React.ReactNode; count?: number }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "flex h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-sm transition-colors active:bg-muted",
        selected && "bg-muted font-semibold",
      )}
    >
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count !== undefined && <span className="tabular-nums text-muted-foreground">{count}</span>}
      <Check className={cn("h-4 w-4 shrink-0", selected ? "opacity-100" : "opacity-0")} />
    </button>
  );
}

function SheetSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <div role="radiogroup" aria-label={title} className="space-y-0.5">{children}</div>
    </section>
  );
}

/** Gold shops in a row of round logos, like stories. */
function GoldStrip() {
  const { data: gold } = useGoldShops();
  if (!gold?.length) return null;
  return (
    <section aria-label="Gold shops">
      <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[#9A7400]">Gold shops</p>
      <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {gold.map((shop) => (
          <Link key={shop.id} to={`/shop/${shop.store_slug}`} className="flex w-[60px] shrink-0 flex-col items-center gap-1 active:opacity-70">
            <Avatar className="h-[52px] w-[52px] ring-2 ring-[#9A7400] ring-offset-2 ring-offset-background">
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
  const [sheetOpen, setSheetOpen] = useState(false);
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
  /** Filters set in the sheet (search and "Near me" have their own controls). */
  const activeFilterCount = [badge !== "all", type !== "all", !!town, sort !== "recommended" && sort !== "near"].filter(Boolean).length;
  // Counts are contextual: the current badge's number is the number of matching shops.
  const resultCount = counts?.[badge];

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

  const resetSheetFilters = () => updateParams({ badge: null, type: null, town: null, sort: showingNear ? "near" : null });

  return (
    <MobileLayout>
      <div className="space-y-3 px-4 pb-24 pt-4">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="font-display text-xl font-bold">Shops</h1>
          {typeof resultCount === "number" && (
            <p className="text-xs tabular-nums text-muted-foreground">
              {resultCount.toLocaleString()} {resultCount === 1 ? "shop" : "shops"}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              enterKeyHint="search"
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
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className={cn(
              "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border bg-background transition-colors active:scale-95",
              activeFilterCount > 0 && "border-foreground",
            )}
            aria-label={activeFilterCount > 0 ? `Filters (${activeFilterCount} on)` : "Filters"}
          >
            <SlidersHorizontal className="h-[18px] w-[18px]" />
            {activeFilterCount > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-foreground px-1 text-[10px] font-semibold text-background">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label="Quick filters">
          <Chip active={showingNear} onClick={() => (showingNear ? updateParams({ sort: null }) : chooseSort("near"))}>
            {nearMe.status === "locating" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LocateFixed className="h-3.5 w-3.5" />}
            Near me
          </Chip>
          {QUICK_CHIPS.map((chip) => {
            const active = chip.kind === "badge" ? badge === chip.value : type === chip.value;
            const toggle = () =>
              chip.kind === "badge"
                ? updateParams({ badge: active ? null : chip.value })
                : updateParams({ type: active ? null : chip.value });
            return (
              <Chip key={chip.value} active={active} onClick={toggle}>
                {chip.dot && <span className={cn("h-2 w-2 rounded-full", chip.dot)} aria-hidden="true" />}
                {chip.label}
              </Chip>
            );
          })}
          {badge === "unverified" && (
            <Chip active onClick={() => updateParams({ badge: null })} removable>Not verified</Chip>
          )}
          {town && (
            <Chip active onClick={() => updateParams({ town: null })} removable>{town}</Chip>
          )}
          {sort !== "recommended" && sort !== "near" && (
            <Chip active onClick={() => updateParams({ sort: null })} removable>{sortLabel(sort)}</Chip>
          )}
        </div>

        {!filtered && !showingNear && <GoldStrip />}

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

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetContent side="bottom" className="flex max-h-[85dvh] flex-col gap-0 rounded-t-3xl p-0">
          <SheetHeader className="border-b px-5 pb-3 pt-5 text-left">
            <SheetTitle>Filter shops</SheetTitle>
            <SheetDescription className="sr-only">Choose shop type, badge, town and order.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            <SheetSection title="Shop type">
              {TYPES.map((t) => (
                <OptionRow key={t.value} selected={type === t.value} onClick={() => updateParams({ type: t.value })} label={t.label} count={typeCount(counts, t.value)} />
              ))}
            </SheetSection>
            <SheetSection title="Badge">
              {BADGES.map((b) => (
                <OptionRow
                  key={b.value}
                  selected={badge === b.value}
                  onClick={() => updateParams({ badge: b.value })}
                  count={badgeCount(counts, b.value)}
                  label={
                    <span className="flex items-center gap-2">
                      {b.value === "gold" && <span className="h-2 w-2 rounded-full bg-[#9A7400]" aria-hidden="true" />}
                      {b.value === "verified" && <span className="h-2 w-2 rounded-full bg-[#1D9BF0]" aria-hidden="true" />}
                      {b.label}
                    </span>
                  }
                />
              ))}
            </SheetSection>
            <SheetSection title="Sort by">
              {SORTS.map((s) => (
                <OptionRow key={s.value} selected={sort === s.value} onClick={() => chooseSort(s.value)} label={s.label} />
              ))}
            </SheetSection>
            <SheetSection title="Town">
              <OptionRow selected={!town} onClick={() => updateParams({ town: null })} label="All towns" />
              {(towns ?? []).map((t) => (
                <OptionRow key={t.town} selected={town === t.town} onClick={() => updateParams({ town: t.town })} label={t.town} count={t.shops} />
              ))}
            </SheetSection>
          </div>
          <div className="flex gap-2 border-t px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3">
            <Button variant="outline" className="h-11 flex-1 rounded-full" onClick={resetSheetFilters} disabled={activeFilterCount === 0}>
              Reset
            </Button>
            <Button className="h-11 flex-[2] rounded-full" onClick={() => setSheetOpen(false)}>
              {typeof resultCount === "number" ? `Show ${resultCount.toLocaleString()} ${resultCount === 1 ? "shop" : "shops"}` : "Show shops"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </MobileLayout>
  );
}
