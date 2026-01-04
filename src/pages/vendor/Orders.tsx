import { useState } from "react";
import { VendorLayout } from "@/components/vendor/VendorLayout";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { useVendorOrders, VendorOrder, OrderStatus } from "@/hooks/useVendorOrders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShoppingCart,
  Package,
  Truck,
  CheckCircle2,
  Clock,
  MapPin,
  Phone,
  User,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const statusConfig: Record<string, { label: string; color: string; icon: React.ElementType }> = {
  pending_payment: { label: "Pending Payment", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  payment_confirmed: { label: "Payment Confirmed", color: "bg-blue-100 text-blue-700", icon: CheckCircle2 },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-700", icon: Package },
  ready_for_pickup: { label: "Ready for Pickup", color: "bg-purple-100 text-purple-700", icon: Package },
  shipped: { label: "Shipped", color: "bg-purple-100 text-purple-700", icon: Truck },
  out_for_delivery: { label: "Out for Delivery", color: "bg-purple-100 text-purple-700", icon: Truck },
  delivered: { label: "Delivered", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  completed: { label: "Completed", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  cancelled: { label: "Cancelled", color: "bg-red-100 text-red-700", icon: Package },
};

const statusFlow: OrderStatus[] = [
  "payment_confirmed",
  "processing",
  "ready_for_pickup",
  "shipped",
  "out_for_delivery",
  "delivered",
];

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

function getNextStatuses(currentStatus: string): OrderStatus[] {
  const currentIndex = statusFlow.indexOf(currentStatus as OrderStatus);
  if (currentIndex === -1 || currentStatus === "pending_payment") return [];
  return statusFlow.slice(currentIndex + 1);
}

interface OrderCardProps {
  order: VendorOrder;
  onUpdateStatus: (orderId: string, status: OrderStatus, message: string) => void;
  isUpdating: boolean;
}

function OrderCard({ order, onUpdateStatus, isUpdating }: OrderCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [showStatusDialog, setShowStatusDialog] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | "">("");
  const [statusMessage, setStatusMessage] = useState("");

  const status = statusConfig[order.status] || statusConfig.processing;
  const StatusIcon = status.icon;
  const nextStatuses = getNextStatuses(order.status);
  const vendorTotal = order.order_items.reduce((sum, item) => sum + item.total_price, 0);

  const handleStatusUpdate = () => {
    if (!selectedStatus) return;
    onUpdateStatus(order.id, selectedStatus, statusMessage || `Order ${selectedStatus.replace(/_/g, " ")}`);
    setShowStatusDialog(false);
    setSelectedStatus("");
    setStatusMessage("");
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">
              Order #{order.id.slice(0, 8).toUpperCase()}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.created_at), "PPP 'at' p")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={status.color}>
              <StatusIcon className="mr-1 h-3 w-3" />
              {status.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Customer Info */}
        <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3">
          <User className="mt-0.5 h-4 w-4 text-muted-foreground" />
          <div className="flex-1 text-sm">
            <p className="font-medium">{order.customer?.full_name || order.shipping_address.full_name}</p>
            <p className="text-muted-foreground">{order.customer?.email}</p>
          </div>
        </div>

        {/* Order Items Summary */}
        <div className="space-y-2">
          {order.order_items.map((item) => (
            <div key={item.id} className="flex justify-between text-sm">
              <span>
                {item.product_name}
                {item.variant_name && <span className="text-muted-foreground"> ({item.variant_name})</span>}
                <span className="text-muted-foreground"> × {item.quantity}</span>
              </span>
              <span className="font-medium">{formatCurrency(item.total_price)}</span>
            </div>
          ))}
          <div className="flex justify-between border-t pt-2 font-medium">
            <span>Your Earnings</span>
            <span>{formatCurrency(vendorTotal)}</span>
          </div>
        </div>

        {/* Expandable Details */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? (
            <>
              <ChevronUp className="mr-1 h-4 w-4" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-4 w-4" />
              Show Details
            </>
          )}
        </Button>

        {expanded && (
          <div className="space-y-4 border-t pt-4">
            {/* Shipping Address */}
            <div className="space-y-2">
              <h4 className="flex items-center gap-2 text-sm font-medium">
                <MapPin className="h-4 w-4" />
                Shipping Address
              </h4>
              <div className="rounded-lg bg-muted/50 p-3 text-sm">
                <p className="font-medium">{order.shipping_address.full_name}</p>
                <p className="text-muted-foreground">{order.shipping_address.street_address}</p>
                <p className="text-muted-foreground">
                  {order.shipping_address.city}, {order.shipping_address.state}
                </p>
                {order.shipping_address.landmark && (
                  <p className="text-muted-foreground">Landmark: {order.shipping_address.landmark}</p>
                )}
                <p className="mt-2 flex items-center gap-1 text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {order.shipping_address.phone}
                </p>
              </div>
            </div>

            {/* Order Notes */}
            {order.notes && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Order Notes</h4>
                <p className="rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">
                  {order.notes}
                </p>
              </div>
            )}

            {/* Tracking History */}
            {order.tracking_updates.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-medium">Tracking History</h4>
                <div className="space-y-2">
                  {order.tracking_updates.map((update, index) => (
                    <div key={index} className="flex gap-3 text-sm">
                      <div className="flex flex-col items-center">
                        <div className="h-2 w-2 rounded-full bg-primary" />
                        {index < order.tracking_updates.length - 1 && (
                          <div className="h-full w-px bg-border" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium">{update.message}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(update.timestamp), "MMM d, h:mm a")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Update Status Button */}
        {nextStatuses.length > 0 && order.payment_status === "paid" && (
          <Button 
            className="w-full" 
            onClick={() => setShowStatusDialog(true)}
            disabled={isUpdating}
          >
            Update Status
          </Button>
        )}

        {/* Status Update Dialog */}
        <Dialog open={showStatusDialog} onOpenChange={setShowStatusDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Order Status</DialogTitle>
              <DialogDescription>
                Select the new status for order #{order.id.slice(0, 8).toUpperCase()}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Status</label>
                <Select value={selectedStatus} onValueChange={(v) => setSelectedStatus(v as OrderStatus)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {nextStatuses.map((s) => (
                      <SelectItem key={s} value={s}>
                        {statusConfig[s]?.label || s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Message (Optional)</label>
                <Textarea
                  placeholder="Add a note about this status update..."
                  value={statusMessage}
                  onChange={(e) => setStatusMessage(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStatusDialog(false)}>
                Cancel
              </Button>
              <Button onClick={handleStatusUpdate} disabled={!selectedStatus || isUpdating}>
                {isUpdating ? "Updating..." : "Update Status"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

export default function VendorOrders() {
  const { userId } = useVendorAuth();
  const { orders, isLoading, updateOrderStatus } = useVendorOrders(userId);

  const handleUpdateStatus = async (orderId: string, status: OrderStatus, message: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status, message });
      toast.success("Order status updated");
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : "Failed to update status";
      toast.error(msg);
    }
  };

  const pendingOrders = orders.filter((o) => 
    ["payment_confirmed", "processing"].includes(o.status)
  );
  const shippedOrders = orders.filter((o) => 
    ["ready_for_pickup", "shipped", "out_for_delivery"].includes(o.status)
  );
  const completedOrders = orders.filter((o) => 
    ["delivered", "completed"].includes(o.status)
  );

  return (
    <VendorLayout title="Orders">
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Manage orders and update delivery status
        </p>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-48 w-full" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-lg border bg-background py-16 text-center">
            <ShoppingCart className="mx-auto mb-4 h-16 w-16 text-muted-foreground opacity-50" />
            <h3 className="mb-2 text-lg font-semibold">No orders yet</h3>
            <p className="text-muted-foreground">
              Orders containing your products will appear here
            </p>
          </div>
        ) : (
          <Tabs defaultValue="pending" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending" className="relative">
                Pending
                {pendingOrders.length > 0 && (
                  <span className="ml-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">
                    {pendingOrders.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="shipped">
                Shipped
                {shippedOrders.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">
                    {shippedOrders.length}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger value="completed">
                Completed
                {completedOrders.length > 0 && (
                  <span className="ml-1 rounded-full bg-muted px-1.5 text-xs">
                    {completedOrders.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {pendingOrders.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No pending orders</p>
              ) : (
                pendingOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onUpdateStatus={handleUpdateStatus}
                    isUpdating={updateOrderStatus.isPending}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="shipped" className="space-y-4">
              {shippedOrders.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No shipped orders</p>
              ) : (
                shippedOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onUpdateStatus={handleUpdateStatus}
                    isUpdating={updateOrderStatus.isPending}
                  />
                ))
              )}
            </TabsContent>

            <TabsContent value="completed" className="space-y-4">
              {completedOrders.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No completed orders</p>
              ) : (
                completedOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    onUpdateStatus={handleUpdateStatus}
                    isUpdating={updateOrderStatus.isPending}
                  />
                ))
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </VendorLayout>
  );
}
