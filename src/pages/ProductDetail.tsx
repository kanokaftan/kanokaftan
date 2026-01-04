import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronRight, Heart, Minus, Plus, ShoppingCart, Truck, Shield, RotateCcw } from "lucide-react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useProduct } from "@/hooks/useProduct";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { data: product, isLoading, error } = useProduct(slug || "");
  const { addToCart } = useCart();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState<string | null>(null);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="container py-8">
            <div className="grid gap-8 lg:grid-cols-2">
              <Skeleton className="aspect-square w-full" />
              <div className="space-y-4">
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-6 w-1/4" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="flex min-h-screen flex-col">
        <Navbar />
        <main className="flex-1">
          <div className="container flex min-h-[400px] flex-col items-center justify-center py-8">
            <h1 className="text-2xl font-bold">Product Not Found</h1>
            <p className="mt-2 text-muted-foreground">The product you're looking for doesn't exist.</p>
            <Button asChild className="mt-4">
              <Link to="/products">Browse Products</Link>
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const images = product.product_images?.sort((a, b) => 
    (a.is_primary ? -1 : 1) - (b.is_primary ? -1 : 1)
  ) || [];
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;
  const variants = product.product_variants || [];
  const sizes = [...new Set(variants.filter(v => v.size).map(v => v.size))];
  const colors = [...new Set(variants.filter(v => v.color).map(v => v.color))];


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

  const handleAddToWishlist = () => {
    toast.success("Added to wishlist");
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      
      <main className="flex-1">
        {/* Breadcrumb */}
        <div className="border-b bg-muted/30">
          <div className="container py-3">
            <nav className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/" className="hover:text-foreground">Home</Link>
              <ChevronRight className="h-4 w-4" />
              <Link to="/products" className="hover:text-foreground">Products</Link>
              {product.category && (
                <>
                  <ChevronRight className="h-4 w-4" />
                  <Link 
                    to={`/products?category=${product.category.slug}`}
                    className="hover:text-foreground"
                  >
                    {product.category.name}
                  </Link>
                </>
              )}
              <ChevronRight className="h-4 w-4" />
              <span className="text-foreground">{product.name}</span>
            </nav>
          </div>
        </div>

        {/* Product Content */}
        <div className="container py-8">
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Image Gallery */}
            <div className="space-y-4">
              <div className="aspect-square overflow-hidden rounded-lg bg-muted">
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
              
              {images.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {images.map((image, index) => (
                    <button
                      key={image.id}
                      onClick={() => setSelectedImage(index)}
                      className={`relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border-2 transition-colors ${
                        selectedImage === index ? "border-foreground" : "border-transparent"
                      }`}
                    >
                      <img
                        src={image.url}
                        alt={image.alt_text || `${product.name} ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="space-y-6">
              <div>
                {product.category && (
                  <Link 
                    to={`/products?category=${product.category.slug}`}
                    className="text-sm text-muted-foreground hover:underline"
                  >
                    {product.category.name}
                  </Link>
                )}
                <h1 className="mt-1 font-display text-3xl font-bold text-foreground">
                  {product.name}
                </h1>
                {product.vendor?.full_name && (
                  <p className="mt-2 text-muted-foreground">
                    by <span className="font-medium">{product.vendor.full_name}</span>
                  </p>
                )}
              </div>

              {/* Price */}
              <div className="flex items-center gap-3">
                <span className="font-display text-3xl font-bold text-foreground">
                  {formatPrice(product.price)}
                </span>
                {hasDiscount && (
                  <>
                    <span className="text-xl text-muted-foreground line-through">
                      {formatPrice(product.compare_at_price!)}
                    </span>
                    <Badge variant="destructive">
                      {Math.round((1 - product.price / product.compare_at_price!) * 100)}% OFF
                    </Badge>
                  </>
                )}
              </div>

              {/* Description */}
              {product.description && (
                <p className="text-muted-foreground leading-relaxed">
                  {product.description}
                </p>
              )}

              {/* Sizes */}
              {sizes.length > 0 && (
                <div>
                  <p className="mb-2 font-medium">Size</p>
                  <div className="flex flex-wrap gap-2">
                    {sizes.map((size) => (
                      <Button
                        key={size}
                        variant="outline"
                        size="sm"
                        className="min-w-[3rem]"
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
                  <p className="mb-2 font-medium">Color</p>
                  <div className="flex flex-wrap gap-2">
                    {colors.map((color) => (
                      <Button
                        key={color}
                        variant="outline"
                        size="sm"
                      >
                        {color}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div>
                <p className="mb-2 font-medium">Quantity</p>
                <div className="flex items-center gap-3">
                  <div className="flex items-center rounded-md border">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-r-none"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-12 text-center font-medium">{quantity}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10 rounded-l-none"
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

              {/* Actions */}
              <div className="flex gap-3">
                <Button 
                  size="lg" 
                  className="flex-1 gap-2"
                  onClick={handleAddToCart}
                  disabled={product.stock_quantity === 0}
                >
                  <ShoppingCart className="h-5 w-5" />
                  Add to Cart
                </Button>
                <Button 
                  size="lg" 
                  variant="outline"
                  onClick={handleAddToWishlist}
                >
                  <Heart className="h-5 w-5" />
                </Button>
              </div>

              {/* Features */}
              <div className="grid gap-4 border-t pt-6 sm:grid-cols-3">
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">Free Shipping</p>
                    <p className="text-muted-foreground">On orders over ₦50,000</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">Secure Payment</p>
                    <p className="text-muted-foreground">100% protected</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <RotateCcw className="h-5 w-5 text-muted-foreground" />
                  <div className="text-sm">
                    <p className="font-medium">Easy Returns</p>
                    <p className="text-muted-foreground">7 day return policy</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
