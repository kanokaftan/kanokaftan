import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Transaction {
  id: string;
  orderId: string;
  amount: number;
  status: string;
  createdAt: string;
  customerName: string;
}

export function useAdminFinance() {
  const transactionsQuery = useQuery({
    queryKey: ["admin-transactions"],
    queryFn: async (): Promise<Transaction[]> => {
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, total, payment_status, status, created_at, customer_id")
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) throw error;
      if (!orders?.length) return [];

      const customerIds = [...new Set(orders.map((o) => o.customer_id).filter(Boolean))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", customerIds);

      const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

      return orders.map((order) => {
        const profile = profileMap.get(order.customer_id);
        return {
          id: order.id,
          orderId: order.id,
          amount: Number(order.total),
          status: order.status,
          createdAt: order.created_at,
          customerName: profile?.full_name || profile?.email || "Customer",
        };
      });
    },
    staleTime: 30_000,
  });

  const totalGMV = transactionsQuery.data?.reduce((sum, t) => sum + t.amount, 0) || 0;

  return {
    transactions: transactionsQuery.data || [],
    isLoading: transactionsQuery.isLoading,
    totalGMV,
  };
}
