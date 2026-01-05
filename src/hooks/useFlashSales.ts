import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface FlashSale {
  id: string;
  product_id: string;
  sale_price: number;
  original_price: number;
  starts_at: string;
  ends_at: string;
  max_quantity: number | null;
  sold_quantity: number;
  is_active: boolean;
  product: {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    stock_quantity: number;
    product_images: { url: string; is_primary: boolean }[];
    vendor: {
      store_name: string | null;
      is_verified: boolean;
    } | null;
  } | null;
}

export function useFlashSales() {
  return useQuery({
    queryKey: ["flash-sales"],
    queryFn: async () => {
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from("flash_sales")
        .select(`
          *,
          product:products(
            id,
            name,
            slug,
            description,
            stock_quantity,
            product_images(url, is_primary),
            vendor:profiles!products_vendor_id_fkey(store_name, is_verified)
          )
        `)
        .eq("is_active", true)
        .lte("starts_at", now)
        .gt("ends_at", now)
        .order("ends_at", { ascending: true });

      if (error) throw error;
      return (data || []) as FlashSale[];
    },
    refetchInterval: 60000, // Refetch every minute
  });
}

export function useFlashSaleForProduct(productId: string | undefined) {
  return useQuery({
    queryKey: ["flash-sale", productId],
    queryFn: async () => {
      if (!productId) return null;
      
      const now = new Date().toISOString();
      
      const { data, error } = await supabase
        .from("flash_sales")
        .select("*")
        .eq("product_id", productId)
        .eq("is_active", true)
        .lte("starts_at", now)
        .gt("ends_at", now)
        .maybeSingle();

      if (error) throw error;
      
      if (!data) return null;
      
      return {
        ...data,
        product: null
      } as FlashSale;
    },
    enabled: !!productId,
  });
}
