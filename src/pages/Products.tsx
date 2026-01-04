import { useSearchParams } from "react-router-dom";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ProductGrid } from "@/components/products/ProductGrid";
import { ProductFilters } from "@/components/products/ProductFilters";
import { ProductSearch } from "@/components/products/ProductSearch";
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
    <div className="flex min-h-screen flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Header */}
        <section className="border-b bg-muted/30 py-8">
          <div className="container">
            <h1 className="font-display text-3xl font-bold text-foreground md:text-4xl">
              Shop Traditional Attire
            </h1>
            <p className="mt-2 text-muted-foreground">
              Discover authentic Nigerian fashion from trusted vendors
            </p>
          </div>
        </section>

        {/* Filters & Search */}
        <section className="border-b py-4">
          <div className="container flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <ProductFilters categories={categories} isLoading={categoriesLoading} />
            <ProductSearch />
          </div>
        </section>

        {/* Products Grid */}
        <section className="py-8">
          <div className="container">
            {search && (
              <p className="mb-6 text-muted-foreground">
                Showing results for "<span className="font-medium text-foreground">{search}</span>"
              </p>
            )}
            
            <ProductGrid products={products} isLoading={productsLoading} />
            
            {!productsLoading && products.length > 0 && (
              <div className="mt-8">
                <ProductPagination
                  currentPage={page}
                  totalPages={totalPages}
                  total={total}
                />
              </div>
            )}
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
