import { Link } from "react-router-dom";
import { Minus, Plus, Trash2, ShoppingBag, ArrowRight, Truck, Percent } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useCart } from "@/hooks/useCart";
import { toast } from "sonner";
import {
  formatShippingRange,
  getNextDiscountTier,
  getDiscountTierDescription,
} from "@/lib/shipping";
import { useTranslation } from "react-i18next";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function Cart() {
  const { t } = useTranslation();
  const { items, total, addToCart, removeFromCart, clearCart } = useCart();

  const handleUpdateQuantity = (item: ReturnType<typeof useCart>["items"][number], newQuantity: number) => {
    if (newQuantity <= 0) {
      removeFromCart(item.product_id);
      toast.success(`${item.name} ${t("cart.remove").toLowerCase()}d`);
    } else {
      const updated = { ...item, quantity: newQuantity };
      removeFromCart(item.product_id);
      addToCart({ ...updated, quantity: newQuantity });
    }
  };

  const handleRemoveItem = (productId: string, productName: string) => {
    removeFromCart(productId);
    toast.success(`${productName} removed from cart`);
  };

  const handleClearCart = () => {
    clearCart();
    toast.success("Cart cleared");
  };

  if (items.length === 0) {
    return (
      <MobileLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-6">
          <div className="rounded-full bg-muted p-6">
            <ShoppingBag className="h-12 w-12 text-muted-foreground" />
          </div>
          <h1 className="mt-6 text-lg font-bold">{t("cart.empty")}</h1>
          <p className="mt-2 text-sm text-muted-foreground text-center">
            {t("cart.emptyDesc2")}
          </p>
          <Button asChild className="mt-6">
            <Link to="/products">
              {t("cart.startShopping")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const nextTier = getNextDiscountTier(total);
  const currentDiscount = getDiscountTierDescription(total);

  return (
    <MobileLayout>
      <div className="px-4 py-6">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">{t("cart.title")}</h1>
          <Button variant="ghost" size="sm" onClick={handleClearCart}>
            {t("cart.clear")}
          </Button>
        </div>

        {/* Cart Items */}
        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex gap-3 rounded-xl bg-card p-3 shadow-sm"
            >
              {/* Image */}
              <div className="h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                {item.image ? (
                  <img
                    src={item.image}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                    {t("products.noImage")}
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex flex-1 flex-col">
                <div className="flex justify-between">
                  <p className="text-sm font-medium line-clamp-2">{item.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 -mr-1 -mt-1 text-muted-foreground hover:text-destructive"
                    onClick={() => handleRemoveItem(item.product_id, item.name)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {(item.size || item.color) && (
                  <p className="text-xs text-muted-foreground">
                    {[item.size, item.color].filter(Boolean).join(" · ")}
                  </p>
                )}

                <div className="mt-auto flex items-center justify-between pt-2">
                  <div className="flex items-center rounded-full border">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => handleUpdateQuantity(item, item.quantity - 1)}
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
                      onClick={() => handleUpdateQuantity(item, item.quantity + 1)}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                  </div>

                  <p className="font-display text-sm font-bold">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Shipping Discount Progress */}
        {nextTier && (
          <div className="mt-4 rounded-xl bg-primary/5 p-4">
            <div className="flex items-center gap-2 text-sm font-medium text-primary">
              <Truck className="h-4 w-4" />
              <span>
                Spend {formatPrice(nextTier.amountNeeded)} more for{" "}
                {Math.round(nextTier.nextDiscount * 100)}% off shipping!
              </span>
            </div>
            <Progress
              value={(total / nextTier.nextThreshold) * 100}
              className="mt-2 h-2"
            />
          </div>
        )}

        {currentDiscount && (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-full bg-green-100 px-4 py-2 text-sm font-medium text-green-700">
            <Percent className="h-4 w-4" />
            <span>You're getting {currentDiscount}!</span>
          </div>
        )}

        {/* Order Summary */}
        <div className="mt-6 rounded-xl bg-muted/50 p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("cart.subtotal")}</span>
              <span>{formatPrice(total)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("cart.shipping")}</span>
              <span className="text-muted-foreground">{formatShippingRange()}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("cart.shippingCalc")}
            </p>
          </div>

          <Separator className="my-3" />

          <div className="flex justify-between font-display font-bold">
            <span>{t("cart.subtotal")}</span>
            <span>{formatPrice(total)}</span>
          </div>
        </div>

        {/* Checkout Button */}
        <Button asChild className="mt-4 w-full" size="lg">
          <Link to="/checkout">
            {t("cart.checkout")}
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </MobileLayout>
  );
}
