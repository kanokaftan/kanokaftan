import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Cart() {
  const { items, isLoading, total, updateQuantity, removeItem, clearCart } = useCart();

  const handleUpdateQuantity = (itemId: string, newQuantity: number) => {
    updateQuantity.mutate({ itemId, quantity: newQuantity });
  };

  const handleRemoveItem = (itemId: string, productName: string) => {
    removeItem.mutate(itemId, {
      onSuccess: () => toast.success(`${productName} removed from cart`),
    });
  };

  const handleClearCart = () => {
    clearCart.mutate(undefined, {
      onSuccess: () => toast.success("Cart cleared"),
    });
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          <Skeleton className="mb-6 h-8 w-36" />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (items.length === 0) {
    return (
      <MobileLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-6">
          <div className="rounded-full bg-muted p-6">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
          <h1 className="mt-6 text-lg font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            Looks like you haven't added anything yet
          </p>
          <Button asChild className="mt-6">
            <Link to="/products">
              Start Shopping
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const shippingFee = total >= 50000 ? 0 : 3500;
  const grandTotal = total + shippingFee;

  return (
    <MobileLayout>
      <div className="px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Cart</h1>
          <Button variant="ghost" size="sm" onClick={handleClearCart}>
            Clear
          </Button>
        </div>

        {/* Cart Items */}
        <div className="space-y-3">
          {items.map((item) => {
            const primaryImage = item.product.product_images?.find(img => img.is_primary);
            const imageUrl = primaryImage?.url || item.product.product_images?.[0]?.url;

            return (
              <div
                key={item.id}
                className="flex gap-3 rounded-xl bg-card p-3 shadow-sm"
              >
                {/* Image */}
                <Link
                  to={`/products/${item.product.slug}`}
                  className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted"
                >
                  {imageUrl ? (
                    <img
                      src={imageUrl}
                      alt={item.product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No Image
                    </div>
                  )}
                </Link>

                {/* Info */}
                <div className="flex flex-1 flex-col">
                  <div className="flex justify-between">
                    <Link
                      to={`/products/${item.product.slug}`}
                      className="text-sm font-medium line-clamp-2"
                    >
                      {item.product.name}
                    </Link>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 -mr-1 -mt-1 text-muted-foreground hover:text-destructive"
                      onClick={() => handleRemoveItem(item.id, item.product.name)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center rounded-full border">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="w-6 text-center text-sm font-medium">
                        {item.quantity}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)}
                        disabled={item.quantity >= item.product.stock_quantity}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <p className="font-display text-sm font-bold">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary */}
        <div className="mt-6 rounded-xl bg-muted/50 p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span>
                {shippingFee === 0 ? (
                  <span className="text-green-600">Free</span>
                ) : (
                  formatPrice(shippingFee)
                )}
              </span>
            </div>
            {shippingFee > 0 && (
              <p className="text-xs text-muted-foreground">
                Free shipping on orders over ₦50,000
              </p>
            )}
          </div>

          <Separator className="my-3" />

          <div className="flex justify-between font-display font-bold">
            <span>Total</span>
            <span>{formatPrice(grandTotal)}</span>
          </div>
        </div>

        {/* Checkout Button */}
        <Button asChild className="mt-4 w-full" size="lg">
          <Link to="/checkout">
            Proceed to Checkout
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </MobileLayout>
  );
}
