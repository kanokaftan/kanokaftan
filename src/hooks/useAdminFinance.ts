import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withProfilePrivate } from "@/lib/profilePrivate";
import { usePlatformSettings } from "@/hooks/usePayouts";

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

const DEFAULT_PLATFORM_FEE_PERCENTAGE = 10;
const BATCH_SIZE = 100;

type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string;
  store_name: string | null;
  avatar_url: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
};

/** Fetch profiles in batches so request URLs stay short. */
async function fetchProfiles(ids: string[]): Promise<Map<string, ProfileLite>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const result: ProfileLite[] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, store_name, avatar_url")
      .in("id", unique.slice(i, i + BATCH_SIZE));
    if (error) throw error;
    result.push(...((await withProfilePrivate(data || [])) as ProfileLite[]));
  }
  return new Map(result.map((p) => [p.id, p]));
}

export function useAdminFinance() {
  const { settings } = usePlatformSettings();
  const feePercent = Number(settings?.commission_percent ?? DEFAULT_PLATFORM_FEE_PERCENTAGE);

  const payoutsQuery = useQuery({
    queryKey: ["admin-payouts", feePercent],
    queryFn: async (): Promise<VendorPayout[]> => {
      const { data: vendorRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "vendor");
      if (rolesError) throw rolesError;

      const vendorIds = vendorRoles?.map((r) => r.user_id) || [];
      if (vendorIds.length === 0) return [];

      const profileMap = await fetchProfiles(vendorIds);

      const { data: orderItems, error: itemsError } = await supabase
        .from("order_items")
        .select(`
          vendor_id,
          total_price,
          order:orders!inner(status, payment_status)
        `)
        .in("vendor_id", vendorIds);
      if (itemsError) throw itemsError;

      const vendorPayouts: VendorPayout[] = vendorIds.map((vendorId) => {
        const profile = profileMap.get(vendorId);
        const vendorItems = orderItems?.filter((item) => item.vendor_id === vendorId) || [];
        const paidItems = vendorItems.filter((item: any) => item.order?.payment_status === "paid");
        const completedItems = paidItems.filter((item: any) => item.order?.status === "completed");
        const pendingItems = paidItems.filter((item: any) => item.order?.status !== "completed");

        const totalSales = paidItems.reduce((sum, item) => sum + Number(item.total_price), 0);
        const platformFee = totalSales * (feePercent / 100);

        return {
          vendorId,
          vendorName: profile?.full_name || profile?.email || "Unknown",
          storeName: profile?.store_name ?? null,
          avatar: profile?.avatar_url ?? null,
          totalSales,
          platformFee,
          netPayout: totalSales - platformFee,
          pendingOrders: pendingItems.length,
          completedOrders: completedItems.length,
          bankName: profile?.bank_name ?? null,
          accountNumber: profile?.account_number ?? null,
          accountName: profile?.account_name ?? null,
          lastPayoutDate: null, // see the Payouts ledger tab for real payout records
        };
      });

      return vendorPayouts.sort((a, b) => b.totalSales - a.totalSales);
    },
    staleTime: 30_000,
  });

  const transactionsQuery = useQuery({
    queryKey: ["admin-transactions", feePercent],
    queryFn: async (): Promise<Transaction[]> => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select(`
          id,
          user_id,
          total,
          payment_status,
          status,
          created_at,
          order_items(vendor_id, total_price)
        `)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      if (!orders?.length) return [];

      // orders.user_id references auth.users, so profiles are fetched separately.
      const profileMap = await fetchProfiles(
        orders.flatMap((o) => [o.user_id, ...(o.order_items || []).map((i) => i.vendor_id)])
      );

      const transactions: Transaction[] = [];
      orders.forEach((order) => {
        const customer = profileMap.get(order.user_id);
        (order.order_items || []).forEach((item, idx) => {
          const vendor = profileMap.get(item.vendor_id);
          const amount = Number(item.total_price);
          const platformFee = amount * (feePercent / 100);
          transactions.push({
            id: `${order.id}-${item.vendor_id}-${idx}`,
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
    staleTime: 30_000,
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
    feePercent,
  };
}
