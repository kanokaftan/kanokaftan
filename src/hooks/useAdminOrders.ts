import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminOrder {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  total: number;
  subtotal: number;
  shipping_fee: number;
  shipping_address: unknown;
  created_at: string;
  customer: { full_name: string | null; email: string } | null;
  order_items: {
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    vendor: { store_name: string | null } | null;
  }[];
}

export function useAdminOrders() {
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async (): Promise<AdminOrder[]> => {
      // First get orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(
            id,
            product_name,
            quantity,
            unit_price,
            total_price,
            vendor_id
          )
        `)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;
      
      // Get unique user IDs and vendor IDs
      const userIds = [...new Set((ordersData || []).map(o => o.user_id))];
      const vendorIds = [...new Set((ordersData || []).flatMap(o => 
        (o.order_items || []).map((item: any) => item.vendor_id)
      ))];
      
      // Fetch profiles for customers and vendors
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email, store_name")
        .in("id", [...userIds, ...vendorIds]);
      
      const profileMap = new Map((profiles || []).map(p => [p.id, p]));
      
      // Map orders with customer and vendor info
      return (ordersData || []).map((order: any) => {
        const customer = profileMap.get(order.user_id);
        return {
          ...order,
          customer: customer ? { full_name: customer.full_name, email: customer.email } : null,
          order_items: (order.order_items || []).map((item: any) => {
            const vendor = profileMap.get(item.vendor_id);
            return {
              ...item,
              vendor: vendor ? { store_name: vendor.store_name } : null,
            };
          }),
        };
      });
    },
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      // Get the order to find user_id and vendors
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("user_id")
        .eq("id", orderId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if (error) throw error;

      // Notify customer about admin status update
      if (order?.user_id) {
        await supabase.from("notifications").insert({
          user_id: order.user_id,
          title: "Order Status Updated",
          message: `Your order status has been updated to: ${status.replace(/_/g, ' ')}`,
          type: "order",
          category: "order",
          action_url: `/orders/${orderId}`,
          metadata: { order_id: orderId, status }
        });
      }

      // Get vendor IDs from order items and notify them
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("vendor_id")
        .eq("order_id", orderId);

      if (orderItems) {
        const uniqueVendorIds = [...new Set(orderItems.map(item => item.vendor_id))];
        const vendorNotifications = uniqueVendorIds.map(vendorId => ({
          user_id: vendorId,
          title: "Order Status Updated by Admin",
          message: `Order #${orderId.slice(0, 8)} status changed to: ${status.replace(/_/g, ' ')}`,
          type: "order" as const,
          category: "order" as const,
          action_url: "/vendor/orders",
          metadata: { order_id: orderId, status }
        }));
        await supabase.from("notifications").insert(vendorNotifications);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    error: ordersQuery.error,
    updateOrderStatus,
  };
}
