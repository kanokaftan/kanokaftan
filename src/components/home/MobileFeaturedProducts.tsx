import { Link } from "react-router-dom";
import { Heart, Grid2X2, LayoutList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/useProducts";
import { useWishlist } from "@/hooks/useWishlist";
import { Skeleton } from "@/components/ui/skeleton";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

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
  const { data, isLoading } = useProducts({ featured: true, limit: 8 });
  const { userId, addToWishlist, isInWishlist } = useWishlist();
  const navigate = useNavigate();
  
  // Grid view preference - default to 2 columns, persisted in localStorage
  const [isCompactGrid, setIsCompactGrid] = useState(() => {
    const saved = localStorage.getItem("product-grid-compact");
    return saved !== null ? saved === "true" : true;
  });

  useEffect(() => {
    localStorage.setItem("product-grid-compact", String(isCompactGrid));
  }, [isCompactGrid]);

  const handleWishlistClick = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userId) {
      toast.info("Please sign in to save favorites");
      navigate("/auth");
      return;
    }

    try {
      const result = await addToWishlist.mutateAsync(productId);
      if (result.action === "added") {
        toast.success("Added to favorites");
      } else {
        toast.success("Removed from favorites");
      }
    } catch (error) {
      toast.error("Failed to update favorites");
    }
  };

  return (
    <section className="px-4 py-4">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-base font-bold text-foreground">
          Featured Products
        </h2>
        <div className="flex items-center gap-2">
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
              aria-label="Grid view"
            >
              <Grid2X2 className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setIsCompactGrid(false)}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                !isCompactGrid 
                  ? "bg-background text-foreground shadow-sm" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label="List view"
            >
              <LayoutList className="h-3.5 w-3.5" />
            </button>
          </div>
          <Link 
            to="/products?featured=true" 
            className="text-xs font-medium text-primary"
          >
            View All
          </Link>
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div className={cn(
          "grid gap-2",
          isCompactGrid ? "grid-cols-2" : "grid-cols-1"
        )}>
          {[...Array(isCompactGrid ? 6 : 3)].map((_, i) => (
            <div key={i} className={cn(
              "space-y-1.5",
              !isCompactGrid && "flex gap-3"
            )}>
              <Skeleton className={cn(
                "rounded-lg",
                isCompactGrid ? "aspect-square w-full" : "h-24 w-24 shrink-0"
              )} />
              <div className={cn(!isCompactGrid && "flex-1 py-1")}>
                <Skeleton className="h-3 w-3/4" />
                <Skeleton className="mt-1.5 h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className={cn(
          "grid gap-2",
          isCompactGrid ? "grid-cols-2" : "grid-cols-1"
        )}>
          {data?.products.map((product) => {
            const discount = calculateDiscount(product.price, product.compare_at_price);
            const primaryImage = product.product_images?.find(img => img.is_primary)?.url 
              || product.product_images?.[0]?.url;
            const inWishlist = isInWishlist(product.id);

            if (!isCompactGrid) {
              // List view - horizontal card
              return (
                <Link
                  key={product.id}
                  to={`/products/${product.slug}`}
                  className="group flex gap-3 rounded-lg border bg-card p-2 transition-colors hover:bg-muted/50"
                >
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                    {primaryImage ? (
                      <img
                        src={primaryImage}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <span className="text-[10px] text-muted-foreground">No image</span>
                      </div>
                    )}
                    {discount && (
                      <span className="absolute left-1 top-1 rounded bg-destructive px-1 py-0.5 text-[8px] font-bold text-destructive-foreground">
                        -{discount}%
                      </span>
                    )}
                  </div>
                  
                  <div className="flex flex-1 flex-col justify-center">
                    <h3 className="line-clamp-2 text-sm font-medium text-foreground">
                      {product.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-foreground">
                        {formatPrice(product.price)}
                      </span>
                      {product.compare_at_price && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          {formatPrice(product.compare_at_price)}
                        </span>
                      )}
                    </div>
                  </div>

                  <Button
                    size="icon"
                    variant="ghost"
                    className={cn(
                      "h-8 w-8 shrink-0 self-center",
                      inWishlist && "text-primary"
                    )}
                    onClick={(e) => handleWishlistClick(e, product.id)}
                  >
                    <Heart className={cn("h-4 w-4", inWishlist && "fill-current")} />
                  </Button>
                </Link>
              );
            }

            // Grid view - compact card
            return (
              <Link
                key={product.id}
                to={`/products/${product.slug}`}
                className="group"
              >
                <div className="relative aspect-square overflow-hidden rounded-lg bg-muted">
                  {primaryImage ? (
                    <img
                      src={primaryImage}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-muted">
                      <span className="text-[10px] text-muted-foreground">No image</span>
                    </div>
                  )}
                  
                  {/* Discount Badge */}
                  {discount && (
                    <span className="absolute left-1.5 top-1.5 rounded bg-destructive px-1.5 py-0.5 text-[9px] font-bold text-destructive-foreground">
                      -{discount}%
                    </span>
                  )}
                  
                  {/* Wishlist Button */}
                  <Button
                    size="icon"
                    variant="secondary"
                    className={cn(
                      "absolute right-1.5 top-1.5 h-7 w-7 rounded-full opacity-90",
                      inWishlist && "bg-primary text-primary-foreground hover:bg-primary/90"
                    )}
                    onClick={(e) => handleWishlistClick(e, product.id)}
                  >
                    <Heart className={cn("h-3.5 w-3.5", inWishlist && "fill-current")} />
                  </Button>
                </div>
                
                <div className="mt-1.5 space-y-0.5">
                  <h3 className="line-clamp-1 text-xs font-medium text-foreground">
                    {product.name}
                  </h3>
                  <div className="flex items-center gap-1.5">
                    <span className="font-display text-xs font-bold text-foreground">
                      {formatPrice(product.price)}
                    </span>
                    {product.compare_at_price && (
                      <span className="text-[10px] text-muted-foreground line-through">
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