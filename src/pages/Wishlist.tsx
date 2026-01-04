import { Link } from "react-router-dom";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Heart, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWishlist } from "@/hooks/useWishlist";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Wishlist() {
  const { items, isLoading, userId, removeFromWishlist } = useWishlist();

  const handleRemove = async (itemId: string, productName: string) => {
    try {
      await removeFromWishlist.mutateAsync(itemId);
      toast.success(`${productName} removed from favorites`);
    } catch (error) {
      toast.error("Failed to remove from favorites");
    }
  };

  if (!userId) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          <h1 className="font-display text-xl font-bold text-foreground">Favorites</h1>
          
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <Heart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium text-foreground">Sign in to save favorites</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Create an account to save your favorite products.
            </p>
            <div className="mt-6 flex gap-3">
              <Button asChild>
                <Link to="/auth">Sign In</Link>
              </Button>
              <Button variant="outline" asChild>
                <Link to="/auth?mode=register">Register</Link>
              </Button>
            </div>
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          <h1 className="font-display text-xl font-bold text-foreground">Favorites</h1>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="aspect-[3/4] w-full rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (items.length === 0) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          <h1 className="font-display text-xl font-bold text-foreground">Favorites</h1>
          
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <Heart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium text-foreground">No favorites yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tap the heart icon on products to save them here.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/products">Browse Products</Link>
            </Button>
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="px-4 py-6">
        <h1 className="font-display text-xl font-bold text-foreground">
          Favorites ({items.length})
        </h1>
        
        <div className="mt-4 grid grid-cols-2 gap-3">
          {items.map((item) => {
            const primaryImage = item.product.product_images?.find(img => img.is_primary)?.url 
              || item.product.product_images?.[0]?.url;
            const discount = item.product.compare_at_price && item.product.compare_at_price > item.product.price
              ? Math.round(((item.product.compare_at_price - item.product.price) / item.product.compare_at_price) * 100)
              : null;

            return (
              <div key={item.id} className="group relative">
                <Link to={`/products/${item.product.slug}`}>
                  <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-muted">
                    {primaryImage ? (
                      <img
                        src={primaryImage}
                        alt={item.product.name}
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
                  </div>
                  
                  <div className="mt-2 space-y-0.5">
                    <h3 className="line-clamp-2 text-sm font-medium text-foreground">
                      {item.product.name}
                    </h3>
                    <div className="flex items-center gap-2">
                      <span className="font-display text-sm font-bold text-foreground">
                        {formatPrice(item.product.price)}
                      </span>
                      {item.product.compare_at_price && (
                        <span className="text-xs text-muted-foreground line-through">
                          {formatPrice(item.product.compare_at_price)}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
                
                {/* Remove Button */}
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute right-2 top-2 h-8 w-8 rounded-full bg-destructive/90 text-destructive-foreground opacity-0 transition-opacity group-hover:opacity-100 hover:bg-destructive"
                  onClick={() => handleRemove(item.id, item.product.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </MobileLayout>
  );
}
