import { useEffect, useState } from "react";
import { useParams, Link, useSearchParams } from "react-router-dom";
import { format } from "date-fns";
import {
  Package,
  MapPin,
  CheckCircle2,
  Truck,
  CreditCard,
  ArrowLeft,
  Phone,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders, Order } from "@/hooks/useOrders";
import { usePayment } from "@/hooks/usePayment";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_payment: { label: "Pending Payment", color: "bg-yellow-500", icon: CreditCard },
  payment_confirmed: { label: "Payment Confirmed", color: "bg-blue-500", icon: CheckCircle2 },
  processing: { label: "Processing", color: "bg-blue-500", icon: Package },
  shipped: { label: "Shipped", color: "bg-purple-500", icon: Truck },
  out_for_delivery: { label: "Out for Delivery", color: "bg-purple-500", icon: Truck },
  delivered: { label: "Delivered", color: "bg-green-500", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-green-500", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-500", icon: Package },
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { orders, isLoading, confirmDelivery } = useOrders();
  const { initiatePayment, verifyPayment, isProcessing } = usePayment();
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Handle payment verification on return from Paystack
  useEffect(() => {
    const shouldVerify = searchParams.get("verify") === "true";
    const reference = searchParams.get("reference") || searchParams.get("trxref");

    if (shouldVerify && reference && id) {
      setIsVerifying(true);
      verifyPayment(reference, id)
        .then((result) => {
          if (result.success) {
            toast.success("Payment verified successfully!");
          } else {
            toast.error(result.error || "Payment verification failed");
          }
        })
        .finally(() => {
          setIsVerifying(false);
          // Clean up URL params
          window.history.replaceState({}, "", `/orders/${id}`);
        });
    }
  }, [searchParams, id, verifyPayment]);

  useEffect(() => {
    if (!isLoading && orders.length > 0) {
      const found = orders.find((o) => o.id === id);
      setOrder(found || null);
    }
  }, [orders, isLoading, id]);

  const handleConfirmDelivery = async () => {
    if (!order) return;
    try {
      await confirmDelivery.mutateAsync(order.id);
      toast.success("Delivery confirmed! Payment released to seller.");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to confirm delivery";
      toast.error(message);
    }
  };

  const handleRetryPayment = async () => {
    if (!order || !user?.email) {
      toast.error("Unable to process payment");
      return;
    }

    console.log("Retrying payment for order:", order.id);
    const paymentResult = await initiatePayment(order.id, user.email);
    console.log("Payment result:", paymentResult);

    if (paymentResult.success && paymentResult.authorization_url) {
      toast.success("Redirecting to payment...");
      window.location.href = paymentResult.authorization_url;
    } else {
      console.error("Payment failed:", paymentResult.error);
      toast.error(paymentResult.error || "Failed to initialize payment");
    }
  };

  if (isLoading || isVerifying) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          {isVerifying && (
            <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-primary/10 p-4 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">Verifying payment...</span>
            </div>
          )}
          <Skeleton className="mb-6 h-8 w-48" />
          <Skeleton className="mb-4 h-32 w-full rounded-xl" />
          <Skeleton className="mb-4 h-48 w-full rounded-xl" />
          <Skeleton className="h-24 w-full rounded-xl" />
        </div>
      </MobileLayout>
    );
  }

  if (!order) {
    return (
      <MobileLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-6">
          <Package className="mb-4 h-12 w-12 text-muted-foreground" />
          <h1 className="text-lg font-bold">Order not found</h1>
          <Button asChild className="mt-4">
            <Link to="/orders">View All Orders</Link>
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const status = statusConfig[order.status] || statusConfig.processing;
  const StatusIcon = status.icon;
  const showPayButton = order.status === "pending_payment" && order.payment_status === "pending";

  return (
    <MobileLayout>
      <div className="px-4 py-6">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-lg font-bold">Order Details</h1>
            <p className="text-xs text-muted-foreground">
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Payment Required Banner */}
        {showPayButton && (
          <div className="mb-4 rounded-xl bg-yellow-50 border border-yellow-200 p-4">
            <div className="flex items-center gap-2 text-yellow-800 mb-3">
              <CreditCard className="h-5 w-5" />
              <span className="font-medium">Payment Required</span>
            </div>
            <p className="text-sm text-yellow-700 mb-3">
              Complete your payment to confirm this order.
            </p>
            <Button 
              className="w-full" 
              onClick={handleRetryPayment}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Pay {formatPrice(order.total)}
                </>
              )}
            </Button>
          </div>
        )}

        {/* Status Card */}
        <div className="rounded-xl bg-card p-4 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`rounded-full p-2 text-white ${status.color}`}>
              <StatusIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium">{status.label}</p>
              <p className="text-sm text-muted-foreground">
                Placed on {format(new Date(order.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>

          {/* Timeline */}
          {order.tracking_updates && order.tracking_updates.length > 0 && (
            <div className="mt-4 space-y-3 border-t pt-4">
              {order.tracking_updates.map((update, index) => (
                <div key={index} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                    {index < order.tracking_updates.length - 1 && (
                      <div className="h-full w-px bg-border" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">{update.status}</p>
                    <p className="text-xs text-muted-foreground">{update.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(update.timestamp), "MMM d, h:mm a")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Confirm Delivery Button */}
          {order.status === "delivered" && !order.confirmed_at && (
            <Button className="mt-4 w-full" onClick={handleConfirmDelivery}>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirm Receipt
            </Button>
          )}
        </div>

        {/* Delivery Address */}
        <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-medium">Delivery Address</h2>
          </div>
          <p className="text-sm font-medium">{order.shipping_address.full_name}</p>
          <p className="text-sm text-muted-foreground">
            {order.shipping_address.street_address}
          </p>
          <p className="text-sm text-muted-foreground">
            {order.shipping_address.city}, {order.shipping_address.state}
          </p>
          {order.shipping_address.landmark && (
            <p className="text-sm text-muted-foreground">
              Landmark: {order.shipping_address.landmark}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            {order.shipping_address.phone}
          </div>
        </div>

        {/* Order Items */}
        <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-medium">Order Items</h2>
          <div className="space-y-3">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  {item.variant_name && (
                    <p className="text-xs text-muted-foreground">{item.variant_name}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <p className="font-medium">{formatPrice(item.total_price)}</p>
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Shipping</span>
              <span>
                {order.shipping_fee === 0 ? (
                  <span className="text-green-600">Free</span>
                ) : (
                  formatPrice(order.shipping_fee)
                )}
              </span>
            </div>
          </div>

          <Separator className="my-3" />

          <div className="flex justify-between font-display font-bold">
            <span>Total</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        {/* Order Notes */}
        {order.notes && (
          <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="font-medium">Order Notes</h2>
            </div>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">Need help with your order?</p>
          <Button variant="link" className="mt-1">
            Contact Support
          </Button>
        </div>
      </div>
    </MobileLayout>
  );
}
