import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/hooks/useCart";

export interface ShippingAddress {
  full_name: string;
  phone: string;
  street_address: string;
  city: string;
  state: string;
  landmark?: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  variant_name?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface TrackingUpdate {
  status: string;
  message: string;
  timestamp: string;
}

export interface Order {
  id: string;
  customer_id: string;
  chat_id: string | null;
  status: string;
  payment_status: string;
  payment_reference?: string | null;
  subtotal: number;
  shipping_fee: number;
  total: number;
  shipping_address: ShippingAddress;
  notes: string | null;
  tracking_updates: TrackingUpdate[];
  confirmed_at?: string | null;
  created_at: string;
  updated_at: string;
  order_items: OrderItem[];
}

export function useOrders() {
  const { user } = useAuth();
  const { items, clearCart } = useCart();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["orders", user?.id],
    enabled: !!user,
    queryFn: async (): Promise<Order[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items(*)
        `)
        .eq("customer_id", user!.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as Order[];
    },
  });

  const createOrder = useMutation({
    mutationFn: async ({
      shipping_address,
      notes,
      shipping_fee,
    }: {
      shipping_address: ShippingAddress;
      notes?: string;
      shipping_fee: number;
    }): Promise<Order> => {
      if (!user) throw new Error("Not authenticated");
      if (!items.length) throw new Error("Cart is empty");

      const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
      const total = subtotal + shipping_fee;

      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert({
          customer_id: user.id,
          status: "pending_payment",
          payment_status: "pending",
          subtotal,
          shipping_fee,
          total,
          shipping_address,
          notes: notes || null,
          tracking_updates: [],
        } as any)
        .select()
        .single();

      if (orderError) throw orderError;

      const orderItems = items.map((item) => ({
        order_id: order.id,
        product_id: item.product_id,
        product_name: item.name,
        variant_name: item.size || item.color || null,
        quantity: item.quantity,
        unit_price: item.price,
        total_price: item.price * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems as any);

      if (itemsError) throw itemsError;

      // Reduce stock for each product
      for (const item of items) {
        const { data: product } = await supabase
          .from("products")
          .select("stock_quantity")
          .eq("id", item.product_id)
          .single();
        if (product) {
          const newStock = Math.max(0, (product.stock_quantity || 0) - item.quantity);
          await supabase
            .from("products")
            .update({ stock_quantity: newStock })
            .eq("id", item.product_id);
        }
      }

      clearCart();
      return order as unknown as Order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
    },
  });

  const confirmDelivery = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("orders")
        .update({
          status: "completed",
          confirmed_at: new Date().toISOString(),
        } as any)
        .eq("id", orderId)
        .eq("customer_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders", user?.id] });
    },
  });

  return {
    orders: query.data || [],
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
    createOrder,
    confirmDelivery,
  };
}
