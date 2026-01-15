import { Link, useNavigate } from "react-router-dom";
import { Heart, ShoppingCart, BadgeCheck, Eye, Share2 } from "lucide-react";
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
  onQuickView?: (product: Product) => void;
  hideFloatingCart?: boolean;
  compact?: boolean;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function ProductCard({ product, onQuickView, hideFloatingCart = false, compact = false }: ProductCardProps) {
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
  const handleQuickView = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onQuickView?.(product);
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const productUrl = `https://kanokaftan.shop/products/${product.slug}`;
    const shareData = {
      title: `${product.name} - Kano Kaftan`,
      text: `Check out ${product.name} on Kano Kaftan! Authentic Nigerian traditional attire.`,
      url: productUrl,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(productUrl);
        toast.success("Product link copied! 🎉", {
          description: "Share it with friends",
        });
      }
    } catch (error) {
      // User cancelled share or error
      if ((error as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(productUrl);
        toast.success("Product link copied! 🎉");
      }
    }
  };

  return (
    <Card className="group overflow-hidden border-0 shadow-sm transition-shadow hover:shadow-md">
      <Link to={`/products/${product.slug}`}>
        <div className={cn(
          "relative overflow-hidden bg-muted",
          compact ? "aspect-square" : "aspect-[3/4]"
        )}>
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground text-xs">
              No Image
            </div>
          )}
          
          {/* Featured badge */}
          {product.featured && (
            <Badge className={cn(
              "absolute bg-amber-500 hover:bg-amber-600",
              compact ? "left-1.5 top-1.5 text-[9px] px-1.5 py-0.5" : "left-3 top-3"
            )}>
              ⭐ Featured
            </Badge>
          )}
          
          {discount && !product.featured && (
            <Badge className={cn(
              "absolute bg-destructive text-destructive-foreground",
              compact ? "left-1.5 top-1.5 text-[9px] px-1.5 py-0.5" : "left-3 top-3"
            )}>
              -{discount}%
            </Badge>
          )}

          {/* Action buttons - visible on hover for desktop, always visible on mobile */}
          <div className={cn(
            "absolute flex flex-col gap-1.5 opacity-100 md:opacity-0 transition-opacity md:group-hover:opacity-100",
            compact ? "right-1.5 top-1.5" : "right-3 top-3 gap-2"
          )}>
            <Button 
              size="icon" 
              variant="secondary" 
              className={cn(
                compact ? "h-7 w-7" : "h-9 w-9",
                inWishlist && "bg-primary text-primary-foreground hover:bg-primary/90"
              )}
              onClick={handleWishlistClick}
            >
              <Heart className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", inWishlist && "fill-current")} />
            </Button>
            {onQuickView && !compact && (
              <Button 
                size="icon" 
                variant="secondary" 
                className="h-9 w-9"
                onClick={handleQuickView}
              >
                <Eye className="h-4 w-4" />
              </Button>
            )}
            {!compact && (
              <Button 
                size="icon" 
                variant="secondary" 
                className="h-9 w-9"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="h-4 w-4" />
              </Button>
            )}
            {!compact && (
              <Button 
                size="icon" 
                variant="secondary" 
                className="h-9 w-9"
                onClick={handleShare}
              >
                <Share2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        <CardContent className={cn(
          compact ? "p-2 pb-2" : "p-4 pb-16 md:pb-4"
        )}>
          {!compact && product.category && (
            <p className="text-xs text-muted-foreground">{product.category.name}</p>
          )}
          <p className={cn(
            "font-medium text-foreground",
            compact ? "text-xs line-clamp-1 mt-0" : "mt-1 line-clamp-2"
          )}>
            {product.name}
          </p>
          
          {/* Vendor info with avatar and verification - hide in compact mode */}
          {!compact && vendorName && (
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
          
          <div className={cn(
            "flex items-center gap-1.5",
            compact ? "mt-0.5" : "mt-2"
          )}>
            <p className={cn(
              "font-display font-bold text-foreground",
              compact ? "text-xs" : "text-lg"
            )}>
              {formatPrice(product.price)}
            </p>
            {hasDiscount && (
              <p className={cn(
                "text-muted-foreground line-through",
                compact ? "text-[10px]" : "text-sm"
              )}>
                {formatPrice(product.compare_at_price!)}
              </p>
            )}
          </div>

          {/* Floating Add to Cart button for mobile - only in non-compact mode */}
          {!hideFloatingCart && !compact && (
            <div className="absolute bottom-0 left-0 right-0 p-3 md:hidden">
              <Button 
                className="w-full gap-2 shadow-lg" 
                size="sm"
                onClick={handleAddToCart}
              >
                <ShoppingCart className="h-4 w-4" />
                Add to Cart
              </Button>
            </div>
          )}
        </CardContent>
      </Link>
    </Card>
  );
}
