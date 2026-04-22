import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Grid2X2, LayoutGrid } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { ProductGrid } from "@/components/products/ProductGrid";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductPagination } from "@/components/products/ProductPagination";
import { QuickViewModal } from "@/components/products/QuickViewModal";
import { RecentlyViewed } from "@/components/products/RecentlyViewed";
import { useProducts, useCategories, type Product } from "@/hooks/useProducts";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

export default function Products() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const categorySlug = searchParams.get("category") || undefined;
  const search = searchParams.get("search") || undefined;
  const featured = searchParams.get("featured") === "true";
  const page = parseInt(searchParams.get("page") || "1", 10);
  const [quickViewProduct, setQuickViewProduct] = useState<Product | null>(null);

  // Grid density preference - persisted in localStorage
  const [isCompactGrid, setIsCompactGrid] = useState(() => {
    const saved = localStorage.getItem("products-page-compact");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("products-page-compact", String(isCompactGrid));
  }, [isCompactGrid]);

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();
  const { data: productsData, isLoading: productsLoading } = useProducts({
    categorySlug,
    search,
    featured: featured || undefined,
    page,
    limit: 16,
  });

  const categories = categoriesData || [];
  const products = productsData?.products || [];
  const totalPages = productsData?.totalPages || 1;
  const total = productsData?.total || 0;

  const pageTitle = featured
    ? t("products.featuredProducts")
    : categorySlug
    ? categories.find(c => c.slug === categorySlug)?.name || t("products.title")
    : t("products.allProducts");

  return (
    <MobileLayout>
      {/* Header */}
      <section className="border-b bg-muted/30 py-4">
        <div className="px-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-display text-lg font-bold text-foreground">
                {pageTitle}
              </h1>
              {search && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {t("products.resultsFor")} "{search}"
                </p>
              )}
              {!productsLoading && (
                <p className="text-xs text-muted-foreground">
                  {total} {total === 1 ? t("products.product") : t("products.results")}
                </p>
              )}
            </div>

            {/* Grid Toggle */}
            <div className="flex items-center rounded-lg border bg-muted/50 p-0.5">
              <button
                onClick={() => setIsCompactGrid(true)}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  isCompactGrid
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Compact grid"
              >
                <Grid2X2 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setIsCompactGrid(false)}
                className={cn(
                  "rounded-md p-1.5 transition-colors",
                  !isCompactGrid
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Large grid"
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Category Filters */}
      <section className="border-b">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="px-4 py-2">
            <ProductFilters categories={categories} isLoading={categoriesLoading} />
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="px-4 py-4">
        <ProductGrid
          products={products}
          isLoading={productsLoading}
          onQuickView={setQuickViewProduct}
          compact={isCompactGrid}
        />

        {!productsLoading && products.length > 0 && (
          <div className="mt-4">
            <ProductPagination
              currentPage={page}
              totalPages={totalPages}
              total={total}
            />
          </div>
        )}
      </section>

      {/* Recently Viewed */}
      <RecentlyViewed />

      {/* Quick View Modal */}
      <QuickViewModal
        product={quickViewProduct}
        open={!!quickViewProduct}
        onOpenChange={(open) => !open && setQuickViewProduct(null)}
      />
    </MobileLayout>
  );
}
