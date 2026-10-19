import useEmblaCarousel from "embla-carousel-react";
import { useState, useEffect } from "react";
import { track } from "@/lib/analytics";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ChevronLeft, Heart, Minus, Plus, ShoppingCart, Truck, Shield, RotateCcw, BadgeCheck, Store, Share2, Check } from "lucide-react";
import { ChatWithVendorButton } from "@/components/chat/ChatWithVendorButton";
import { ChatWithUsButton } from "@/components/chat/ChatWithUsButton";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useProduct } from "@/hooks/useProduct";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { ReviewsList } from "@/components/reviews/ReviewsList";
import { RecentlyViewed } from "@/components/products/RecentlyViewed";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { FirstBuyerPrice } from "@/components/products/FirstBuyerPrice";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProductDetail() {
  const { t } = useTranslation();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { data: product, isLoading, error } = useProduct(slug || "");
  const { addToCart, count: cartCount } = useCart();
  const { userId, addToWishlist, isInWishlist } = useWishlist();
  const { addProduct: addToRecentlyViewed } = useRecentlyViewed();
  const [selectedImage, setSelectedImage] = useState(0);
  const [galleryRef, galleryApi] = useEmblaCarousel({ loop: false, align: "start" });

  useEffect(() => {
    if (!galleryApi) return;
    const onSelect = () => setSelectedImage(galleryApi.selectedScrollSnap());
    onSelect();
    galleryApi.on("select", onSelect).on("reInit", onSelect);
    return () => {
      galleryApi.off("select", onSelect).off("reInit", onSelect);
    };
  }, [galleryApi]);
  const [quantity, setQuantity] = useState(1);
  const [selectedSize, setSelectedSize] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);

  // Track product view
  useEffect(() => {
    if (product) {
      const primaryImage = product.product_images?.find(img => img.is_primary);
      addToRecentlyViewed({
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        imageUrl: primaryImage?.url || product.product_images?.[0]?.url,
      });
    }
  }, [product, addToRecentlyViewed]);

  useEffect(() => {
    if (product?.id) track("product_view", { product_id: product.id, vendor_id: product.vendor_id ?? undefined, value: product.price });
  }, [product?.id]); // eslint-disable-line react-hooks/exhaustive-deps -- once per product

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
          <h1 className="text-lg font-bold">{t("products.notFound")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("products.notFoundDesc")}</p>
          <Button asChild className="mt-4">
            <Link to="/products">{t("products.browseProducts")}</Link>
          </Button>
        </div>
      </MobileLayout>
    );
  }

  // Main photo first, then the order the seller chose.
  const images = [...(product.product_images || [])].sort((a, b) =>
    Number(b.is_primary) - Number(a.is_primary) || (a.display_order ?? 0) - (b.display_order ?? 0)
  );
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const variants = product.product_variants || [];
  // Options come from the product's own sizes/colors lists plus any stocked variants
  const sizes = [...new Set([
    ...(product.sizes || []),
    ...variants.map(v => v.size).filter((v): v is string => !!v),
  ])];
  const colors = [...new Set([
    ...(product.colors || []),
    ...variants.map(v => v.color).filter((v): v is string => !!v),
  ])];
  const inWishlist = isInWishlist(product.id);

  // Find a stocked variant matching the size/color selection (if the vendor set one up)
  const selectedVariant = variants.length === 0 || (!selectedSize && !selectedColor)
    ? undefined
    : variants.find(v =>
        (v.size || null) === (sizes.length > 0 ? selectedSize : null) &&
        (v.color || null) === (colors.length > 0 ? selectedColor : null)
      );

  // Calculate price with variant adjustment
  const variantPriceAdjustment = selectedVariant?.price_adjustment || 0;
  const finalPrice = product.price + variantPriceAdjustment;
  
  // Get available stock (variant stock if selected, otherwise product stock)
  const availableStock = selectedVariant?.stock_quantity ?? product.stock_quantity;

  const handleAddToCart = () => {
    // Validate variant selection if variants exist
    if (sizes.length > 0 && !selectedSize) {
      toast.error(t("products.selectSize"));
      return;
    }
    if (colors.length > 0 && !selectedColor) {
      toast.error(t("products.selectColor"));
      return;
    }

    addToCart.mutate(
      { 
        productId: product.id, 
        quantity,
        variantId: selectedVariant?.id,
        size: selectedSize,
        color: selectedColor,
      },
      {
        onSuccess: () => {
          const options = [selectedSize, selectedColor].filter(Boolean).join(" · ");
          toast.success(t("products.addedToCart"), {
            description: `${product.name}${options ? ` (${options})` : ""} x ${quantity}`,
            action: { label: t("products.viewCart"), onClick: () => navigate("/cart") },
          });
        },
        onError: () => {
          toast.error(t("products.addToCartFailed"));
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

  const handleShare = async () => {
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
      if ((error as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(productUrl);
        toast.success("Product link copied");
      }
    }
  };

  return (
    <MobileLayout hideHeader hideBottomNav>
      {/* Image Gallery */}
      <div className="relative">
        <div className="aspect-square w-full overflow-hidden bg-muted" ref={galleryRef}>
          {images.length > 0 ? (
            // Swipe left/right between photos; the dots below follow along.
            <div className="flex h-full touch-pan-y">
              {images.map((image, index) => (
                <div key={image.id ?? index} className="h-full min-w-0 flex-[0_0_100%]">
                  <img
                    src={image.url}
                    alt={image.alt_text || product.name}
                    className="h-full w-full object-cover"
                    loading={index === 0 ? "eager" : "lazy"}
                    draggable={false}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              {t("products.noImage")}
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
            className="relative h-10 w-10 rounded-full shadow-md"
            asChild
          >
            <Link to="/cart" aria-label={cartCount > 0 ? `${t("products.viewCart")} (${cartCount})` : t("products.viewCart")}>
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground animate-in zoom-in-50">
                  {cartCount > 9 ? "9+" : cartCount}
                </span>
              )}
            </Link>
          </Button>
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
          <div className="absolute bottom-4 left-1/2 flex -translate-x-1/2 gap-1.5 rounded-full bg-black/25 px-2 py-1.5">
            {images.map((_, index) => (
              <button
                key={index}
                onClick={() => galleryApi?.scrollTo(index)}
                aria-label={`Photo ${index + 1} of ${images.length}`}
                className={`h-2 rounded-full transition-all ${
                  selectedImage === index ? "w-5 bg-white shadow" : "w-2 bg-white/60"
                }`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Product Info */}
      <div className="space-y-5 px-4 py-5 pb-24">
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
          
          {/* Stock indicator */}
          <div className="flex items-center gap-2 mt-2">
            {availableStock > 0 ? (
              <Badge variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
                <Check className="h-3 w-3" aria-hidden="true" />{t("products.inStock")}
              </Badge>
            ) : (
              <Badge variant="destructive">{t("products.outOfStock")}</Badge>
            )}
            {availableStock > 0 && availableStock < 10 && (
              <span className="text-xs text-orange-600">{t("products.stockLeft", { count: availableStock })}</span>
            )}
          </div>
        </div>

        {/* Price Section */}
        <div className="bg-gradient-to-r from-primary/5 to-transparent p-4 rounded-xl -mx-4">
          <div className="flex items-baseline gap-3 px-4">
            <span className="font-display text-3xl font-bold text-foreground">
              {formatPrice(finalPrice)}
            </span>
            {hasDiscount && (
              <>
                <span className="text-lg text-muted-foreground line-through">
                  {formatPrice(product.compare_at_price! + variantPriceAdjustment)}
                </span>
                <Badge variant="destructive" className="ml-auto">
                  Save {Math.round((1 - product.price / product.compare_at_price!) * 100)}%
                </Badge>
              </>
            )}
          </div>
          <FirstBuyerPrice
            price={finalPrice}
            percent={product.first_buyer_discount_percent}
            size="md"
            className="mx-4 mt-2"
          />
        </div>

        {/* Seller Card */}
        {product.vendor && (
          <Link 
            to={`/vendor/${product.vendor.id}`}
            className="flex items-center gap-3 rounded-xl bg-card p-4 border shadow-sm hover:shadow-md hover:border-primary/30 transition-all"
          >
            <Avatar className="h-14 w-14 border-2 border-primary/20 shadow">
              <AvatarImage src={product.vendor.avatar_url || undefined} alt={product.vendor.full_name || "Seller"} />
              <AvatarFallback className="bg-primary/10 text-primary font-bold text-lg">
                {product.vendor.full_name?.charAt(0) || product.vendor.store_name?.charAt(0) || "V"}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold truncate">
                  {product.vendor.store_name || product.vendor.full_name}
                </span>
                {product.vendor.is_verified && (
                  <VerifiedBadge className="h-5 w-5" tier={product.vendor.verification_tier} />
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {product.vendor.is_verified ? (product.vendor.verification_tier === "gold" ? "Top Seller" : "Verified Seller") : "Seller"}
              </p>
            </div>
            <Button variant="default" size="sm" className="rounded-full gap-2 shadow-sm">
              <Store className="h-4 w-4" />
              View Shop
            </Button>
          </Link>
        )}
        {product.vendor && (
          <div className="space-y-2 rounded-xl border p-3">
            <ChatWithUsButton productId={product.id} className="w-full" />
            <p className="text-center text-xs text-muted-foreground">
              Protected: we get the item from the seller, arrange delivery and only pay the seller once it reaches you.
            </p>
            <ChatWithVendorButton
              vendorId={product.vendor.id}
              productId={product.id}
              variant="outline"
              className="w-full"
              label="Chat with seller directly"
            />
            <p className="text-center text-xs text-muted-foreground">
              Deals you agree directly with the seller are at your own risk.
            </p>
          </div>
        )}

        {/* Description */}
        {product.description && (
          <div className="space-y-2">
            <h3 className="font-semibold text-sm">{t("products.description")}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {product.description}
            </p>
          </div>
        )}

        {/* Variants */}
        {(sizes.length > 0 || colors.length > 0) && (
          <div className="space-y-4 p-4 rounded-xl bg-muted/30 border">
            {sizes.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">
                  {t("products.sizes")} {!selectedSize && <span className="text-destructive">*</span>}
                </p>
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

            {colors.length > 0 && (
              <div>
                <p className="mb-2 text-sm font-semibold">
                  {t("products.colors")} {!selectedColor && <span className="text-destructive">*</span>}
                </p>
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
          </div>
        )}

        {/* Quantity */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-card border">
          <div>
            <p className="text-sm font-semibold">{t("products.quantity")}</p>
            <p className="text-xs text-muted-foreground">{t("products.stockAvailable", { count: availableStock })}</p>
          </div>
          <div className="flex items-center gap-1 rounded-full border bg-background">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              disabled={quantity <= 1}
            >
              <Minus className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center font-semibold text-lg">{quantity}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => setQuantity(Math.min(availableStock, quantity + 1))}
              disabled={quantity >= availableStock}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Features */}
        <div className="grid grid-cols-3 gap-3">
          <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 text-center">
            <div className="p-2 rounded-full bg-primary/10">
              <Truck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs font-semibold">{t("products.fastDelivery")}</p>
              <p className="text-[10px] text-muted-foreground">{t("products.deliveryDays")}</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 text-center">
            <div className="p-2 rounded-full bg-green-500/10">
              <Shield className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs font-semibold">Escrow</p>
              <p className="text-[10px] text-muted-foreground">{t("products.secureDesc")}</p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-muted/50 text-center">
            <div className="p-2 rounded-full bg-blue-500/10">
              <RotateCcw className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-semibold">{t("products.easyReturns")}</p>
              <p className="text-[10px] text-muted-foreground">{t("products.returnDays")}</p>
            </div>
          </div>
        </div>

        {/* Add to Cart - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-40">
          <div className="flex items-center gap-3 max-w-lg mx-auto">
            <div className="text-left">
              <p className="text-xs text-muted-foreground">{t("cart.total")}</p>
              <p className="font-bold text-lg">{formatPrice(finalPrice * quantity)}</p>
            </div>
            <Button 
              size="lg" 
              className="flex-1 gap-2 h-12 rounded-full shadow-lg"
              onClick={handleAddToCart}
              disabled={availableStock === 0}
            >
              <ShoppingCart className="h-5 w-5" />
              {t("products.addToCart")}
            </Button>
          </div>
        </div>

        {/* Reviews Section */}
        <Separator className="my-6" />
        <ReviewsList productId={product.id} />

        {/* Recently Viewed */}
        <RecentlyViewed excludeProductId={product.id} />
      </div>
    </MobileLayout>
  );
}
