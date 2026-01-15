import { ProductCard } from "./ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/hooks/useProducts";

interface ProductGridProps {
  products: Product[];
  isLoading?: boolean;
  onQuickView?: (product: Product) => void;
  compact?: boolean;
}

function ProductSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <div className="overflow-hidden rounded-lg border-0 shadow-sm">
      <Skeleton className={compact ? "aspect-square w-full rounded-lg" : "aspect-[3/4] w-full rounded-xl"} />
      <div className="p-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="mt-1.5 h-4 w-16" />
      </div>
    </div>
  );
}

export function ProductGrid({ products, isLoading, onQuickView, compact = true }: ProductGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => (
          <ProductSkeleton key={i} compact={compact} />
        ))}
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center">
        <p className="text-base font-medium text-muted-foreground">No products found</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Try adjusting your search or filter criteria
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {products.map((product) => (
        <ProductCard 
          key={product.id} 
          product={product} 
          onQuickView={onQuickView}
          compact={compact}
        />
      ))}
    </div>
  );
}
