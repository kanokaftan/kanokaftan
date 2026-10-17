import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfilePrivate, withProfilePrivate } from "@/lib/profilePrivate";

export interface VendorOrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_name: string;
  variant_name: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export interface VendorOrder {
  id: string;
  created_at: string;
  status: string;
  payment_status: string;
  escrow_status: string | null;
  total: number;
  shipping_address: {
    full_name: string;
    phone: string;
    street_address: string;
    city: string;
    state: string;
    landmark?: string;
  };
  notes: string | null;
  tracking_updates: Array<{
    status: string;
    message: string;
    timestamp: string;
  }>;
  customer: {
    id: string;
    full_name: string | null;
    email: string;
    phone: string | null;
  } | null;
  order_items: VendorOrderItem[];
  /** Set for orders still being prepared: who else sells in this order and who is ready. */
  fulfilment: OrderFulfilment | null;
}

export interface FulfilmentSeller {
  vendor_id: string;
  store_name: string;
  ready: boolean;
  ready_at: string | null;
  me: boolean;
}

export interface OrderFulfilment {
  /** Items from several sellers: Kano Kaftan collects and delivers them as one shipment. */
  combined: boolean;
  sellers: FulfilmentSeller[];
}

/** Statuses in which sellers are still packing (readiness matters). */
export const PREPARING_STATUSES = ["payment_confirmed", "processing", "ready_for_pickup"];

export type OrderStatus = 
  | "pending_payment"
  | "payment_confirmed" 
  | "processing"
  | "ready_for_pickup"
  | "shipped"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled";

export function useVendorOrders(vendorId: string | null) {
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["vendor-orders", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];

      // Get order items for this vendor directly
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          id,
          order_id,
          quantity,
          unit_price,
          total_price,
          product_name,
          variant_name,
          product:products(id, name, slug)
        `)
        .eq("vendor_id", vendorId);

      if (itemsError) throw itemsError;
      if (!orderItems?.length) return [];

      // Get unique order IDs
      const orderIds = [...new Set(orderItems.map((item) => item.order_id))];

      // Get orders with full details - ONLY paid orders
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .in("id", orderIds)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Get customer profiles
      const userIds = [...new Set(orders.map((o) => o.user_id))];
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);
      if (profilesError) console.error("[vendor orders] customer names failed", profilesError);
      // Email and phone come from get_profile_private (sellers see their own buyers only).
      const profiles = await withProfilePrivate(profileRows ?? []);

      // Readiness of every seller, for orders still being packed.
      const fulfilments = new Map<string, OrderFulfilment>();
      await Promise.all(
        orders
          .filter((o) => PREPARING_STATUSES.includes(o.status))
          .map(async (o) => {
            const { data, error } = await supabase.rpc("order_fulfilment", { p_order_id: o.id });
            if (error) {
              console.error("[vendor orders] fulfilment failed", o.id, error);
              return;
            }
            fulfilments.set(o.id, data as unknown as OrderFulfilment);
          }),
      );

      // Combine orders with their items and customer info
      return orders.map((order) => ({
        fulfilment: fulfilments.get(order.id) ?? null,
        id: order.id,
        created_at: order.created_at,
        status: order.status,
        payment_status: order.payment_status,
        escrow_status: order.escrow_status,
        total: order.total,
        shipping_address: order.shipping_address as VendorOrder["shipping_address"],
        notes: order.notes,
        tracking_updates: (order.tracking_updates || []) as VendorOrder["tracking_updates"],
        customer: profiles?.find((p) => p.id === order.user_id) || null,
        order_items: orderItems
          .filter((item) => item.order_id === order.id)
          .map((item) => ({
            id: item.id,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            product_name: item.product_name,
            variant_name: item.variant_name,
            product: item.product,
          })),
      })) as VendorOrder[];
    },
    enabled: !!vendorId,
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ 
      orderId, 
      status, 
      message 
    }: { 
      orderId: string; 
      status: OrderStatus; 
      message: string;
    }) => {
      // Get current order to append tracking update
      const { data: currentOrder, error: fetchError } = await supabase
        .from("orders")
        .select("tracking_updates, user_id")
        .eq("id", orderId)
        .single();

      if (fetchError) throw fetchError;

      const existingUpdates = (currentOrder.tracking_updates || []) as VendorOrder["tracking_updates"];
      const newUpdate = {
        status,
        message,
        timestamp: new Date().toISOString(),
      };

      const updateData: Record<string, unknown> = {
        status,
        tracking_updates: [...existingUpdates, newUpdate],
        updated_at: new Date().toISOString(),
      };

      // The database starts the payout auto-release clock when the order first ships.

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);

      if (error) throw error;

      // Send notification to customer about status update
      if (currentOrder.user_id) {
        const statusMessages: Record<string, { title: string; message: string }> = {
          processing: { title: "Order Processing", message: "Your order is now being prepared." },
          ready_for_pickup: { title: "Ready for Pickup", message: "Your order is ready and waiting for courier pickup." },
          shipped: { title: "Order Shipped!", message: "Your order is on its way! Track it in your orders page." },
          out_for_delivery: { title: "Out for Delivery", message: "Your order is out for delivery. It should arrive soon!" },
          delivered: { title: "Order Delivered", message: "Your order has been delivered. Enjoy your purchase!" },
          completed: { title: "Order Completed", message: "Thank you for shopping with us! We hope you love your items." },
          cancelled: { title: "Order Cancelled", message: "Your order has been cancelled. Contact support if you have questions." },
        };

        const notificationInfo = statusMessages[status];
        if (notificationInfo) {
          await supabase.from("notifications").insert({
            user_id: currentOrder.user_id,
            title: notificationInfo.title,
            message: notificationInfo.message,
            type: status === "cancelled" ? "warning" : status === "delivered" || status === "completed" ? "success" : "order",
            category: "order",
            action_url: `/orders/${orderId}`,
            metadata: { order_id: orderId, status }
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-orders"] });
    },
  });

  // Combined orders: each seller only says "my items are packed".
  const setReady = useMutation({
    mutationFn: async ({ orderId, ready }: { orderId: string; ready: boolean }) => {
      const { data, error } = await supabase.rpc("vendor_set_ready", { p_order_id: orderId, p_ready: ready });
      if (error) throw error;
      return data as unknown as OrderFulfilment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-orders"] });
    },
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    updateOrderStatus,
    setReady,
  };
}
