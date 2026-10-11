import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import { EyeOff, MoreHorizontal, Package, Plus, Search, Star, X } from "lucide-react";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { ProductActionSheet, StockSheet, type SheetProduct } from "@/components/vendor/ProductSheets";
import { useVendorProducts } from "@/hooks/useVendorProducts";
import { useProductMutations } from "@/hooks/useProductMutations";
import { useFeaturedUntil } from "@/hooks/usePromotions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Filter = "all" | "active" | "low" | "soldout" | "hidden" | "featured";

/** Fewer pieces than this left counts as "low stock". */
const LOW_STOCK = 5;

const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

type VendorProduct = NonNullable<ReturnType<typeof useVendorProducts>["data"]>[number];

function toSheetProduct(p: VendorProduct): SheetProduct {
  return { id: p.id, name: p.name, slug: p.slug, stock_quantity: p.stock_quantity, is_active: p.is_active, image: p.product_images?.[0]?.url ?? null };
}

function StockPill({ quantity, onClick }: { quantity: number; onClick: () => void }) {
  const tone =
    quantity === 0 ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
      : quantity < LOW_STOCK ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200"
        : "bg-muted text-muted-foreground";
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); e.stopPropagation(); onClick(); }}
      className={cn("rounded-full px-2.5 py-1 text-xs font-medium tabular-nums active:scale-95", tone)}
      aria-label="Change stock"
    >
      {quantity === 0 ? "Sold out" : `${quantity} in stock`}
    </button>
  );
}

