import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  category_id: string | null;
  vendor_id: string;
  is_active: boolean;
  featured: boolean;
  stock_quantity: number;
  created_at: string;
  category?: {
    id: string;
    name: string;
    slug: string;
  } | null;
  product_images?: {
    id: string;
    url: string;
    is_primary: boolean;
    alt_text?: string | null;
  }[];
  vendor?: {
    id: string;
    full_name: string | null;
  } | null;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
}

interface UseProductsOptions {
  categorySlug?: string;
  search?: string;
  page?: number;
  limit?: number;
  featured?: boolean;
}

export function useProducts({ categorySlug, search, page = 1, limit = 12, featured }: UseProductsOptions = {}) {
  return useQuery({
    queryKey: ["products", { categorySlug, search, page, limit, featured }],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select(`
          *,
          category:categories(id, name, slug),
          product_images(id, url, is_primary),
          vendor:profiles!products_vendor_id_fkey(id, full_name)
        `, { count: "exact" })
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (featured) {
        query = query.eq("featured", true);
      }

      if (categorySlug) {
        const { data: category } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", categorySlug)
          .maybeSingle();
        
        if (category) {
          query = query.eq("category_id", category.id);
        }
      }

      if (search) {
        query = query.ilike("name", `%${search}%`);
      }

      const from = (page - 1) * limit;
      const to = from + limit - 1;
      query = query.range(from, to);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        products: data as Product[],
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      };
    },
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) throw error;
      return data as Category[];
    },
  });
}
