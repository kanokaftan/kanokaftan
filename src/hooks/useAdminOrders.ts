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
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          customer:profiles!orders_user_id_fkey(full_name, email),
          order_items(
            id,
            product_name,
            quantity,
            unit_price,
            total_price,
            vendor:profiles!order_items_vendor_id_fkey(store_name)
          )
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Transform customer array to single object (Supabase returns array for joins)
      return (data || []).map((order: any) => ({
        ...order,
        customer: Array.isArray(order.customer) ? order.customer[0] || null : order.customer,
        order_items: (order.order_items || []).map((item: any) => ({
          ...item,
          vendor: Array.isArray(item.vendor) ? item.vendor[0] || null : item.vendor,
        })),
      }));
    },
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      const { error } = await supabase
        .from("orders")
        .update({ status })
        .eq("id", orderId);
      if (error) throw error;
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