/** A seller's products: quick filters, compact rows, one tap to edit, stock and actions in bottom sheets. */
export default function VendorProducts() {
  const navigate = useNavigate();
  const { userId } = useVendorAuth();
  const { data: products, isLoading, refetch } = useVendorProducts(userId);
  const { deleteProduct, toggleProductStatus } = useProductMutations(userId);
  const { toast } = useToast();
  const { data: featuredUntil } = useFeaturedUntil(userId);

  const [search, setSearch] = useState("");
  const [searchParams] = useSearchParams();
  // Dashboard shortcuts open the list already filtered (?filter=low, ?filter=soldout...).
  const [filter, setFilter] = useState<Filter>(() => {
    const wanted = searchParams.get("filter");
    return (["all", "active", "low", "soldout", "hidden", "featured"] as const).find((f) => f === wanted) ?? "all";
  });
  const [actionsFor, setActionsFor] = useState<SheetProduct | null>(null);
  const [stockFor, setStockFor] = useState<SheetProduct | null>(null);
  const [savingStock, setSavingStock] = useState(false);
  const [deleteFor, setDeleteFor] = useState<SheetProduct | null>(null);

  const counts = useMemo(() => {
    const list = products ?? [];
    return {
      all: list.length,
      active: list.filter((p) => p.is_active && p.stock_quantity > 0).length,
      low: list.filter((p) => p.stock_quantity > 0 && p.stock_quantity < LOW_STOCK).length,
      soldout: list.filter((p) => p.stock_quantity === 0).length,
      hidden: list.filter((p) => !p.is_active).length,
      featured: list.filter((p) => p.featured).length,
    } satisfies Record<Filter, number>;
  }, [products]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.category?.name.toLowerCase().includes(q)) return false;
      switch (filter) {
        case "active": return p.is_active && p.stock_quantity > 0;
        case "low": return p.stock_quantity > 0 && p.stock_quantity < LOW_STOCK;
        case "soldout": return p.stock_quantity === 0;
        case "hidden": return !p.is_active;
        case "featured": return p.featured;
        default: return true;
      }
    });
  }, [products, search, filter]);

  const filters: { value: Filter; label: string }[] = [
    { value: "all", label: "All" },
    { value: "active", label: "On sale" },
    { value: "low", label: "Low stock" },
    { value: "soldout", label: "Sold out" },
    { value: "hidden", label: "Hidden" },
    { value: "featured", label: "Featured" },
  ];

  const saveStock = async (productId: string, quantity: number) => {
    setSavingStock(true);
    const { error } = await supabase.from("products").update({ stock_quantity: quantity }).eq("id", productId);
    setSavingStock(false);
    if (error) {
      console.error("[VendorProducts] stock update failed", { productId, error });
      toast({ title: "Couldn't update stock", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: quantity === 0 ? "Marked as sold out" : `Stock set to ${quantity}` });
    setStockFor(null);
    refetch();
  };

  return (
    <VendorLayout title="Products">
      <div className="space-y-3">
        {/* Search + add */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search your products"
              className="h-11 w-full rounded-full border bg-background pl-9 pr-9 text-[15px] outline-none focus:ring-2 focus:ring-ring"
              aria-label="Search your products"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label="Clear search">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button asChild className="h-11 shrink-0 rounded-full px-4">
            <Link to="/vendor/products/new" aria-label="Add product">
              <Plus className="h-5 w-5 sm:mr-1" /><span className="hidden sm:inline">Add product</span>
            </Link>
          </Button>
        </div>

        {/* Filter chips with counts (scroll sideways if needed, never the page) */}
        <div className="-mx-4 overflow-x-auto px-4 pb-1 scrollbar-hide md:mx-0 md:px-0">
          <div className="flex w-max gap-2">
            {filters.map((f) => {
              const active = filter === f.value;
              const count = counts[f.value];
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFilter(f.value)}
                  aria-pressed={active}
                  className={cn(
                    "flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    active ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground",
                    f.value === "low" && count > 0 && !active && "border-amber-300 text-amber-800 dark:text-amber-300",
                    f.value === "soldout" && count > 0 && !active && "border-red-200 text-red-700 dark:text-red-300",
                  )}
                >
                  {f.label}
                  <span className={cn("tabular-nums", active ? "text-primary-foreground/80" : "text-muted-foreground")}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)}
          </div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <Package className="h-7 w-7 text-muted-foreground" />
            </div>
            <p className="font-semibold">{counts.all === 0 ? "No products yet" : "Nothing here"}</p>
            <p className="mt-1 max-w-xs text-sm text-muted-foreground">
              {counts.all === 0 ? "Add your first kaftan so customers can find your shop." : "Try another filter or search."}
            </p>
            {counts.all === 0 && (
              <Button asChild className="mt-5 rounded-full">
                <Link to="/vendor/products/new"><Plus className="mr-1.5 h-4 w-4" />Add your first product</Link>
              </Button>
            )}
          </div>
        ) : (
          <ul className="grid gap-2 md:grid-cols-2">
            {visible.map((p) => {
              const image = p.product_images?.[0]?.url;
              const until = featuredUntil?.get(p.id);
              return (
                <li key={p.id}>
                  <div
                    role="link"
                    tabIndex={0}
                    onClick={() => navigate(`/vendor/products/${p.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && navigate(`/vendor/products/${p.id}`)}
                    className={cn(
                      "flex cursor-pointer items-center gap-3 rounded-2xl border bg-card p-2.5 transition-colors active:bg-muted/60",
                      !p.is_active && "opacity-70",
                    )}
                  >
                    <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl bg-muted">
                      {image ? (
                        <img src={image} alt="" loading="lazy" className={cn("h-full w-full object-cover", p.stock_quantity === 0 && "grayscale")} />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center"><Package className="h-6 w-6 text-muted-foreground/50" /></span>
                      )}
                      {p.featured && (
                        <span className="absolute left-1 top-1 rounded-full bg-amber-500 p-1 text-white shadow" title={until ? `Featured until ${format(new Date(until), "d MMM")}` : "Featured"}>
                          <Star className="h-3 w-3 fill-current" />
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-[15px] font-medium leading-snug">{p.name}</p>
                      <p className="mt-0.5 text-sm font-semibold">
                        {naira(p.price)}
                        {p.compare_at_price && p.compare_at_price > p.price && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground line-through">{naira(p.compare_at_price)}</span>
                        )}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <StockPill quantity={p.stock_quantity} onClick={() => setStockFor(toSheetProduct(p))} />
                        {!p.is_active && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                            <EyeOff className="h-3 w-3" />Hidden
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); setActionsFor(toSheetProduct(p)); }}
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-muted-foreground active:bg-muted"
                      aria-label={`More for ${p.name}`}
                    >
                      <MoreHorizontal className="h-5 w-5" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <ProductActionSheet
        product={actionsFor}
        onClose={() => setActionsFor(null)}
        onEditStock={() => actionsFor && setStockFor(actionsFor)}
        onMarkSoldOut={() => actionsFor && saveStock(actionsFor.id, 0)}
        onToggleVisible={() => actionsFor && toggleProductStatus.mutate({ productId: actionsFor.id, isActive: !actionsFor.is_active })}
        onDelete={() => actionsFor && setDeleteFor(actionsFor)}
      />

      <StockSheet
        product={stockFor}
        saving={savingStock}
        onClose={() => setStockFor(null)}
        onSave={(quantity) => stockFor && saveStock(stockFor.id, quantity)}
      />

      <AlertDialog open={!!deleteFor} onOpenChange={(open) => !open && setDeleteFor(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-2xl md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this product?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteFor?.name}" will be removed from your shop for good. To take it down for a while, hide it instead.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteFor) deleteProduct.mutate(deleteFor.id);
                setDeleteFor(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VendorLayout>
  );
}
