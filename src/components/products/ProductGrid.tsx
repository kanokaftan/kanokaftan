import { ProductCard } from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/hooks/useProducts";

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  onQuickView?: (product: Product) => void;
}

function ProductSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border-0 shadow-sm">
      <Skeleton className="aspect-[3/4] w-full rounded-xl" />
      <div className="p-3">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="mt-2 h-4 w-full" />
        <Skeleton className="mt-2 h-5 w-20" />
      </div>
    </div>
  );
}

export function ProductGrid({ products, isLoading, onQuickView }: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <ProductSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed p-8 text-center">
        <p className="text-lg font-medium text-muted-foreground">No products found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Try adjusting your search or filter criteria
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard 
          key={product.id} 
          product={product} 
          onQuickView={onQuickView}
        />
      ))}
    </div>
  );
}
