import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminListToolbar, type ListChip } from "@/components/admin/AdminListToolbar";
import { DeliveryActions } from "@/components/admin/DeliveryActions";
import { useAdminOrders, ADMIN_ORDER_FILTERS, DEFAULT_ORDER_FILTER, type AdminOrderFilter } from "@/hooks/useAdminOrders";
import { useAdminListState, useKeepPageInRange } from "@/hooks/useAdminListState";
import { totalPagesOf } from "@/hooks/adminList";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Boxes } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

const ORDER_CHIPS: ListChip<AdminOrderFilter>[] = [
  { value: "all", label: "All" },
  { value: "to_prepare", label: "Being prepared" },
  { value: "combined", label: "Combined (several sellers)" },
  { value: "in_transit", label: "On the way" },
  { value: "delivered", label: "Delivered" },
  { value: "unpaid", label: "Unpaid" },
  { value: "disputed", label: "Disputed" },
  { value: "cancelled", label: "Cancelled" },
];

export default function AdminOrders() {
  // Links from chats and seller pages open the list already searched (?q=<order id>, or the older ?search=).
  const list = useAdminListState({ filters: ADMIN_ORDER_FILTERS, defaultFilter: DEFAULT_ORDER_FILTER, legacySearchParam: "search" });
  const { orders, total, isLoading, isFetching, error, refetch, updateOrderStatus } = useAdminOrders(list.params);
  const { page, setPage, pageSize: PAGE_SIZE } = list;
  const totalPages = totalPagesOf(total, PAGE_SIZE);
  useKeepPageInRange(page, setPage, isLoading ? undefined : total, PAGE_SIZE);
  const paginatedOrders = orders;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "delivered": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "processing": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "payment_confirmed": return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400";
      case "shipped": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "out_for_delivery": return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400";
      case "pending": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
      case "pending_payment": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "cancelled": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400";
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case "paid": return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "pending": return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case "failed": return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      await updateOrderStatus.mutateAsync({ orderId, status: newStatus });
      toast.success("Order status updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update order status");
    }
  };

  const vendorNames = (order: (typeof orders)[number]) =>
    [...new Set(order.order_items.map(item => item.vendor?.store_name).filter(Boolean))].join(", ");

  const statuses = ["pending_payment", "payment_confirmed", "processing", "ready_for_pickup", "shipped", "out_for_delivery", "delivered", "completed", "cancelled"];

  return (
    <AdminLayout title="Orders">
      <AdminListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        placeholder="Order number, customer, email or payment ref"
        chips={ORDER_CHIPS}
        filter={list.filter}
        onFilterChange={list.setFilter}
        total={isLoading ? undefined : total}
        noun={["order", "orders"]}
        busy={list.isSearchPending || isFetching}
      />

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span className="text-destructive">{error instanceof Error ? error.message : "Couldn't load orders."}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      )}

      {/* Mobile View */}
      <div className="2xl:hidden space-y-3 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
        ) : orders.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No orders found</p>
        ) : (
          paginatedOrders.map((order) => (
            <div key={order.id} className="bg-card rounded-lg p-4 border">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-medium">{order.customer?.full_name || order.customer?.email || "Customer"}</p>
                  <p className="text-xs text-muted-foreground font-mono">#{order.id.slice(0, 8)}</p>
                  {order.seller_count > 1 && <SellersBadge count={order.seller_count} />}
                </div>
                <Badge className={`${getStatusColor(order.status)} capitalize`}>{order.status.replace(/_/g, " ")}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-muted-foreground">{format(new Date(order.created_at), "MMM dd, yyyy")}</span>
                <span className="font-semibold">{formatCurrency(Number(order.total))}</span>
              </div>
              <div className="flex items-center justify-between text-sm mb-3">
                <span className="text-muted-foreground">
                  {order.order_items.length} item{order.order_items.length > 1 ? "s" : ""}
                  {vendorNames(order) && <span className="block text-xs">Vendor: {vendorNames(order)}</span>}
                </span>
                <Badge className={getPaymentStatusColor(order.payment_status)} variant="outline">
                  {order.payment_status === "paid" ? "Paid" : order.payment_status === "pending" ? "Unpaid" : order.payment_status}
                </Badge>
              </div>
              <div className="pt-3 border-t space-y-2">
                <DeliveryActions orderId={order.id} paymentStatus={order.payment_status} escrowStatus={order.escrow_status} />
                <Select
                  value={order.status}
                  onValueChange={(value) => handleStatusUpdate(order.id, value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statuses.map(status => (
                      <SelectItem key={status} value={status} className="capitalize">{status.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Mobile pagination */}
      <div className="2xl:hidden mb-20">
        <AdminPagination page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Desktop Table */}
      <div className="hidden 2xl:block">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Order ID</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Vendor</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Payment</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={9}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : orders.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                    No orders found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedOrders.map((order) => (
                  <TableRow key={order.id}>
                    <TableCell className="font-mono text-sm">
                      #{order.id.slice(0, 8)}
                      {order.seller_count > 1 && <SellersBadge count={order.seller_count} />}
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{order.customer?.full_name || "No name"}</p>
                        <p className="text-sm text-muted-foreground">{order.customer?.email}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap [overflow-wrap:normal]">{vendorNames(order) || <span className="text-muted-foreground">—</span>}</TableCell>
                    <TableCell className="text-center whitespace-nowrap [overflow-wrap:normal]">{order.order_items.length}</TableCell>
                    <TableCell className="text-right font-medium whitespace-nowrap [overflow-wrap:normal]">{formatCurrency(Number(order.total))}</TableCell>
                    <TableCell>
                      <Badge className={getPaymentStatusColor(order.payment_status)}>
                        {order.payment_status === "paid" ? "Paid" : order.payment_status === "pending" ? "Unpaid" : order.payment_status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`${getStatusColor(order.status)} capitalize`}>{order.status.replace(/_/g, " ")}</Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{format(new Date(order.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell className="space-y-2">
                      <DeliveryActions orderId={order.id} paymentStatus={order.payment_status} escrowStatus={order.escrow_status} />
                      <Select
                        value={order.status}
                        onValueChange={(value) => handleStatusUpdate(order.id, value)}
                      >
                        <SelectTrigger className="w-[150px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statuses.map(status => (
                            <SelectItem key={status} value={status} className="capitalize">{status.replace(/_/g, " ")}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <AdminPagination page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}

/** Marks an order whose items come from several sellers (it ships as one combined shipment). */
function SellersBadge({ count }: { count: number }) {
  return (
    <span className="mt-1 flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 font-sans text-[11px] font-medium text-primary">
      <Boxes className="h-3 w-3" />
      {count} sellers
    </span>
  );
}
