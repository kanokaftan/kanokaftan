import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  variant_name: string | null;
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

export interface Order {
  id: string;
  user_id: string;
  status: string;
  payment_status: string;
  payment_reference: string | null;
  subtotal: number;
  shipping_fee: number;
  total: number;
  shipping_address: ShippingAddress;
  notes: string | null;
  escrow_status: string;
  delivery_type: string | null;
  estimated_delivery_date: string | null;
  tracking_updates: Array<{
    status: string;
    message: string;
    timestamp: string;
  }>;
  confirmed_at: string | null;
  auto_release_at: string | null;
  created_at: string;
  updated_at: string;
  order_items?: OrderItem[];
}

export interface CreateOrderData {
  shipping_address: Order["shipping_address"];
  notes?: string;
  shipping_fee: number;
}

export function useOrders() {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
    });

    return () => subscription.unsubscribe();
  }, []);

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

      // Get cart items
      const { data: cartItems, error: cartError } = await supabase
        .from("cart_items")
        .select(`
          *,
          product:products (
            id,
            name,
            price,
            vendor_id,
            stock_quantity
          ),
          variant:product_variants (
            id,
            name,
            price_adjustment
          )
        `)
        .eq("user_id", userId);

      if (cartError) throw cartError;
      if (!cartItems || cartItems.length === 0) throw new Error("Cart is empty");

      // Calculate totals
      const subtotal = cartItems.reduce((sum, item) => {
        const price = item.product.price + (item.variant?.price_adjustment || 0);
        return sum + price * item.quantity;
      }, 0);

      const total = subtotal + orderData.shipping_fee;

      // Create order
      const { data: order, error: orderError } = await supabase
        .from("orders")
        .insert([{
          user_id: userId,
          status: "pending_payment",
          payment_status: "pending",
          subtotal,
          shipping_fee: orderData.shipping_fee,
          total,
          shipping_address: orderData.shipping_address as any,
          notes: orderData.notes,
        }])
        .select()
        .single();

      if (orderError) throw orderError;

      // Create order items
      const orderItems = cartItems.map((item) => ({
        order_id: order.id,
        product_id: item.product.id,
        product_name: item.product.name,
        variant_id: item.variant_id,
        variant_name: item.variant?.name,
        vendor_id: item.product.vendor_id,
        quantity: item.quantity,
        unit_price: item.product.price + (item.variant?.price_adjustment || 0),
        total_price: (item.product.price + (item.variant?.price_adjustment || 0)) * item.quantity,
      }));

      const { error: itemsError } = await supabase
        .from("order_items")
        .insert(orderItems);

      if (itemsError) throw itemsError;

      // Clear cart
      await supabase.from("cart_items").delete().eq("user_id", userId);

      return order;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const confirmDelivery = useMutation({
    mutationFn: async (orderId: string) => {
      if (!userId) throw new Error("Must be logged in");

      const { error } = await supabase
        .from("orders")
        .update({
          status: "completed",
          confirmed_at: new Date().toISOString(),
          escrow_status: "released",
        })
        .eq("id", orderId)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });

  return {
    orders: ordersQuery.data || [],
    isLoading: ordersQuery.isLoading,
    createOrder,
    confirmDelivery,
  };
}
