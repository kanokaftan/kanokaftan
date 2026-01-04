import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendorOrder {
  id: string;
  created_at: string;
  status: string;
  total: number;
  customer: {
    id: string;
    full_name: string | null;
    email: string | null;
  }[] | null;
  order_items: {
    id: string;
    quantity: number;
    unit_price: number;
    product: {
      id: string;
      name: string;
      slug: string;
    } | null;
  }[];
}

export function useVendorOrders(vendorId: string | null) {
  return useQuery({
    queryKey: ["vendor-orders", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];

      // Get all products by this vendor
      const { data: vendorProducts, error: productsError } = await supabase
        .from("products")
        .select("id")
        .eq("vendor_id", vendorId);

      if (productsError) throw productsError;
      if (!vendorProducts?.length) return [];

      const productIds = vendorProducts.map((p) => p.id);

      // Get order items for vendor's products
      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          id,
          quantity,
          unit_price,
          order_id,
          product:products(id, name, slug)
        `)
        .in("product_id", productIds);

      if (itemsError) throw itemsError;
      if (!orderItems?.length) return [];

      // Get unique order IDs
      const orderIds = [...new Set(orderItems.map((item) => item.order_id))];

      // Get orders with customer info
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select(`
          id,
          created_at,
          status,
          total,
          customer:profiles!orders_user_id_fkey(id, full_name, email)
        `)
        .in("id", orderIds)
        .order("created_at", { ascending: false });

      if (ordersError) throw ordersError;

      // Combine orders with their items (only vendor's products)
      return orders.map((order) => ({
        ...order,
        order_items: orderItems.filter((item) => item.order_id === order.id),
      })) as VendorOrder[];
    },
    enabled: !!vendorId,
  });
}
