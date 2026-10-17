import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

// Admin read-only views of a seller or customer: summary numbers, their chats
// (customer <-> seller), products, orders and payouts.

export type AdminConversation = Database["public"]["Functions"]["admin_list_conversations"]["Returns"][number];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];

export interface VendorOverview {
  products: number;
  active_products: number;
  out_of_stock: number;
  orders: number;
  paid_orders: number;
  items_sold: number;
  gross_sales: number;
  last_order_at: string | null;
  paid_out: number;
  payout_pending: number;
  commission_earned: number;
  chats: number;
  chat_customers: number;
  followers: number;
  reviews: number;
  rating: number | null;
  visitors_30d: number;
  views_30d: number;
  payout_account: { bank_name: string; account_name: string; account_number_last4: string } | null;
  application: {
    status: string; city: string | null; state: string | null; phone: string | null;
    description: string | null; created_at: string; reviewed_at: string | null;
  } | null;
}

export interface CustomerOverview {
  orders: number;
  paid_orders: number;
  total_spent: number;
  last_order_at: string | null;
  open_disputes: number;
  chats: number;
  wishlist: number;
  following: number;
  reviews: number;
  recent_orders: { id: string; total: number; status: string; payment_status: string; created_at: string }[];
}

export interface PersonProfile {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
  store_name: string | null;
  store_slug: string | null;
  store_description: string | null;
  store_address: { street?: string; city?: string; state?: string } | null;
  is_verified: boolean;
  verification_tier: string | null;
}

function fail(context: string, error: { message?: string } | null): never {
  console.error(`[admin] ${context} failed`, error);
  throw new Error(error?.message || `Could not load ${context}`);
}

export function usePersonProfile(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin-person", userId],
    queryFn: async (): Promise<PersonProfile | null> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, full_name, phone, avatar_url, created_at, store_name, store_slug, store_description, store_address, is_verified, verification_tier")
        .eq("id", userId!)
        .maybeSingle();
      if (error) fail("profile", error);
      return data as PersonProfile | null;
    },
    enabled: !!userId,
  });
}

export function useVendorOverview(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["admin-vendor-overview", vendorId],
    queryFn: async (): Promise<VendorOverview> => {
      const { data, error } = await supabase.rpc("admin_vendor_overview", { p_vendor_id: vendorId! });
      if (error) fail("seller summary", error);
      return data as unknown as VendorOverview;
    },
    enabled: !!vendorId,
  });
}

export function useCustomerOverview(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin-customer-overview", userId],
    queryFn: async (): Promise<CustomerOverview> => {
      const { data, error } = await supabase.rpc("admin_customer_overview", { p_user_id: userId! });
      if (error) fail("customer summary", error);
      return data as unknown as CustomerOverview;
    },
    enabled: !!userId,
  });
}

export function useAdminConversations(filter: { vendorId?: string; customerId?: string }, enabled = true) {
  return useQuery({
    queryKey: ["admin-conversations", filter.vendorId ?? null, filter.customerId ?? null],
    queryFn: async (): Promise<AdminConversation[]> => {
      const { data, error } = await supabase.rpc("admin_list_conversations", {
        p_vendor_id: filter.vendorId,
        p_customer_id: filter.customerId,
      });
      if (error) fail("chats", error);
      return data ?? [];
    },
    enabled: enabled && !!(filter.vendorId || filter.customerId),
  });
}

export interface TranscriptMessage extends MessageRow {
  reactions: string[];
}

/** One chat, read only. Doesn't mark anything as read for the customer or seller. */
export function useAdminTranscript(conversationId: string | undefined) {
  return useQuery({
    queryKey: ["admin-transcript", conversationId],
    queryFn: async () => {
      const [{ data: conversation, error: convError }, { data: messages, error: msgError }, { data: reactions, error: reactError }] =
        await Promise.all([
          supabase.from("conversations").select("id, kind, customer_id, vendor_id, product_id, created_at").eq("id", conversationId!).maybeSingle(),
          supabase.from("messages").select("*").eq("conversation_id", conversationId!).order("created_at", { ascending: true }).limit(1000),
          supabase.from("message_reactions").select("message_id, emoji").eq("conversation_id", conversationId!).not("emoji", "is", null),
        ]);
      if (convError) fail("chat", convError);
      if (msgError) fail("messages", msgError);
      if (reactError) fail("reactions", reactError);
      if (!conversation) return null;

      const ids = [conversation.customer_id, conversation.vendor_id].filter(Boolean) as string[];
      const { data: people, error: peopleError } = await supabase
        .from("profiles")
        .select("id, full_name, email, store_name, avatar_url, store_slug")
        .in("id", ids);
      if (peopleError) fail("chat members", peopleError);

      const byMessage = new Map<string, string[]>();
      for (const r of reactions ?? []) {
        if (!r.emoji) continue;
        byMessage.set(r.message_id, [...(byMessage.get(r.message_id) ?? []), r.emoji]);
      }
      return {
        conversation,
        customer: people?.find((p) => p.id === conversation.customer_id) ?? null,
        vendor: people?.find((p) => p.id === conversation.vendor_id) ?? null,
        messages: (messages ?? []).map((m) => ({ ...m, reactions: byMessage.get(m.id) ?? [] })) as TranscriptMessage[],
      };
    },
    enabled: !!conversationId,
    refetchInterval: 30_000,
  });
}

export interface VendorOrderRow {
  order_id: string;
  created_at: string;
  status: string;
  payment_status: string;
  items: number;
  total: number;
  customer_name: string;
}

export function useVendorOrders(vendorId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["admin-vendor-orders", vendorId],
    queryFn: async (): Promise<VendorOrderRow[]> => {
      const { data, error } = await supabase
        .from("order_items")
        .select("order_id, quantity, total_price, orders!inner(created_at, status, payment_status, user_id)")
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) fail("seller orders", error);

      const grouped = new Map<string, VendorOrderRow & { user_id: string }>();
      for (const row of data ?? []) {
        const order = row.orders as unknown as { created_at: string; status: string; payment_status: string; user_id: string };
        const existing = grouped.get(row.order_id);
        if (existing) {
          existing.items += row.quantity;
          existing.total += Number(row.total_price);
        } else {
          grouped.set(row.order_id, {
            order_id: row.order_id, created_at: order.created_at, status: order.status, payment_status: order.payment_status,
            items: row.quantity, total: Number(row.total_price), customer_name: "", user_id: order.user_id,
          });
        }
      }
      const rows = [...grouped.values()];
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      if (userIds.length) {
        const { data: customers, error: customersError } = await supabase.from("profiles").select("id, full_name, email").in("id", userIds);
        if (customersError) fail("customers", customersError);
        const names = new Map((customers ?? []).map((c) => [c.id, c.full_name || c.email]));
        rows.forEach((r) => (r.customer_name = names.get(r.user_id) ?? "Customer"));
      }
      return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
    },
    enabled: enabled && !!vendorId,
  });
}

export function useVendorProductsAdmin(vendorId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["admin-vendor-products", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, name, slug, price, stock_quantity, is_active, created_at, product_images(url, is_primary)")
        .is("deleted_at", null)
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false });
      if (error) fail("seller products", error);
      return data ?? [];
    },
    enabled: enabled && !!vendorId,
  });
}

export function useVendorPayoutsAdmin(vendorId: string | undefined, enabled = true) {
  return useQuery({
    queryKey: ["admin-vendor-payouts", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("id, order_id, tranche, amount, commission_amount, status, failure_reason, paid_at, created_at")
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) fail("seller payouts", error);
      return data ?? [];
    },
    enabled: enabled && !!vendorId,
  });
}
