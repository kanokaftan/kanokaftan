import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

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
}

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

      // Get orders with full details
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("*")
        .in("id", orderIds)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Get customer profiles
      const userIds = [...new Set(orders.map((o) => o.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", userIds);

      // Combine orders with their items and customer info
      return orders.map((order) => ({
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
        .select("tracking_updates")
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

      // Set auto_release_at when marking as delivered (7 days from now)
      if (status === "delivered") {
        const autoReleaseDate = new Date();
        autoReleaseDate.setDate(autoReleaseDate.getDate() + 7);
        updateData.auto_release_at = autoReleaseDate.toISOString();
      }

      const { error } = await supabase
        .from("orders")
        .update(updateData)
        .eq("id", orderId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-orders"] });
    },
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    updateOrderStatus,
  };
}
