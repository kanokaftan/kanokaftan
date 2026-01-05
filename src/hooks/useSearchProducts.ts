import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "./useDebounce";

export interface SearchResult {
  id: string;
  name: string;
  slug: string;
  price: number;
  imageUrl?: string;
  category?: string;
}

export function useSearchProducts(query: string, enabled: boolean = true) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: ["search-products", debouncedQuery],
    queryFn: async (): Promise<SearchResult[]> => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];

      const { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          slug,
          price,
          product_images(url, is_primary),
          category:categories(name)
        `)
        .eq("is_active", true)
        .or(`name.ilike.%${debouncedQuery}%,description.ilike.%${debouncedQuery}%`)
        .limit(8);

      if (error) throw error;

      return (data || []).map((product: any) => ({
        id: product.id,
        name: product.name,
        slug: product.slug,
        price: product.price,
        imageUrl: product.product_images?.find((img: any) => img.is_primary)?.url 
          || product.product_images?.[0]?.url,
        category: product.category?.name,
      }));
    },
    enabled: enabled && debouncedQuery.length >= 2,
    staleTime: 1000 * 60, // 1 minute
  });
}
