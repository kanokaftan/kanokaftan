import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { useVendorOrders } from "@/hooks/useVendorOrders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShoppingCart } from "lucide-react";
import { format } from "date-fns";

export default function VendorOrders() {
  const { userId } = useVendorAuth();
  const { data: orders, isLoading } = useVendorOrders(userId);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "processing":
        return "bg-blue-100 text-blue-700";
      case "pending":
        return "bg-yellow-100 text-yellow-700";
      case "cancelled":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <VendorLayout title="Orders">
      <div className="space-y-6">
        <p className="text-muted-foreground">
          Track orders containing your products
        </p>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : orders?.length === 0 ? (
          <div className="text-center py-16 border rounded-lg bg-background">
            <ShoppingCart className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
            <p className="text-muted-foreground">
              Orders containing your products will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {orders?.map((order) => (
              <Card key={order.id}>
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
                    <Badge className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {/* Customer Info */}
                    <div className="text-sm">
                      <span className="text-muted-foreground">Customer: </span>
                      <span className="font-medium">
                        {order.customer?.[0]?.full_name || "Unknown"}
                      </span>
                      {order.customer?.[0]?.email && (
                        <span className="text-muted-foreground ml-2">
                          ({order.customer[0].email})
                        </span>
                      )}
                    </div>

                    {/* Order Items */}
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Product</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit Price</TableHead>
                          <TableHead className="text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {order.order_items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell>
                              {item.product?.name || "Product unavailable"}
                            </TableCell>
                            <TableCell className="text-right">
                              {item.quantity}
                            </TableCell>
                            <TableCell className="text-right">
                              {formatCurrency(item.unit_price)}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {formatCurrency(item.quantity * item.unit_price)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>

                    {/* Vendor Total */}
                    <div className="flex justify-end pt-2 border-t">
                      <div className="text-right">
                        <span className="text-muted-foreground mr-4">
                          Your earnings:
                        </span>
                        <span className="font-semibold text-lg">
                          {formatCurrency(
                            order.order_items.reduce(
                              (sum, item) => sum + item.quantity * item.unit_price,
                              0
                            )
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
