import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, Share2, Truck, Shield, RotateCcw } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useProduct } from "@/hooks/useProduct";
import { useWishlist } from "@/hooks/useWishlist";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { ReviewsList } from "@/components/reviews/ReviewsList";
import { RecentlyViewed } from "@/components/products/RecentlyViewed";
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
  const { userId, addToWishlist, isInWishlist } = useWishlist();
  const { addProduct: addToRecentlyViewed } = useRecentlyViewed();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  useEffect(() => {
    if (product) {
      addToRecentlyViewed({
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        imageUrl: product.images?.[0],
      });
    }
  }, [product]);

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
          <p className="mt-2 text-sm text-muted-foreground">
            The product you're looking for doesn't exist.
          </p>
          <Button asChild className="mt-4">
            <Link to="/products">Browse Products</Link>
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const images = product.images || [];
  const sizes = product.sizes || [];
  const colors = product.colors || [];
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const inWishlist = isInWishlist(product.id);

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
    } catch {
      toast.error("Failed to update favorites");
    }
  };

  const handleShare = async () => {
    const productUrl = `https://kanokaftan.shop/products/${product.slug}`;
    const shareData = {
      title: `${product.name} - Kano Kaftan`,
      text: `Check out ${product.name} on Kano Kaftan!`,
      url: productUrl,
    };
    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(productUrl);
        toast.success("Product link copied! 🎉");
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        await navigator.clipboard.writeText(productUrl);
        toast.success("Product link copied! 🎉");
      }
    }
  };

  return (
    <MobileLayout hideHeader hideBottomNav>
      {/* Image Gallery */}
      <div className="relative">
        <div className="aspect-square w-full bg-muted">
          {images.length > 0 ? (
            <img
              src={images[selectedImage]}
              alt={product.name}
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

        {/* Action Buttons */}
        <div className="absolute right-4 top-4 flex flex-col gap-2">
          <Button
            variant="secondary"
            size="icon"
            className={cn(
              "h-10 w-10 rounded-full shadow-md",
              inWishlist && "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
            onClick={handleWishlistClick}
          >
            <Heart className={cn("h-5 w-5", inWishlist && "fill-current")} />
          </Button>
          <Button
            variant="secondary"
            size="icon"
            className="h-10 w-10 rounded-full shadow-md"
            onClick={handleShare}
          >
            <Share2 className="h-5 w-5" />
          </Button>
        </div>

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
      <div className="space-y-5 px-4 py-5 pb-28">
        {/* Category & Name */}
        <div>
          {product.category && (
            <Link
              to={`/products?category=${product.category.slug}`}
              className="inline-flex items-center gap-1 text-xs font-medium text-primary bg-primary/10 px-2 py-1 rounded-full uppercase tracking-wide hover:bg-primary/20 transition-colors"
            >
              {product.category.name}
            </Link>
          )}
          <h1 className="mt-2 font-display text-2xl font-bold text-foreground leading-tight">
            {product.name}
          </h1>
          <div className="flex items-center gap-2 mt-2">
            {product.stock_quantity > 0 ? (
              <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                ✓ Available
              </Badge>
            ) : (
              <Badge variant="destructive">Out of Stock</Badge>
            )}
          </div>
        </div>

        {/* Price */}
        <div className="bg-gradient-to-r from-primary/5 to-transparent p-4 rounded-xl -mx-4">
          <div className="flex items-baseline gap-3 px-4">
            <span className="font-display text-3xl font-bold text-foreground">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-lg text-muted-foreground line-through">
                {formatPrice(product.compare_at_price!)}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {product.description && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>
        )}

        {/* Sizes */}
        {sizes.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold">Size</p>
            <div className="flex flex-wrap gap-2">
              {sizes.map((size) => (
                <Button
                  key={size}
                  variant={selectedSize === size ? "default" : "outline"}
                  size="sm"
                  className="min-w-[3rem] rounded-full"
                  onClick={() => setSelectedSize(size)}
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
            <p className="mb-2 text-sm font-semibold">Color</p>
            <div className="flex flex-wrap gap-2">
              {colors.map((color) => (
                <Button
                  key={color}
                  variant={selectedColor === color ? "default" : "outline"}
                  size="sm"
                  className="rounded-full"
                  onClick={() => setSelectedColor(color)}
                >
                  {color}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Features */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 text-center">
            <div className="p-2 rounded-full bg-primary/10">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">Fast Delivery</p>
              <p className="text-[10px] text-muted-foreground">2-5 days</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 text-center">
            <div className="p-2 rounded-full bg-green-500/10">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold">Secure</p>
              <p className="text-[10px] text-muted-foreground">Protected</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 text-center">
            <div className="p-2 rounded-full bg-blue-500/10">
              <RotateCcw className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold">Easy Returns</p>
              <p className="text-[10px] text-muted-foreground">7 days</p>
            </div>
          </div>
        </div>

        <Separator className="my-6" />
        <ReviewsList productId={product.id} />
        <RecentlyViewed excludeProductId={product.id} />
      </div>

      {/* Chat to Order - Fixed at bottom */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-40">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="text-left">
            <p className="text-xs text-muted-foreground">Price</p>
            <p className="font-bold text-lg">{formatPrice(product.price)}</p>
          </div>
          <Button
            size="lg"
            className="flex-1 gap-2 h-12 rounded-full shadow-lg bg-gray-900 hover:bg-gray-700 text-white"
            onClick={() => navigate(`/chat?product=${product.id}`)}
            disabled={product.stock_quantity === 0}
          >
            💬 Chat to Order
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
