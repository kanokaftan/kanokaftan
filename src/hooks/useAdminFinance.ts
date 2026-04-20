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
      const { data: orders } = await supabase
        .from("orders")
        .select(`
          id,
          total,
          payment_status,
          status,
          created_at,
          customer:profiles!orders_user_id_fkey(full_name, email)
        `)
        .eq("payment_status", "paid")
        .order("created_at", { ascending: false })
        .limit(100);

      return (orders || []).map((order: any) => {
        const customer = Array.isArray(order.customer) ? order.customer[0] : order.customer;
        return {
          id: order.id,
          orderId: order.id,
          amount: Number(order.total),
          status: order.status,
          createdAt: order.created_at,
          customerName: customer?.full_name || customer?.email || "Customer",
        };
      });
    },
  });

  const totalGMV = transactionsQuery.data?.reduce((sum, t) => sum + t.amount, 0) || 0;

  return {
    transactions: transactionsQuery.data || [],
    isLoading: transactionsQuery.isLoading,
    totalGMV,
  };
}
