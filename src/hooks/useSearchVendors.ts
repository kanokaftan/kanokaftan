import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDebounce } from "./useDebounce";

export interface VendorSearchResult {
  id: string;
  store_name: string;
  avatar_url: string | null;
  is_verified: boolean;
}

export function useSearchVendors(query: string, enabled: boolean = true) {
  const debouncedQuery = useDebounce(query, 300);

  return useQuery({
    queryKey: ["search-vendors", debouncedQuery],
    queryFn: async (): Promise<VendorSearchResult[]> => {
      if (!debouncedQuery || debouncedQuery.length < 2) return [];

      const { data, error } = await supabase
        .from("public_vendor_profiles")
        .select("id, store_name, avatar_url, is_verified")
        .not("store_name", "is", null)
        .ilike("store_name", `%${debouncedQuery}%`)
        .limit(5);

      if (error) throw error;

      return (data || []).map((vendor) => ({
        id: vendor.id!,
        store_name: vendor.store_name!,
        avatar_url: vendor.avatar_url,
        is_verified: vendor.is_verified ?? false,
      }));
    },
    enabled: enabled && debouncedQuery.length >= 2,
    staleTime: 1000 * 60,
  });
}
