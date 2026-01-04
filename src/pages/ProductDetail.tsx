import { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, Minus, Plus, ShoppingCart, Truck, Shield, RotateCcw } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useProduct } from "@/hooks/useProduct";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { ReviewsList } from "@/components/reviews/ReviewsList";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading, error } = useProduct(slug || "");
  const { addToCart } = useCart();
  const { userId, addToWishlist, isInWishlist } = useWishlist();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);

  if (isLoading) {
    return (
      <MobileLayout hideHeader>
        <div className="space-y-4">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-3 px-4">
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-8 w-1/3" />
            <Skeleton className="h-20 w-full" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (error || !product) {
    return (
      <MobileLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-6">
          <h1 className="text-lg font-bold">Product Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">The product you're looking for doesn't exist.</p>
          <Button asChild className="mt-4">
            <Link to="/products">Browse Products</Link>
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const images = product.product_images?.sort((a, b) => 
    (a.is_primary ? -1 : 1) - (b.is_primary ? -1 : 1)
  ) || [];
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const variants = product.product_variants || [];
  const sizes = [...new Set(variants.filter(v => v.size).map(v => v.size))];
  const colors = [...new Set(variants.filter(v => v.color).map(v => v.color))];
  const inWishlist = isInWishlist(product.id);

  const handleAddToCart = () => {
    addToCart.mutate(
      { productId: product.id, quantity },
      {
        onSuccess: () => {
          toast.success("Added to cart", {
            description: `${product.name} x ${quantity}`,
          });
        },
        onError: () => {
          toast.error("Failed to add to cart");
        },
      }
    );
  };

  const handleWishlistClick = async () => {
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

  return (
    <MobileLayout hideHeader>
      {/* Image Gallery */}
      <div className="relative">
        <div className="aspect-square w-full bg-muted">
          {images.length > 0 ? (
            <img
              src={images[selectedImage]?.url}
              alt={images[selectedImage]?.alt_text || product.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No Image Available
            </div>
          )}
        </div>
        
        {/* Back Button */}
        <Button
          variant="secondary"
          size="icon"
          className="absolute left-4 top-4 h-10 w-10 rounded-full shadow-md"
          asChild
        >
          <Link to="/products">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>
        
        {/* Wishlist Button */}
        <Button
          variant="secondary"
          size="icon"
          className={cn(
            "absolute right-4 top-4 h-10 w-10 rounded-full shadow-md",
            inWishlist && "bg-primary text-primary-foreground hover:bg-primary/90"
          )}
          onClick={handleWishlistClick}
        >
          <Heart className={cn("h-5 w-5", inWishlist && "fill-current")} />
        </Button>

        {/* Discount Badge */}
        {hasDiscount && (
          <Badge variant="destructive" className="absolute left-4 bottom-4">
            {Math.round((1 - product.price / product.compare_at_price!) * 100)}% OFF
          </Badge>
        )}

        {/* Image Thumbnails */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => setSelectedImage(index)}
                className={`h-2 w-2 rounded-full transition-colors ${
                  selectedImage === index ? "bg-foreground" : "bg-foreground/30"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="space-y-5 px-4 py-5">
        {/* Category & Name */}
        <div>
          {product.category && (
            <Link 
              to={`/products?category=${product.category.slug}`}
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              {product.category.name}
            </Link>
          )}
          <h1 className="mt-1 font-display text-xl font-bold text-foreground">
            {product.name}
          </h1>
          {product.vendor?.full_name && (
            <p className="mt-1 text-sm text-muted-foreground">
              by <span className="font-medium">{product.vendor.full_name}</span>
            </p>
          )}
        </div>

        {/* Price */}
        <div className="flex items-center gap-3">
          <span className="font-display text-2xl font-bold text-foreground">
            {formatPrice(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-lg text-muted-foreground line-through">
              {formatPrice(product.compare_at_price!)}
            </span>
          )}
        </div>

        {/* Description */}
        {product.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {product.description}
          </p>
        )}

        {/* Sizes */}
        {sizes.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Size</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size) => (
                <Button
                  key={size}
                  variant="outline"
                  size="sm"
                  className="min-w-[2.5rem] rounded-full"
                >
                  {size}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Colors */}
        {colors.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-medium">Color</p>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <Button
                  key={color}
                  variant="outline"
                  size="sm"
                  className="rounded-full"
                >
                  {color}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Quantity */}
        <div>
          <p className="mb-2 text-sm font-medium">Quantity</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center rounded-full border">
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setQuantity(Math.max(1, quantity - 1))}
                disabled={quantity <= 1}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <span className="w-10 text-center font-medium">{quantity}</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={() => setQuantity(Math.min(product.stock_quantity, quantity + 1))}
                disabled={quantity >= product.stock_quantity}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <span className="text-sm text-muted-foreground">
              {product.stock_quantity} in stock
            </span>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-2 border-t pt-5">
          <div className="flex flex-col items-center gap-1 text-center">
            <Truck className="h-5 w-5 text-muted-foreground" />
            <p className="text-[10px] font-medium">Free Shipping</p>
            <p className="text-[10px] text-muted-foreground">Over ₦50k</p>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <Shield className="h-5 w-5 text-muted-foreground" />
            <p className="text-[10px] font-medium">Secure</p>
            <p className="text-[10px] text-muted-foreground">Payment</p>
          </div>
          <div className="flex flex-col items-center gap-1 text-center">
            <RotateCcw className="h-5 w-5 text-muted-foreground" />
            <p className="text-[10px] font-medium">Easy Returns</p>
            <p className="text-[10px] text-muted-foreground">7 days</p>
          </div>
        </div>

        {/* Add to Cart Button */}
        <Button 
          size="lg" 
          className="w-full gap-2"
          onClick={handleAddToCart}
          disabled={product.stock_quantity === 0}
        >
          <ShoppingCart className="h-5 w-5" />
          Add to Cart
        </Button>

        {/* Reviews Section */}
        <Separator className="my-6" />
        <ReviewsList productId={product.id} />
      </div>
    </MobileLayout>
  );
}
