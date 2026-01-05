import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminVendor {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  store_name: string | null;
  store_description: string | null;
  created_at: string;
  product_count: number;
}

export function useAdminVendors() {
  const queryClient = useQueryClient();

  const vendorsQuery = useQuery({
    queryKey: ["admin-vendors"],
    queryFn: async (): Promise<AdminVendor[]> => {
      // Get all vendor user IDs
      const { data: vendorRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "vendor");

      if (rolesError) throw rolesError;

      const vendorIds = vendorRoles?.map(r => r.user_id) || [];
      if (vendorIds.length === 0) return [];

      // Get vendor profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("*")
        .in("id", vendorIds)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;

      // Get product counts per vendor
      const { data: productCounts, error: productsError } = await supabase
        .from("products")
        .select("vendor_id");

      if (productsError) throw productsError;

      const countByVendor = productCounts?.reduce((acc, p) => {
        acc[p.vendor_id] = (acc[p.vendor_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      return profiles?.map(p => ({
        ...p,
        product_count: countByVendor[p.id] || 0,
      })) || [];
    },
  });

  const verifyVendor = useMutation({
    mutationFn: async ({ vendorId, isVerified }: { vendorId: string; isVerified: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({ is_verified: isVerified })
        .eq("id", vendorId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  return {
    vendors: vendorsQuery.data || [],
    isLoading: vendorsQuery.isLoading,
    error: vendorsQuery.error,
    verifyVendor,
  };
}
