import { Link } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/useProducts";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { toast } from "sonner";

import kaftanBlue from "@/assets/products/kaftan-blue.jpg";
import kaftanWhite from "@/assets/products/kaftan-white.jpg";
import kaftanGrey from "@/assets/products/kaftan-grey.jpg";

// Fallback images for products without images
const fallbackImages = [kaftanBlue, kaftanWhite, kaftanGrey];

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function FeaturedProducts() {
  const { data, isLoading } = useProducts({ featured: true, limit: 4 });
  const { addToCart } = useCart();
  const { userId, addToWishlist, isInWishlist } = useWishlist();

  const products = data?.products || [];

  const handleAddToCart = (productId: string, productName: string) => {
    addToCart.mutate(
      { productId, quantity: 1 },
      {
        onSuccess: () => toast.success(`${productName} added to cart`),
        onError: () => toast.error("Failed to add to cart"),
      }
    );
  };

  const handleWishlist = async (productId: string) => {
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
    <section className="bg-muted/50 py-16 md:py-24">
      <div className="container">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold text-primary md:text-4xl">
              Featured Products
            </h2>
            <p className="mt-4 text-muted-foreground">
              Handpicked selections from our best vendors
            </p>
          </div>
          <Button variant="link" asChild className="hidden sm:flex">
            <Link to="/products">View All Products →</Link>
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {isLoading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <Card key={i} className="overflow-hidden border-0 shadow-sm">
                <Skeleton className="aspect-[3/4] w-full" />
                <CardContent className="p-4 space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-6 w-24" />
                </CardContent>
              </Card>
            ))
          ) : products.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              No featured products available
            </div>
          ) : (
            products.map((product, index) => {
              const primaryImage = product.product_images?.find(img => img.is_primary);
              const imageUrl = primaryImage?.url || product.product_images?.[0]?.url || fallbackImages[index % fallbackImages.length];
              const inWishlist = isInWishlist(product.id);

              return (
                <Card key={product.id} className="group overflow-hidden border-0 shadow-sm">
                  <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                    <img
                      src={imageUrl}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute right-3 top-3 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className={`h-9 w-9 ${inWishlist ? "bg-primary text-primary-foreground" : ""}`}
                        onClick={() => handleWishlist(product.id)}
                      >
                        <Heart className={`h-4 w-4 ${inWishlist ? "fill-current" : ""}`} />
                      </Button>
                      <Button 
                        size="icon" 
                        variant="secondary" 
                        className="h-9 w-9"
                        onClick={() => handleAddToCart(product.id, product.name)}
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">
                      {product.vendor?.store_name || product.vendor?.full_name || "Vendor"}
                    </p>
                    <Link 
                      to={`/products/${product.slug}`}
                      className="mt-1 block font-medium text-primary hover:underline"
                    >
                      {product.name}
                    </Link>
                    <p className="mt-2 font-display text-lg font-bold text-primary">
                      {formatPrice(product.price)}
                    </p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Button variant="outline" asChild>
            <Link to="/products">View All Products</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
