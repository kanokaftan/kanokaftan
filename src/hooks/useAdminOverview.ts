import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAdminAuth } from "@/hooks/useAdminAuth";

/** Every count the admin home and menu need, from one database call (admin_overview_counts). */
export interface AdminOverview {
  // Needs attention
  seller_applications: number;
  verification_reviews: number;
  ambassador_applications: number;
  orders_to_prepare: number;
  combined_ready: number;
  open_disputes: number;
  failed_payouts: number;
  refunds_needed: number;
  open_reports: number;
  app_errors: number;
  // Totals
  customers: number;
  sellers: number;
  verified_sellers: number;
  products: number;
  live_products: number;
  paid_orders: number;
  unpaid_orders: number;
  in_transit: number;
  completed_orders: number;
  revenue: number;
  unpaid_value: number;
  escrow_held: number;
  escrow_released: number;
}

const OVERVIEW_REFRESH_MS = 60_000;

const OVERVIEW_KEYS: (keyof AdminOverview)[] = [
  "seller_applications", "verification_reviews", "ambassador_applications", "orders_to_prepare", "combined_ready",
  "open_disputes", "failed_payouts", "refunds_needed", "open_reports", "app_errors",
  "customers", "sellers", "verified_sellers", "products", "live_products", "paid_orders", "unpaid_orders",
  "in_transit", "completed_orders", "revenue", "unpaid_value", "escrow_held", "escrow_released",
];

export function useAdminOverview() {
  const { isAdmin } = useAdminAuth();
  return useQuery({
    queryKey: ["admin-overview"],
    enabled: isAdmin,
    refetchInterval: OVERVIEW_REFRESH_MS,
    staleTime: OVERVIEW_REFRESH_MS / 2,
    queryFn: async (): Promise<AdminOverview> => {
      const { data, error } = await supabase.rpc("admin_overview_counts");
      if (error) {
        console.error("[admin overview] counts failed", error);
        throw new Error("Couldn't load the dashboard counts.");
      }
      const raw = (data ?? {}) as Record<string, unknown>;
      // Postgres numerics arrive as numbers or strings; anything missing counts as 0.
      return Object.fromEntries(OVERVIEW_KEYS.map((k) => [k, Number(raw[k]) || 0])) as unknown as AdminOverview;
    },
  });
}

export interface CombinedShipmentSeller {
  vendor_id: string;
  store_name: string;
  phone: string | null;
  address: { street?: string; city?: string; state?: string };
  items: number;
  ready: boolean;
}

export interface CombinedShipment {
  order_id: string;
  created_at: string;
  status: string;
  total: number;
  shipping_address: {
    full_name?: string;
    phone?: string;
    street_address?: string;
    city?: string;
    state?: string;
    landmark?: string;
  } | null;
  customer_name: string;
  customer_phone: string | null;
  dispatched: boolean;
  delivery_company: string | null;
  pickup_code: string | null;
  sellers: CombinedShipmentSeller[];
}

/** Paid multi-seller orders not yet on their way: one shipment each, collected from every seller. */
export function useCombinedShipments() {
  const { isAdmin } = useAdminAuth();
  return useQuery({
    queryKey: ["admin-combined-shipments"],
    enabled: isAdmin,
    refetchInterval: OVERVIEW_REFRESH_MS,
    queryFn: async (): Promise<CombinedShipment[]> => {
      const { data, error } = await supabase.rpc("admin_combined_shipments");
      if (error) {
        console.error("[admin shipments] load failed", error);
        throw new Error("Couldn't load combined shipments.");
      }
      return (data ?? []) as unknown as CombinedShipment[];
    },
  });
}

export interface RecentOrder {
  id: string;
  status: string;
  total: number;
  created_at: string;
  seller_count: number;
  shipping_address: { full_name?: string } | null;
  customer: { full_name: string | null; email: string | null } | null;
}

const RECENT_ORDERS = 5;

/** The newest orders, for the admin home. */
export function useRecentAdminOrders() {
  const { isAdmin } = useAdminAuth();
  return useQuery({
    queryKey: ["admin-recent-orders"],
    enabled: isAdmin,
    queryFn: async (): Promise<RecentOrder[]> => {
      const { data, error } = await supabase.rpc("admin_list_orders", { p_filter: "all", p_limit: RECENT_ORDERS, p_offset: 0 });
      if (error) {
        console.error("[admin home] recent orders failed", error);
        throw new Error("Couldn't load recent orders.");
      }
      return ((data as { rows?: RecentOrder[] } | null)?.rows ?? []) as RecentOrder[];
    },
  });
}
