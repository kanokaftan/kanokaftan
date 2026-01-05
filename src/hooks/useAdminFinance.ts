import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface VendorPayout {
  vendorId: string;
  vendorName: string;
  storeName: string | null;
  avatar: string | null;
  totalSales: number;
  platformFee: number;
  netPayout: number;
  pendingOrders: number;
  completedOrders: number;
  bankName: string | null;
  accountNumber: string | null;
  accountName: string | null;
  lastPayoutDate: string | null;
}

export interface Transaction {
  id: string;
  orderId: string;
  vendorId: string;
  vendorName: string;
  amount: number;
  platformFee: number;
  netAmount: number;
  status: string;
  createdAt: string;
  customerName: string;
}

const PLATFORM_FEE_PERCENTAGE = 10; // 10% platform fee

export function useAdminFinance() {
  const queryClient = useQueryClient();

  const payoutsQuery = useQuery({
    queryKey: ["admin-payouts"],
    queryFn: async (): Promise<VendorPayout[]> => {
      // Get all vendors
      const { data: vendorRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "vendor");

      const vendorIds = vendorRoles?.map(r => r.user_id) || [];
      if (vendorIds.length === 0) return [];

      // Get vendor profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, store_name, avatar_url, bank_name, account_number, account_name")
        .in("id", vendorIds);

      // Get order items for each vendor
      const { data: orderItems } = await supabase
        .from("order_items")
        .select(`
          vendor_id,
          total_price,
          order:orders!inner(status, payment_status)
        `)
        .in("vendor_id", vendorIds);

      const vendorPayouts: VendorPayout[] = (profiles || []).map(profile => {
        const vendorItems = orderItems?.filter(item => item.vendor_id === profile.id) || [];
        const paidItems = vendorItems.filter((item: any) => item.order?.payment_status === "paid");
        const completedItems = paidItems.filter((item: any) => item.order?.status === "completed");
        const pendingItems = paidItems.filter((item: any) => item.order?.status !== "completed");

        const totalSales = paidItems.reduce((sum, item) => sum + Number(item.total_price), 0);
        const platformFee = totalSales * (PLATFORM_FEE_PERCENTAGE / 100);
        const netPayout = totalSales - platformFee;

        return {
          vendorId: profile.id,
          vendorName: profile.full_name || "Unknown",
          storeName: profile.store_name,
          avatar: profile.avatar_url,
          totalSales,
          platformFee,
          netPayout,
          pendingOrders: pendingItems.length,
          completedOrders: completedItems.length,
          bankName: profile.bank_name,
          accountNumber: profile.account_number,
          accountName: profile.account_name,
          lastPayoutDate: null, // Would need a payouts table
        };
      });

      return vendorPayouts.sort((a, b) => b.totalSales - a.totalSales);
    },
  });

  const transactionsQuery = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async (): Promise<Transaction[]> => {
      const { data: orders } = await supabase
        .from("orders")
        .select(`
          id,
          total,
          payment_status,
          status,
          created_at,
          customer:profiles!orders_user_id_fkey(full_name, email),
          order_items(
            vendor_id,
            total_price,
            vendor:profiles!order_items_vendor_id_fkey(full_name, store_name)
          )
        `)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(100);

      const transactions: Transaction[] = [];

      orders?.forEach((order: any) => {
        const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
        
        order.order_items?.forEach((item: any) => {
          const vendor = Array.isArray(item.vendor) ? item.vendor[0] : item.vendor;
          const amount = Number(item.total_price);
          const platformFee = amount * (PLATFORM_FEE_PERCENTAGE / 100);
          
          transactions.push({
            id: `${order.id}-${item.vendor_id}`,
            orderId: order.id,
            vendorId: item.vendor_id,
            vendorName: vendor?.store_name || vendor?.full_name || "Unknown",
            amount,
            platformFee,
            netAmount: amount - platformFee,
            status: order.status,
            createdAt: order.created_at,
            customerName: customer?.full_name || customer?.email || "Customer",
          });
        });
      });

      return transactions;
    },
  });

  const totalPlatformRevenue = transactionsQuery.data?.reduce((sum, t) => sum + t.platformFee, 0) || 0;
  const totalGMV = transactionsQuery.data?.reduce((sum, t) => sum + t.amount, 0) || 0;
  const pendingPayouts = payoutsQuery.data?.reduce((sum, p) => sum + p.netPayout, 0) || 0;

  return {
    payouts: payoutsQuery.data || [],
    transactions: transactionsQuery.data || [],
    isLoading: payoutsQuery.isLoading || transactionsQuery.isLoading,
    totalPlatformRevenue,
    totalGMV,
    pendingPayouts,
  };
}
