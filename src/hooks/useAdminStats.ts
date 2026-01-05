import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface AdminStats {
  // Users & Vendors
  totalUsers: number;
  totalVendors: number;
  verifiedVendors: number;
  totalProducts: number;
  
  // Orders (by payment status)
  totalPaidOrders: number;
  pendingPayments: number;
  
  // Orders (by fulfillment status)
  pendingFulfillment: number;
  inTransit: number;
  completedOrders: number;
  
  // Financial
  totalRevenue: number;
  pendingRevenue: number;
  escrowHeld: number;
  escrowReleased: number;
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

      // Get paid orders count (actual confirmed orders)
      const { count: totalPaidOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", "paid");

      // Get pending payments count
      const { count: pendingPayments } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", "pending");

      // Get pending fulfillment (paid but not shipped)
      const { count: pendingFulfillment } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", "paid")
        .in("status", ["payment_confirmed", "processing"]);

      // Get in transit count
      const { count: inTransit } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("payment_status", "paid")
        .eq("status", "shipped");

      // Get completed orders count
      const { count: completedOrders } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .eq("status", "completed");

      // Get total revenue (paid orders)
      const { data: revenueData } = await supabase
        .from("orders")
        .select("total")
        .eq("payment_status", "paid");

      const totalRevenue = revenueData?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

      // Get pending revenue (unpaid orders)
      const { data: pendingRevenueData } = await supabase
        .from("orders")
        .select("total")
        .eq("payment_status", "pending");

      const pendingRevenue = pendingRevenueData?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

      // Get escrow held (paid but not released)
      const { data: escrowHeldData } = await supabase
        .from("orders")
        .select("total")
        .eq("payment_status", "paid")
        .eq("escrow_status", "held");

      const escrowHeld = escrowHeldData?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

      // Get escrow released
      const { data: escrowReleasedData } = await supabase
        .from("orders")
        .select("total")
        .eq("payment_status", "paid")
        .eq("escrow_status", "released");

      const escrowReleased = escrowReleasedData?.reduce((sum, order) => sum + Number(order.total), 0) || 0;

      return {
        totalUsers: totalUsers || 0,
        totalVendors: totalVendors || 0,
        verifiedVendors: verifiedVendors || 0,
        totalProducts: totalProducts || 0,
        totalPaidOrders: totalPaidOrders || 0,
        pendingPayments: pendingPayments || 0,
        pendingFulfillment: pendingFulfillment || 0,
        inTransit: inTransit || 0,
        completedOrders: completedOrders || 0,
        totalRevenue,
        pendingRevenue,
        escrowHeld,
        escrowReleased,
      };
    },
  });
}
