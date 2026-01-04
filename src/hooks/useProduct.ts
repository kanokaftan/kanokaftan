import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Product } from "./useProducts";

export function useProduct(slug: string) {
  return useQuery({
    queryKey: ["product", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          category:categories(id, name, slug),
          product_images(id, url, is_primary, alt_text, display_order),
          product_variants(id, name, size, color, price_adjustment, stock_quantity),
          vendor:profiles!products_vendor_id_fkey(id, full_name, avatar_url, is_verified, store_name)
        `)
        .eq("slug", slug)
        .eq("is_active", true)
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("Product not found");

      return data as Product & {
        product_variants: {
          id: string;
          name: string;
          size: string | null;
          color: string | null;
          price_adjustment: number | null;
          stock_quantity: number;
        }[];
      };
    },
    enabled: !!slug,
  });
}
