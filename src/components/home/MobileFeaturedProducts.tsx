import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

function calculateDiscount(price: number, compareAtPrice: number | null): number | null {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  return Math.round(((compareAtPrice - price) / compareAtPrice) * 100);
}

export function MobileFeaturedProducts() {
  const { data, isLoading } = useProducts({ featured: true, limit: 6 });

  return (
    <section className="px-4 py-6">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-display text-lg font-bold text-foreground">
          Featured Products
        </h2>
        <Link 
          to="/products" 
          className="text-sm font-medium text-primary"
        >
          View All
        </Link>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="aspect-[3/4] w-full rounded-xl" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {data?.products.map((product) => {
            const discount = calculateDiscount(product.price, product.compare_at_price);
            const primaryImage = product.product_images?.find(img => img.is_primary)?.url 
              || product.product_images?.[0]?.url;

            return (
              <Link
                key={product.id}
                to={`/products/${product.slug}`}
                className="group"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                  {primaryImage ? (
                    <img
                      src={primaryImage}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <span className="text-muted-foreground">No image</span>
                    </div>
                  )}
                  
                  {/* Discount Badge */}
                  {discount && (
                    <span className="absolute left-2 top-2 rounded-md bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                      {discount}% OFF
                    </span>
                  )}
                  
                  {/* Wishlist Button */}
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute right-2 top-2 h-8 w-8 rounded-full opacity-90"
                    onClick={(e) => {
                      e.preventDefault();
                      // TODO: Add to wishlist
                    }}
                  >
                    <Heart className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="mt-2 space-y-0.5">
                  <h3 className="line-clamp-2 text-sm font-medium text-foreground">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-foreground">
                      {formatPrice(product.price)}
                    </span>
                    {product.compare_at_price && (
                      <span className="text-xs text-muted-foreground line-through">
                        {formatPrice(product.compare_at_price)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
