import { useEffect, useState, useCallback, useRef } from "react";
import { trackOnce } from "@/lib/analytics";
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
  RefreshCw,
} from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { BuyerProtection } from "@/components/orders/BuyerProtection";
import { DeliveryCode } from "@/components/orders/DeliveryCode";
import { ChatWithUsButton } from "@/components/chat/ChatWithUsButton";
import { ReviewPrompt } from "@/components/reviews/ReviewPrompt";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders, Order } from "@/hooks/useOrders";
import { paymentEmail, usePayment } from "@/hooks/usePayment";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_payment: { label: "Pending Payment", color: "bg-primary", icon: CreditCard },
  payment_confirmed: { label: "Payment Confirmed", color: "bg-primary", icon: CheckCircle2 },
  processing: { label: "Processing", color: "bg-primary", icon: Package },
  shipped: { label: "Shipped", color: "bg-primary", icon: Truck },
  out_for_delivery: { label: "Out for Delivery", color: "bg-primary", icon: Truck },
  delivered: { label: "Delivered", color: "bg-primary", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-primary", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-500", icon: Package },
};

/** One "purchase" per order for analytics, however many times payment is re-checked. */
function recordPurchase(orderId: string, amount?: number) {
  trackOnce(`purchase:${orderId}`, "purchase", { value: amount });
}

