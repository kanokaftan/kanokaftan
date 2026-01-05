import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Heart, ShoppingCart, Minus, Plus, ExternalLink, BadgeCheck, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { Product } from "@/hooks/useProducts";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";

interface QuickViewModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function QuickViewModal({ product, open, onOpenChange }: QuickViewModalProps) {
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);
  const { addToCart } = useCart();
  const { userId, addToWishlist, isInWishlist } = useWishlist();

  if (!product) return null;

  const images = product.product_images || [];
  const currentImage = images[selectedImage]?.url || images[0]?.url;
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const discount = hasDiscount 
    ? Math.round(((product.compare_at_price! - product.price) / product.compare_at_price!) * 100)
    : null;
  const inWishlist = isInWishlist(product.id);
  const vendorName = product.vendor?.store_name || product.vendor?.full_name;
  const isOutOfStock = product.stock_quantity === 0;

  const handleAddToCart = () => {
    addToCart.mutate(
      { productId: product.id, quantity },
      {
        onSuccess: () => {
          toast.success("Added to cart", { description: product.name });
          onOpenChange(false);
        },
        onError: () => toast.error("Failed to add to cart"),
      }
    );
  };

  const handleWishlist = async () => {
    if (!userId) {
      toast.info("Please sign in to save favorites");
      navigate("/auth");
      return;
    }
    try {
      const result = await addToWishlist.mutateAsync(product.id);
      toast.success(result.action === "added" ? "Added to favorites" : "Removed from favorites");
    } catch {
      toast.error("Failed to update favorites");
    }
  };

  const handleViewDetails = () => {
    onOpenChange(false);
    navigate(`/products/${product.slug}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden">
        <VisuallyHidden>
          <DialogTitle>{product.name}</DialogTitle>
        </VisuallyHidden>
        <div className="grid md:grid-cols-2">
          {/* Image Gallery */}
          <div className="relative bg-muted">
            <div className="aspect-square">
              {currentImage ? (
                <img
                  src={currentImage}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                  No Image
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {images.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                {images.slice(0, 4).map((img, idx) => (
                  <button
                    key={img.id}
                    onClick={() => setSelectedImage(idx)}
                    className={cn(
                      "h-12 w-12 rounded-md border-2 overflow-hidden transition-all",
                      selectedImage === idx ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"
                    )}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Badges */}
            <div className="absolute left-3 top-3 flex flex-col gap-2">
              {product.featured && (
                <Badge className="bg-amber-500 hover:bg-amber-600">⭐ Featured</Badge>
              )}
              {discount && (
                <Badge className="bg-destructive">{discount}% OFF</Badge>
              )}
              {isOutOfStock && (
                <Badge variant="secondary">Out of Stock</Badge>
              )}
            </div>
          </div>

          {/* Product Info */}
          <div className="p-6 flex flex-col">
            {/* Category */}
            {product.category && (
              <p className="text-sm text-muted-foreground">{product.category.name}</p>
            )}

            {/* Title */}
            <h2 className="text-xl font-bold mt-1">{product.name}</h2>

            {/* Vendor */}
            {vendorName && (
              <div className="flex items-center gap-2 mt-2">
                <Avatar className="h-6 w-6">
                  <AvatarImage src={product.vendor?.avatar_url || undefined} />
                  <AvatarFallback className="text-xs">{vendorName.charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm text-muted-foreground">{vendorName}</span>
                {product.vendor?.is_verified && (
                  <BadgeCheck className="h-4 w-4 text-blue-500" />
                )}
              </div>
            )}

            {/* Price */}
            <div className="flex items-center gap-3 mt-4">
              <span className="text-2xl font-bold">{formatPrice(product.price)}</span>
              {hasDiscount && (
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.compare_at_price!)}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <p className="text-sm text-muted-foreground mt-4 line-clamp-3">
                {product.description}
              </p>
            )}

            {/* Stock */}
            <p className="text-sm mt-4">
              {isOutOfStock ? (
                <span className="text-destructive font-medium">Out of stock</span>
              ) : product.stock_quantity <= 5 ? (
                <span className="text-amber-600 font-medium">Only {product.stock_quantity} left</span>
              ) : (
                <span className="text-green-600">In Stock</span>
              )}
            </p>

            <div className="flex-1" />

            {/* Quantity */}
            {!isOutOfStock && (
              <div className="flex items-center gap-3 mt-4">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border rounded-lg">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQuantity(q => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center font-medium">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => setQuantity(q => Math.min(product.stock_quantity, q + 1))}
                    disabled={quantity >= product.stock_quantity}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <Button
                className="flex-1"
                size="lg"
                onClick={handleAddToCart}
                disabled={isOutOfStock || addToCart.isPending}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Add to Cart
              </Button>
              <Button
                variant="outline"
                size="lg"
                onClick={handleWishlist}
                className={cn(inWishlist && "bg-primary/10 border-primary text-primary")}
              >
                <Heart className={cn("h-4 w-4", inWishlist && "fill-current")} />
              </Button>
            </div>

            {/* View Details Link */}
            <Button
              variant="link"
              className="mt-4 text-muted-foreground"
              onClick={handleViewDetails}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              View Full Details
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
