import { Link, useNavigate } from "react-router-dom";
import { Heart, ShoppingCart, BadgeCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product } from "@/hooks/useProducts";

interface ProductCardProps {
  product: Product;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function ProductCard({ product }: ProductCardProps) {
  const navigate = useNavigate();
  const { userId, addToWishlist, isInWishlist } = useWishlist();
  const { addToCart } = useCart();
  
  const primaryImage = product.product_images?.find((img) => img.is_primary);
  const imageUrl = primaryImage?.url || product.product_images?.[0]?.url;
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const inWishlist = isInWishlist(product.id);
  const discount = hasDiscount 
    ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100)
    : null;

  const vendorName = product.vendor?.store_name || product.vendor?.full_name;
  const vendorAvatar = product.vendor?.avatar_url;
  const isVendorVerified = product.vendor?.is_verified;

  const handleWishlistClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!userId) {
      toast.info("Please sign in to save favorites");
      navigate("/auth");
      return;
    }

    try {
      const result = await addToWishlist.mutateAsync(product.id);
      if (result.action === "added") {
        toast.success("Added to favorites");
      } else {
        toast.success("Removed from favorites");
      }
    } catch (error) {
      toast.error("Failed to update favorites");
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    addToCart.mutate(
      { productId: product.id, quantity: 1 },
      {
        onSuccess: () => {
          toast.success("Added to cart", {
            description: product.name,
          });
        },
        onError: () => {
          toast.error("Failed to add to cart");
        },
      }
    );
  };

  return (
    <Card className="group overflow-hidden border-0 shadow-sm transition-shadow hover:shadow-md">
      <Link to={`/products/${product.slug}`}>
        <div className="relative aspect-[3/4] overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
              No Image
            </div>
          )}
          
          {/* Featured badge */}
          {product.featured && (
            <Badge className="absolute left-3 top-3 bg-amber-500 hover:bg-amber-600">
              ⭐ Featured
            </Badge>
          )}
          
          {discount && !product.featured && (
            <Badge className="absolute left-3 top-3 bg-destructive text-destructive-foreground">
              {discount}% OFF
            </Badge>
          )}

          <div className="absolute right-3 top-3 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
            <Button 
              size="icon" 
              variant="secondary" 
              className={cn(
                "h-9 w-9",
                inWishlist && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              onClick={handleWishlistClick}
            >
              <Heart className={cn("h-4 w-4", inWishlist && "fill-current")} />
            </Button>
            <Button 
              size="icon" 
              variant="secondary" 
              className="h-9 w-9"
              onClick={handleAddToCart}
            >
              <ShoppingCart className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <CardContent className="p-4">
          {product.category && (
            <p className="text-xs text-muted-foreground">{product.category.name}</p>
          )}
          <p className="mt-1 font-medium text-foreground line-clamp-2">
            {product.name}
          </p>
          
          {/* Vendor info with avatar and verification */}
          {vendorName && (
            <div className="mt-2 flex items-center gap-2">
              <Avatar className="h-5 w-5">
                <AvatarImage src={vendorAvatar || undefined} />
                <AvatarFallback className="text-[10px]">
                  {vendorName.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-muted-foreground truncate">
                {vendorName}
              </span>
              {isVendorVerified && (
                <BadgeCheck className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
              )}
            </div>
          )}
          
          <div className="mt-2 flex items-center gap-2">
            <p className="font-display text-lg font-bold text-foreground">
              {formatPrice(product.price)}
            </p>
            {hasDiscount && (
              <p className="text-sm text-muted-foreground line-through">
                {formatPrice(product.compare_at_price!)}
              </p>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
