import { Link, useNavigate } from "react-router-dom";
import { Heart, ShoppingCart, BadgeCheck, Eye, Share2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useWishlist } from "@/hooks/useWishlist";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product } from "@/hooks/useProducts";
import { ProductImageCarousel } from "@/components/products/ProductImageCarousel";

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
  
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const inWishlist = isInWishlist(product.id);
  const discount = hasDiscount 
    ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100)
    : null;

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

    // Products with sizes/colours need a choice first: send the shopper to the detail page
    if ((product.sizes?.length ?? 0) > 0 || (product.colors?.length ?? 0) > 0) {
      toast.info("Choose a size/colour first");
      navigate(`/products/${product.slug}`);
      return;
    }

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
      text: `Check out ${product.name} on Kano Kaftan! Clothing, fabrics, shoes, caps and accessories from trusted sellers.`,
      url: productUrl,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(productUrl);
        toast.success("Product link copied", {
          description: "Share it with friends",
        });
      }
    } catch (error) {
      // User cancelled share or error
      if ((error as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(productUrl);
        toast.success("Product link copied");
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
          <ProductImageCarousel images={product.product_images} alt={product.name} autoplay />
          
          {/* Featured badge */}
          {product.featured && (
            <span className={cn(
              "liquid-glass absolute rounded-full font-semibold text-foreground",
              compact ? "left-1.5 top-1.5 px-2 py-0.5 text-[9px]" : "left-3 top-3 px-2.5 py-1 text-[11px]"
            )}>
              Featured
            </span>
          )}
          
          {discount && !product.featured && (
            <Badge className={cn(
              "absolute bg-destructive text-destructive-foreground",
              compact ? "left-1.5 top-1.5 text-[9px] px-1.5 py-0.5" : "left-3 top-3"
            )}>
              -{discount}%
            </Badge>
          )}

          {/* Wishlist button only */}
          <div className={cn(
            "absolute",
            compact ? "right-1.5 top-1.5" : "right-3 top-3"
          )}>
            {/* Liquid-glass heart: picks up the photo's colours behind it */}
            <button
              type="button"
              aria-label={inWishlist ? "Remove from favourites" : "Add to favourites"}
              aria-pressed={inWishlist}
              className={cn(
                "liquid-glass liquid-glass-press flex items-center justify-center rounded-full",
                compact ? "h-7 w-7" : "h-9 w-9",
                inWishlist ? "text-red-500" : "text-foreground"
              )}
              onClick={handleWishlistClick}
            >
              <Heart
                key={inWishlist ? "on" : "off"}
                className={cn(compact ? "h-3.5 w-3.5" : "h-4 w-4", inWishlist && "fill-current animate-in zoom-in-50 duration-300")}
              />
            </button>
          </div>
        </div>

        <CardContent className={cn(
          compact ? "p-2 pb-2" : "p-3 pb-3"
        )}>
          <p className={cn(
            "font-medium text-foreground",
            compact ? "text-xs line-clamp-1" : "text-sm line-clamp-2"
          )}>
            {product.name}
          </p>
          
          <div className={cn(
            "flex items-center gap-1.5",
            compact ? "mt-0.5" : "mt-1"
          )}>
            <p className={cn(
              "font-display font-bold text-foreground",
              compact ? "text-xs" : "text-sm"
            )}>
              {formatPrice(product.price)}
            </p>
            {hasDiscount && (
              <p className={cn(
                "text-muted-foreground line-through",
                compact ? "text-[10px]" : "text-xs"
              )}>
                {formatPrice(product.compare_at_price!)}
              </p>
            )}
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
