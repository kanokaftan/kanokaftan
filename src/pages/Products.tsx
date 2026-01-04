import { useSearchParams } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { ProductGrid } from "@/components/products/ProductGrid";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductPagination } from "@/components/products/ProductPagination";
import { useProducts, useCategories } from "@/hooks/useProducts";

export default function Products() {
  const [searchParams] = useSearchParams();
  const categorySlug = searchParams.get("category") || undefined;
  const search = searchParams.get("search") || undefined;
  const page = parseInt(searchParams.get("page") || "1", 10);

  const { data: categoriesData, isLoading: categoriesLoading } = useCategories();
  const { data: productsData, isLoading: productsLoading } = useProducts({
    categorySlug,
    search,
    page,
    limit: 12,
  });

  const categories = categoriesData || [];
  const products = productsData?.products || [];
  const totalPages = productsData?.totalPages || 1;
  const total = productsData?.total || 0;

  return (
    <MobileLayout>
      {/* Header */}
      <section className="border-b bg-muted/30 py-6">
        <div className="px-4">
          <h1 className="font-display text-xl font-bold text-foreground">
            {categorySlug ? categories.find(c => c.slug === categorySlug)?.name || 'Products' : 'All Products'}
          </h1>
          {search && (
            <p className="mt-1 text-sm text-muted-foreground">
              Results for "{search}"
            </p>
          )}
        </div>
      </section>

      {/* Category Filters */}
      <section className="border-b">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="px-4 py-3">
            <ProductFilters categories={categories} isLoading={categoriesLoading} />
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="px-4 py-6">
        <ProductGrid products={products} isLoading={productsLoading} />
        
        {!productsLoading && products.length > 0 && (
          <div className="mt-6">
            <ProductPagination
              currentPage={page}
              totalPages={totalPages}
              total={total}
            />
          </div>
        )}
      </section>
    </MobileLayout>
  );
}