export default function OrderDetail() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { orders, isLoading } = useOrders();
  const { payOrder, verifyPayment, isProcessing } = usePayment();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [order, setOrder] = useState<Order | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  // "?pay=1" links (e.g. sent in chat or WhatsApp) open checkout straight away;
  // payOrder() checks any earlier attempt itself, so skip the separate auto-check.
  const payOnOpen = searchParams.get("pay") === "1";
  const [hasAutoVerified, setHasAutoVerified] = useState(payOnOpen);
  const [hasAutoPaid, setHasAutoPaid] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const refetchOrders = useCallback(() => {
    if (user?.id) {
      queryClient.invalidateQueries({ queryKey: ['orders', user.id] });
    }
  }, [queryClient, user?.id]);

  // Coming back from Paystack (?verify=true&reference=…): check that payment once.
  // The reference is remembered so a re-render can't start the check (and its
  // "confirmed" pop-up) again, and the query is cleared through the router so
  // useSearchParams() really forgets it.
  const verifiedReferences = useRef(new Set<string>());
  useEffect(() => {
    const shouldVerify = searchParams.get("verify") === "true";
    const reference = searchParams.get("reference") || searchParams.get("trxref");
    if (!shouldVerify || !reference || !id || verifiedReferences.current.has(reference)) return;

    verifiedReferences.current.add(reference);
    setHasAutoVerified(true); // this check covers the "pending with a reference" one below
    setSearchParams({}, { replace: true });
    setIsVerifying(true);
    verifyPayment(reference, id)
      .then((result) => {
        if (result.success) {
          recordPurchase(id, result.amount);
          toast.success("Payment confirmed! Thank you.", { id: `paid-${id}` });
          refetchOrders();
        } else {
          toast.error(result.error || "We couldn't confirm the payment yet. Pull down to refresh in a moment.", { id: `paid-${id}` });
        }
      })
      .catch((error) => {
        console.error("[OrderDetail] payment check after checkout failed", { orderId: id, reference, error });
        toast.error("We couldn't check the payment. Please refresh in a moment.", { id: `paid-${id}` });
      })
      .finally(() => setIsVerifying(false));
  }, [searchParams, setSearchParams, id, verifyPayment, refetchOrders]);

  useEffect(() => {
    if (order && !hasAutoVerified && !isVerifying &&
        order.payment_status === 'pending' &&
        order.payment_reference) {
      setHasAutoVerified(true);
      setIsVerifying(true);

      verifyPayment(order.payment_reference, order.id)
        .then((result) => {
          if (result.success) {
            recordPurchase(order.id, Number(order.total));
            toast.success("Payment confirmed! Thank you.", { id: `paid-${order.id}` });
            refetchOrders();
          }
        })
        .catch((error) => console.error("[OrderDetail] automatic payment check failed", { orderId: order.id, error }))
        .finally(() => {
          setIsVerifying(false);
        });
    }
  }, [order, hasAutoVerified, isVerifying, verifyPayment, refetchOrders]);

  useEffect(() => {
    if (!isLoading && orders.length > 0) {
      const found = orders.find((o) => o.id === id);
      setOrder(found || null);
    }
  }, [orders, isLoading, id]);

  const handleRetryPayment = useCallback(async () => {
    const email = paymentEmail(user);
    if (!order || !email) {
      toast.error("Please sign in to pay for this order.");
      return;
    }
    setIsRedirecting(true);
    try {
      const result = await payOrder(order, email);
      if (result.outcome === "redirecting") {
        toast.success("Opening secure checkout…");
        return; // keep the button busy while the browser leaves for Paystack
      }
      if (result.outcome === "already_paid") {
        recordPurchase(order.id, Number(order.total));
        toast.success("Payment confirmed!");
        refetchOrders();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      console.error("[OrderDetail] could not start payment", { orderId: order.id, error });
      toast.error("We couldn't open the payment page. Please try again.");
    }
    setIsRedirecting(false);
  }, [order, user, payOrder, refetchOrders]);

  useEffect(() => {
    if (!payOnOpen || hasAutoPaid || !order) return;
    setHasAutoPaid(true);
    window.history.replaceState({}, "", `/orders/${order.id}`);
    if (order.status === "pending_payment" && order.payment_status === "pending") {
      handleRetryPayment();
    }
  }, [payOnOpen, hasAutoPaid, order, handleRetryPayment]);

  if (isLoading || isVerifying) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          {isVerifying && (
            <div className="mb-4 flex items-center justify-center gap-2 rounded-lg bg-primary/10 p-4 text-primary">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="font-medium">{t("orders.verifyingPayment")}</span>
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
          <h1 className="text-lg font-bold">{t("orders.notFound")}</h1>
          <Button asChild className="mt-4">
            <Link to="/orders">{t("orders.viewAllOrders")}</Link>
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const status = statusConfig[order.status] || statusConfig.processing;
  const StatusIcon = status.icon;
  // Still unpaid: always offer to pay, even after an abandoned checkout.
  const showPayButton = order.status === "pending_payment" && order.payment_status === "pending";
  // A checkout was started before: also let the buyer re-check it.
  const showVerifyButton = showPayButton && !!order.payment_reference && !isVerifying;
  const paying = isProcessing || isRedirecting;

  const handleManualVerify = async () => {
    if (!order?.payment_reference) return;
    setIsVerifying(true);
    try {
      const result = await verifyPayment(order.payment_reference, order.id);
      if (result.success) {
        recordPurchase(order.id, Number(order.total));
        toast.success("Payment confirmed!");
        refetchOrders();
      } else {
        // Usually the checkout was closed before paying; point them back to Pay.
        toast.info("We haven't received this payment yet. Tap Pay to finish paying.");
      }
    } catch (error) {
      console.error("[OrderDetail] manual payment check failed", { orderId: order.id, error });
      toast.error("We couldn't check the payment. Please try again.");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <MobileLayout>
      <div className="px-4 py-6 pb-24">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/orders">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="font-display text-lg font-bold">{t("orders.orderDetails")}</h1>
            <p className="text-xs text-muted-foreground">
              #{order.id.slice(0, 8).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Payment Required Banner */}
        {showPayButton && (
          <div className="mb-4 rounded-xl bg-muted border border-border p-4">
            <div className="flex items-center gap-2 text-foreground mb-3">
              <CreditCard className="h-5 w-5" />
              <span className="font-medium">{t("orders.paymentRequired")}</span>
            </div>
            <p className="text-sm text-foreground mb-3">
              {t("orders.paymentRequiredDesc")}
            </p>
            <Button
              className="w-full"
              onClick={handleRetryPayment}
              disabled={paying}
            >
              {paying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("checkout.processing")}
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  {t("orders.pay")} {formatPrice(order.total)}
                </>
              )}
            </Button>
            {showVerifyButton && (
              <button
                type="button"
                onClick={handleManualVerify}
                disabled={paying}
                className="mt-3 flex w-full items-center justify-center gap-1.5 text-sm font-medium text-foreground underline-offset-2 hover:underline"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                {t("orders.alreadyPaidCheck", "Already paid? Check again")}
              </button>
            )}
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
                {t("orders.placedOn")} {format(new Date(order.created_at), "MMM d, yyyy 'at' h:mm a")}
              </p>
            </div>
          </div>

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

          <DeliveryCode orderId={order.id} />
          <BuyerProtection order={order} />
        </div>

        {/* Delivery Address */}
        <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-medium">{t("orders.deliveryAddress")}</h2>
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
              {t("orders.landmark")}: {order.shipping_address.landmark}
            </p>
          )}
          <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground">
            <Phone className="h-3 w-3" />
            {order.shipping_address.phone}
          </div>
        </div>

        {/* Order Items */}
        <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-medium">{t("orders.orderItems")}</h2>
          <div className="space-y-3">
            {order.order_items?.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <div>
                  <p className="font-medium">{item.product_name}</p>
                  {(item.variant_name || item.size || item.color) && (
                    <p className="text-xs text-muted-foreground">
                      {item.variant_name || [item.size, item.color].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground">{t("orders.qty")}: {item.quantity}</p>
                </div>
                <p className="font-medium">{formatPrice(item.total_price)}</p>
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("orders.subtotal")}</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">{t("orders.shipping")}</span>
              <span>
                {order.shipping_fee === 0 ? (
                  <span className="text-foreground">{t("orders.free")}</span>
                ) : (
                  formatPrice(order.shipping_fee)
                )}
              </span>
            </div>
          </div>

          <Separator className="my-3" />

          <div className="flex justify-between font-display font-bold">
            <span>{t("orders.total")}</span>
            <span>{formatPrice(order.total)}</span>
          </div>
        </div>

        {(order.status === "delivered" || order.status === "completed") && (
          <ReviewPrompt orderId={order.id} className="mt-4" />
        )}

        {/* Order Notes */}
        {order.notes && (
          <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
            <div className="mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-primary" />
              <h2 className="font-medium">{t("orders.orderNotes")}</h2>
            </div>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </div>
        )}

        {/* Help Section */}
        <div className="mt-6 text-center">
          <p className="text-sm text-muted-foreground">{t("orders.needHelp")}</p>
          <ChatWithUsButton variant="link" className="mt-1" label={t("orders.contactSupport")} />
        </div>
      </div>
    </MobileLayout>
  );
}
