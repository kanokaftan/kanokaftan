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
            total_price
          )
        `)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      const customerIds = [...new Set((ordersData || []).map((o: any) => o.customer_id || o.user_id).filter(Boolean))];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", customerIds);

      const profileMap = new Map((profiles || []).map(p => [p.id, p]));

      return (ordersData || []).map((order: any) => {
        const customerId = order.customer_id || order.user_id;
        const customer = profileMap.get(customerId);
        return {
          ...order,
          customer: customer ? { full_name: customer.full_name, email: customer.email } : null,
          order_items: (order.order_items || []).map((item: any) => ({
            ...item,
            vendor: null,
          })),
        };
      });
    },
    staleTime: 30_000,
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { data: order, error: fetchError } = await supabase
        .from("orders")
        .select("customer_id, user_id")
        .eq("id", orderId)
        .single();

      if (fetchError) throw fetchError;

      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if (error) throw error;

      const notifyUserId = (order as any)?.customer_id || (order as any)?.user_id;
      if (notifyUserId) {
        await supabase.from("notifications").insert({
          user_id: notifyUserId,
          title: "Order Status Updated",
          message: `Your order status has been updated to: ${status.replace(/_/g, ' ')}`,
          type: "order",
          category: "order",
          action_url: `/orders/${orderId}`,
          metadata: { order_id: orderId, status }
        } as any);
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
