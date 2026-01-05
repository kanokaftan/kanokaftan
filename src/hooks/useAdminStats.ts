import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdminStats {
  totalUsers: number;
  totalVendors: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  pendingOrders: number;
  verifiedVendors: number;
}

export function useAdminStats() {
  return useQuery({
    queryKey: ["admin-stats"],
    queryFn: async (): Promise<AdminStats> => {
      // Get total users count
      const { count: totalUsers } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true });

      // Get vendors count
      const { count: totalVendors } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true })
        .eq("role", "vendor");

      // Get verified vendors count
      const { count: verifiedVendors } = await supabase
        .from("profiles")
        .select("*", { count: "exact", head: true })
        .eq("is_verified", true);

      // Get total products count
      const { count: totalProducts } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true });

      // Get total orders count
      const { count: totalOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true });

      // Get pending orders count
      const { count: pendingOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Get total revenue
      const { data: revenueData } = await supabase
        .from("orders")
        .select("total")
        .eq("payment_status", "paid");

      const totalRevenue = revenueData?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

      return {
        totalUsers: totalUsers || 0,
        totalVendors: totalVendors || 0,
        totalProducts: totalProducts || 0,
        totalOrders: totalOrders || 0,
        totalRevenue,
        pendingOrders: pendingOrders || 0,
        verifiedVendors: verifiedVendors || 0,
      };
    },
  });
}
