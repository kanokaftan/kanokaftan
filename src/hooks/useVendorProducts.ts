import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendorProduct {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  stock_quantity: number;
  is_active: boolean;
  featured: boolean;
  created_at: string;
  updated_at: string;
  category: {
    id: string;
    name: string;
    slug: string;
  } | null;
  product_images: {
    id: string;
    url: string;
    is_primary: boolean;
    alt_text: string | null;
  }[];
}

export function useVendorProducts(vendorId: string | null) {
  return useQuery({
    queryKey: ["vendor-products", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];

      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          stock_quantity,
          is_active,
          featured,
          created_at,
          updated_at,
          category:categories(id, name, slug),
          product_images(id, url, is_primary, alt_text)
        `)
        .eq("vendor_id", vendorId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as VendorProduct[];
    },
    enabled: !!vendorId,
  });
}

export function useVendorProduct(productId: string | null) {
  return useQuery({
    queryKey: ["vendor-product", productId],
    queryFn: async () => {
      if (!productId) return null;

      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          description,
          price,
          compare_at_price,
          stock_quantity,
          is_active,
          featured,
          category_id,
          category:categories(id, name, slug),
          product_images(id, url, is_primary, alt_text, display_order)
        `)
        .eq("id", productId)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });
}
