import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_LIST_STALE_TIME_MS,
  adminRpcError,
  num,
  pagingArgs,
  parseAdminListResult,
  recordList,
  recordOrNull,
  resolveListParams,
  str,
  strOrNull,
  type AdminListPage,
  type AdminListParams,
  type ResolvedListParams,
} from "@/hooks/adminList";

const RPC = "admin_list_orders";
const ORDER_ID_PREVIEW_LENGTH = 8;

export const ADMIN_ORDER_FILTERS = [
  "all",
  "unpaid",
  "to_prepare",
  "in_transit",
  "delivered",
  "cancelled",
  "disputed",
  "combined",
] as const;
export type AdminOrderFilter = (typeof ADMIN_ORDER_FILTERS)[number];
export const DEFAULT_ORDER_FILTER: AdminOrderFilter = "all";

export interface AdminOrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  vendor: { store_name: string | null } | null;
}

export interface AdminOrder {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  escrow_status: string | null;
  total: number;
  subtotal: number;
  shipping_fee: number;
  shipping_address: unknown;
  created_at: string;
  dispute_status: string | null;
  customer: { full_name: string | null; email: string } | null;
  /** Number of different sellers in the order; above 1 it ships as a combined order. */
  seller_count: number;
  order_items: AdminOrderItem[];
}

function toAdminOrder(row: Record<string, unknown>): AdminOrder {
  const customer = recordOrNull(row.customer);
  return {
    id: str(row.id),
    user_id: str(row.user_id),
    status: str(row.status),
    payment_status: str(row.payment_status),
    escrow_status: strOrNull(row.escrow_status),
    total: num(row.total),
    subtotal: num(row.subtotal),
    shipping_fee: num(row.shipping_fee),
    shipping_address: row.shipping_address ?? null,
    created_at: str(row.created_at),
    dispute_status: strOrNull(row.dispute_status),
    customer: customer ? { full_name: strOrNull(customer.full_name), email: str(customer.email) } : null,
    seller_count: num(row.seller_count),
    order_items: recordList(row.order_items).map((item) => {
      const vendor = recordOrNull(item.vendor);
      return {
        id: str(item.id),
        product_name: str(item.product_name),
        quantity: num(item.quantity),
        unit_price: num(item.unit_price),
        total_price: num(item.total_price),
        vendor: vendor ? { store_name: strOrNull(vendor.store_name) } : null,
      };
    }),
  };
}

async function fetchOrdersPage(params: ResolvedListParams<AdminOrderFilter>): Promise<AdminListPage<AdminOrder>> {
  const { data, error } = await supabase.rpc(RPC, { ...pagingArgs(params), p_filter: params.filter });
  if (error) throw adminRpcError(RPC, error, params);
  return parseAdminListResult(data, RPC, toAdminOrder);
}

const readableStatus = (status: string) => status.replace(/_/g, " ");

/** Tells the customer and every seller in the order. Returns false if any notification could not be saved. */
async function notifyStatusChange(orderId: string, customerId: string | null, status: string): Promise<boolean> {
  let allSent = true;

  if (customerId) {
    const { error } = await supabase.from("notifications").insert({
      user_id: customerId,
      title: "Order Status Updated",
      message: `Your order status has been updated to: ${readableStatus(status)}`,
      type: "order",
      category: "order",
      action_url: `/orders/${orderId}`,
      metadata: { order_id: orderId, status },
    });
    if (error) {
      console.error("[useAdminOrders] customer notification failed", { orderId, status, error });
      allSent = false;
    }
  }

  const { data: orderItems, error: itemsError } = await supabase.from("order_items").select("vendor_id").eq("order_id", orderId);
  if (itemsError) {
    console.error("[useAdminOrders] loading sellers to notify failed", { orderId, error: itemsError });
    return false;
  }

  const vendorIds = [...new Set((orderItems ?? []).map((item) => item.vendor_id))];
  if (vendorIds.length) {
    const { error } = await supabase.from("notifications").insert(
      vendorIds.map((vendorId) => ({
        user_id: vendorId,
        title: "Order Status Updated by Admin",
        message: `Order #${orderId.slice(0, ORDER_ID_PREVIEW_LENGTH)} status changed to: ${readableStatus(status)}`,
        type: "order" as const,
        category: "order" as const,
        action_url: "/vendor/orders",
        metadata: { order_id: orderId, status },
      })),
    );
    if (error) {
      console.error("[useAdminOrders] seller notifications failed", { orderId, status, error });
      allSent = false;
    }
  }

  return allSent;
}

/** One page of orders, searched (order id, customer, payment reference) and filtered in the database. */
export function useAdminOrders(params: AdminListParams<AdminOrderFilter> = {}) {
  const queryClient = useQueryClient();
  const resolved = resolveListParams(params, DEFAULT_ORDER_FILTER);

  const ordersQuery = useQuery({
    queryKey: ["admin-orders", "list", resolved],
    queryFn: () => fetchOrdersPage(resolved),
    placeholderData: keepPreviousData,
    staleTime: ADMIN_LIST_STALE_TIME_MS,
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }): Promise<{ notified: boolean }> => {
      const { data: order, error: fetchError } = await supabase.from("orders").select("user_id").eq("id", orderId).single();
      if (fetchError) {
        console.error("[useAdminOrders] loading order failed", { orderId, error: fetchError });
        throw new Error("Couldn't find this order. Refresh and try again.");
      }

      const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
      if (error) {
        console.error("[useAdminOrders] status update failed", { orderId, status, error });
        throw new Error(error.message);
      }

      const notified = await notifyStatusChange(orderId, order?.user_id ?? null, status);
      return { notified };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  return {
    orders: ordersQuery.data?.rows ?? [],
    total: ordersQuery.data?.total ?? 0,
    isLoading: ordersQuery.isLoading,
    isFetching: ordersQuery.isFetching,
    isPlaceholderData: ordersQuery.isPlaceholderData,
    error: ordersQuery.error,
    refetch: ordersQuery.refetch,
    updateOrderStatus,
  };
}
