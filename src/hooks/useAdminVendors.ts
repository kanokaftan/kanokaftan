import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export type BadgeTier = "none" | "blue" | "gold";

/** The badge a seller shows right now. */
export function badgeTierOf(vendor: { is_verified: boolean; verification_tier?: string | null }): BadgeTier {
  if (!vendor.is_verified) return "none";
  return vendor.verification_tier === "gold" ? "gold" : "blue";
}
import { supabase } from "@/integrations/supabase/client";
import { withProfilePrivate } from "@/lib/profilePrivate";

export interface AdminVendor {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  verification_tier?: string | null;
  store_name: string | null;
  store_description: string | null;
  created_at: string;
  product_count: number;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  payout_preference: string | null;
  store_address: {
    street?: string;
    city?: string;
    state?: string;
  } | null;
  total_sales: number;
  pending_payout: number;
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

      // Get vendor profiles with bank details
      const { data: profileRows, error: profilesError } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, is_verified, verification_tier, store_name, store_description, created_at")
        .in("id", vendorIds)
        .order("created_at", { ascending: false });

      if (profilesError) throw profilesError;
      // Contact, address and bank details come from get_profile_private (admins only).
      const profiles = await withProfilePrivate(profileRows ?? []);

      // Get product counts per vendor
      const { data: productCounts, error: productsError } = await supabase
        .from("products")
        .select("vendor_id")
        .is("deleted_at", null);

      if (productsError) throw productsError;

      const countByVendor = productCounts?.reduce((acc, p) => {
        acc[p.vendor_id] = (acc[p.vendor_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get sales data per vendor from order_items
      const { data: orderItems, error: orderError } = await supabase
        .from("order_items")
        .select(`
          vendor_id,
          total_price,
          order:orders!inner(payment_status, escrow_status)
        `);

      if (orderError) throw orderError;

      const salesByVendor: Record<string, { total: number; pending: number }> = {};
      orderItems?.forEach(item => {
        const vendorId = item.vendor_id;
        if (!salesByVendor[vendorId]) {
          salesByVendor[vendorId] = { total: 0, pending: 0 };
        }
        const order = item.order as { payment_status: string; escrow_status: string } | null;
        if (order?.payment_status === "paid") {
          salesByVendor[vendorId].total += Number(item.total_price);
          if (order?.escrow_status === "held") {
            salesByVendor[vendorId].pending += Number(item.total_price);
          }
        }
      });

      return profiles?.map(p => ({
        ...p,
        store_address: p.store_address as AdminVendor["store_address"],
        product_count: countByVendor[p.id] || 0,
        total_sales: salesByVendor[p.id]?.total || 0,
        pending_payout: salesByVendor[p.id]?.pending || 0,
      })) || [];
    },
  });

  // Admin sets the badge directly; the database function also notifies the seller.
  const setTier = useMutation({
    mutationFn: async ({ vendorId, tier }: { vendorId: string; tier: BadgeTier }) => {
      const { error } = await supabase.rpc("admin_set_verification_tier", { p_vendor_id: vendorId, p_tier: tier });
      if (error) {
        console.error("[useAdminVendors] admin_set_verification_tier failed", { vendorId, tier, error });
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
      queryClient.invalidateQueries({ queryKey: ["shops"] });
    },
  });

  return {
    vendors: vendorsQuery.data || [],
    isLoading: vendorsQuery.isLoading,
    error: vendorsQuery.error,
    setTier,
  };
}
