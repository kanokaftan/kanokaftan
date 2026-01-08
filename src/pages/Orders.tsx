import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { Package, ChevronRight, CreditCard, CheckCircle2, Truck } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders } from "@/hooks/useOrders";
import { useAuth } from "@/contexts/AuthContext";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  pending_payment: { label: "Pending Payment", variant: "outline", icon: CreditCard },
  payment_confirmed: { label: "Confirmed", variant: "secondary", icon: CheckCircle2 },
  processing: { label: "Processing", variant: "secondary", icon: Package },
  shipped: { label: "Shipped", variant: "default", icon: Truck },
  out_for_delivery: { label: "Out for Delivery", variant: "default", icon: Truck },
  delivered: { label: "Delivered", variant: "default", icon: CheckCircle2 },
  completed: { label: "Completed", variant: "default", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", variant: "destructive", icon: Package },
};

export default function Orders() {
  const navigate = useNavigate();
  const { orders, isLoading } = useOrders();
  const { user, isLoading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?redirect=/orders");
    }
  }, [user, authLoading, navigate]);

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          <Skeleton className="mb-6 h-8 w-36" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="px-4 py-6 pb-24">
        <h1 className="mb-6 font-display text-xl font-bold">My Orders</h1>

        {orders.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium">No orders yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When you place orders, they will appear here.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/products">Start Shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => {
              const status = statusConfig[order.status] || statusConfig.processing;
              const StatusIcon = status.icon;
              const itemCount = order.order_items?.length || 0;

              return (
                <Link
                  key={order.id}
                  to={`/orders/${order.id}`}
                  className="block rounded-xl bg-card p-4 shadow-sm border transition-all hover:shadow-md hover:border-primary/20"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">
                          #{order.id.slice(0, 8).toUpperCase()}
                        </p>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {format(new Date(order.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                      <div className="mt-3 flex items-center gap-3">
                        <p className="text-sm text-muted-foreground">
                          {itemCount} {itemCount === 1 ? "item" : "items"}
                        </p>
                        {order.payment_status === "pending" && (
                          <Badge variant="outline" className="text-amber-600 border-amber-300 bg-amber-50">
                            <CreditCard className="h-3 w-3 mr-1" />
                            Awaiting Payment
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <p className="font-display font-bold">{formatPrice(order.total)}</p>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
