import { Link } from "react-router-dom";
import { Heart, LayoutGrid, List } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useProducts } from "@/hooks/useProducts";
import { useWishlist } from "@/hooks/useWishlist";
import { toast } from "sonner";
import { useState, useEffect } from "react";

import kaftanBlue from "@/assets/products/kaftan-blue.jpg";
import kaftanWhite from "@/assets/products/kaftan-white.jpg";
import kaftanGrey from "@/assets/products/kaftan-grey.jpg";

const fallbackImages = [kaftanBlue, kaftanWhite, kaftanGrey];

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

export function AllProductsSection() {
  const { data, isLoading } = useProducts({ limit: 8 });
  const { userId, addToWishlist, isInWishlist } = useWishlist();
  
  const [isCompactGrid, setIsCompactGrid] = useState(() => {
    const saved = localStorage.getItem("allProductsGridPreference");
    return saved !== null ? saved === "compact" : true;
  });

  useEffect(() => {
    localStorage.setItem("allProductsGridPreference", isCompactGrid ? "compact" : "list");
  }, [isCompactGrid]);

  const products = data?.products || [];

  const handleWishlistClick = async (e: React.MouseEvent, productId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userId) {
      toast.info("Please sign in to save favorites");
      return;
    }
    
    try {
      const result = await addToWishlist.mutateAsync(productId);
      toast.success(result.action === "added" ? "Added to favorites" : "Removed from favorites");
    } catch {
      toast.error("Failed to update favorites");
    }
  };

  return (
    <section className="px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">All Products</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsCompactGrid(!isCompactGrid)}
          >
            {isCompactGrid ? (
              <List className="h-4 w-4" />
            ) : (
              <LayoutGrid className="h-4 w-4" />
            )}
          </Button>
          <Link to="/products" className="text-sm text-primary font-medium">
            View All
          </Link>
        </div>
      </div>

      {isLoading ? (
        <div className={`grid gap-2 ${isCompactGrid ? "grid-cols-2" : "grid-cols-1"}`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card rounded-lg overflow-hidden">
              <Skeleton className={`w-full ${isCompactGrid ? "aspect-square" : "aspect-[4/3]"}`} />
              <div className="p-2 space-y-1">
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          No products available
        </div>
      ) : (
        <div className={`grid gap-2 ${isCompactGrid ? "grid-cols-2" : "grid-cols-1"}`}>
          {products.map((product, index) => {
            const primaryImage = product.product_images?.find(img => img.is_primary);
            const imageUrl = primaryImage?.url || product.product_images?.[0]?.url || fallbackImages[index % fallbackImages.length];
            const inWishlist = isInWishlist(product.id);
            const discount = calculateDiscount(product.price, product.compare_at_price);

            if (isCompactGrid) {
              return (
                <Link
                  key={product.id}
                  to={`/products/${product.slug}`}
                  className="group bg-card rounded-lg overflow-hidden"
                >
                  <div className="relative aspect-square overflow-hidden bg-muted">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    {discount && (
                      <Badge className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
                        -{discount}%
                      </Badge>
                    )}
                    <Button
                      size="icon"
                      variant="secondary"
                      className={`absolute top-1.5 right-1.5 h-7 w-7 rounded-full opacity-90 ${
                        inWishlist ? "bg-primary text-primary-foreground" : "bg-background/80"
                      }`}
                      onClick={(e) => handleWishlistClick(e, product.id)}
                    >
                      <Heart className={`h-3.5 w-3.5 ${inWishlist ? "fill-current" : ""}`} />
                    </Button>
                  </div>
                  <div className="p-2">
                    <h3 className="text-xs font-medium text-foreground line-clamp-1">
                      {product.name}
                    </h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-bold text-foreground">
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
            }

            return (
              <Link
                key={product.id}
                to={`/products/${product.slug}`}
                className="group flex gap-3 bg-card rounded-lg overflow-hidden p-2"
              >
                <div className="relative w-28 aspect-square flex-shrink-0 overflow-hidden bg-muted rounded-md">
                  <img
                    src={imageUrl}
                    alt={product.name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                  {discount && (
                    <Badge className="absolute top-1 left-1 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
                      -{discount}%
                    </Badge>
                  )}
                </div>
                <div className="flex-1 flex flex-col justify-between py-1">
                  <div>
                    <h3 className="text-sm font-medium text-foreground line-clamp-2">
                      {product.name}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {product.vendor?.store_name || product.vendor?.full_name || "Vendor"}
                    </p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-foreground">
                        {formatPrice(product.price)}
                      </span>
                      {product.compare_at_price && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(product.compare_at_price)}
                        </span>
                      )}
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className={`h-8 w-8 ${inWishlist ? "text-primary" : ""}`}
                      onClick={(e) => handleWishlistClick(e, product.id)}
                    >
                      <Heart className={`h-4 w-4 ${inWishlist ? "fill-current" : ""}`} />
                    </Button>
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
