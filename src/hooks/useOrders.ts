import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  variant_name: string | null;
  /** Chosen size / colour, copied from cart_items by place_order */
  size?: string | null;
  color?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  vendor_id: string;
}

export interface ShippingAddress {
  full_name: string;
  phone: string;
  street_address: string;
  city: string;
  state: string;
  landmark?: string;
}

export interface TrackingUpdate {
  status: string;
  message: string;
  timestamp: string;
}

export interface Order {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  payment_reference: string | null;
  subtotal: number;
  shipping_fee: number;
  total: number;
  /** Kano Kaftan credit taken off this order. */
  credit_used?: number;
  /** First-buyer savings, already taken off the subtotal. */
  first_buyer_discount?: number;
  shipping_address: ShippingAddress;
  notes: string | null;
  escrow_status: string;
  delivery_type: string | null;
  estimated_delivery_date: string | null;
  tracking_updates: TrackingUpdate[];
  confirmed_at: string | null;
  auto_release_at: string | null;
  shipped_at: string | null;
  dispute_status: "open" | "resolved_vendor" | "resolved_customer" | null;
  dispute_reason: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface CreateOrderData {
  address_id: string;
  promo_code?: string;
  notes?: string;
  /** Spend Kano Kaftan credit on this order (the server decides how much). */
  use_credit?: boolean;
}

export function useOrders() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const queryClient = useQueryClient();

  const ordersQuery = useQuery({
    queryKey: ["orders", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("orders")
        .select(`
          *,
          order_items (*)
        `)
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      // Cast the data since we know the shape from our insert
      return (data || []).map((order: any) => ({
        ...order,
        shipping_address: order.shipping_address as ShippingAddress,
        tracking_updates: order.tracking_updates || [],
      })) as Order[];
    },
    enabled: !!userId,
  });

  const createOrder = useMutation({
    mutationFn: async (orderData: CreateOrderData) => {
      if (!userId) throw new Error("Must be logged in");

      // Prices, shipping and stock are checked on the server.
      const { data: order, error } = await supabase.rpc("place_order", {
        p_address_id: orderData.address_id,
        p_promo_code: orderData.promo_code ?? null,
        p_notes: orderData.notes ?? null,
        p_use_credit: orderData.use_credit ?? true,
      });

      if (error) throw new Error(error.message);
      return order as unknown as Order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      queryClient.invalidateQueries({ queryKey: ["credit"] });
      queryClient.invalidateQueries({ queryKey: ["referral"] });
    },
  });

  const confirmDelivery = useMutation({
    mutationFn: async (orderId: string) => {
      if (!userId) throw new Error("Must be logged in");

      const { data, error } = await supabase.functions.invoke("confirm-delivery", {
        body: { orderId },
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Could not confirm delivery");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  const openDispute = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const { error } = await supabase.rpc("open_order_dispute", {
        p_order_id: orderId,
        p_reason: reason,
      });

      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    error: ordersQuery.error,
    refetch: ordersQuery.refetch,
    createOrder,
    confirmDelivery,
    openDispute,
  };
}
