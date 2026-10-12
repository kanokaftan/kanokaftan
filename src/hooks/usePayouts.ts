import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { NIGERIAN_BANKS, type Bank } from "@/lib/nigerianBanks";

export type PayoutStatus = "held" | "on_hold" | "pending" | "processing" | "paid" | "failed" | "cancelled";

export interface Payout {
  id: string;
  order_id: string;
  vendor_id: string;
  tranche: 1 | 2;
  gross_amount: number;
  commission_percent: number;
  commission_amount: number;
  amount: number;
  status: PayoutStatus;
  failure_reason: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface PayoutAccount {
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_name: string;
}

export const payoutStatusLabels: Record<PayoutStatus, string> = {
  held: "Waiting for delivery",
  on_hold: "On hold (dispute)",
  pending: "Ready to send",
  processing: "Sending",
  paid: "Paid",
  failed: "Failed",
  cancelled: "Cancelled",
};

/** Thrown when Paystack isn't connected on the server yet (shown as a friendly notice). */
export class PayoutsNotConfiguredError extends Error {}

async function invokePayoutAccount<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("vendor-payout-account", { body });
  if (error) {
    // The server explains what went wrong in the response body; show that, not "non-2xx status code".
    let details: { error?: string; code?: string } | null = null;
    try {
      const response = (error as { context?: Response }).context;
      if (response && typeof response.json === "function") details = await response.json();
    } catch {
      // Body wasn't JSON; fall back to the generic message.
    }
    console.error("[payouts] vendor-payout-account failed", { action: body.action, details, error });
    if (details?.code === "payments_not_configured" || details?.code === "payouts_not_configured") throw new PayoutsNotConfiguredError(details.error);
    throw new Error(details?.error || "Something went wrong. Please try again.");
  }
  if (!data?.success) throw new Error(data?.error || "Request failed");
  return data as T;
}

/**
 * Banks for the picker. Starts with the built-in Nigerian list (so it is never
 * empty) and switches to Paystack's live list once it loads.
 */
export function useBanks(enabled: boolean) {
  const query = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      const data = await invokePayoutAccount<{ banks: Bank[] }>({ action: "list_banks" });
      return [...data.banks].sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
    retry: (count, error) => !(error instanceof PayoutsNotConfiguredError) && count < 2,
  });
  return {
    banks: query.data?.length ? query.data : NIGERIAN_BANKS,
    isLive: !!query.data?.length,
    notConfigured: query.error instanceof PayoutsNotConfiguredError,
    notConfiguredMessage: query.error instanceof PayoutsNotConfiguredError ? query.error.message : null,
  };
}

/** The account holder's name for a bank + 10-digit number (checked with the bank). */
export function useResolveAccount(bankCode: string, accountNumber: string, enabled: boolean) {
  return useQuery({
    queryKey: ["resolve-account", bankCode, accountNumber],
    queryFn: async () => {
      const data = await invokePayoutAccount<{ account_name: string }>({ action: "resolve", bank_code: bankCode, account_number: accountNumber });
      return data.account_name;
    },
    enabled: enabled && !!bankCode && /^\d{10}$/.test(accountNumber),
    staleTime: 60 * 60 * 1000,
    retry: false,
  });
}

export function useVendorPayoutAccount(vendorId: string | null) {
  const queryClient = useQueryClient();

  const accountQuery = useQuery({
    queryKey: ["payout-account", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_payout_accounts")
        .select("bank_code, bank_name, account_number, account_name")
        .eq("vendor_id", vendorId!)
        .maybeSingle();
      if (error) throw error;
      return data as PayoutAccount | null;
    },
    enabled: !!vendorId,
  });

  const saveAccount = useMutation({
    mutationFn: (input: { bank_code: string; account_number: string }) =>
      invokePayoutAccount<{ account_name: string; bank_name: string }>({ action: "save", ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payout-account", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["vendor-payouts", vendorId] });
    },
  });

  return { account: accountQuery.data ?? null, isLoading: accountQuery.isLoading, saveAccount };
}

export function useVendorPayouts(vendorId: string | null) {
  return useQuery({
    queryKey: ["vendor-payouts", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .eq("vendor_id", vendorId!)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as Payout[];
    },
    enabled: !!vendorId,
  });
}

export interface AdminPayout extends Payout {
  store_name: string | null;
}

export interface DisputedOrder {
  id: string;
  total: number;
  dispute_reason: string | null;
  disputed_at: string | null;
  customer_email: string | null;
}

export function useAdminPayouts() {
  const queryClient = useQueryClient();
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-payout-ledger"] });
    queryClient.invalidateQueries({ queryKey: ["admin-disputes"] });
  };

  const payoutsQuery = useQuery({
    queryKey: ["admin-payout-ledger"],
    queryFn: async (): Promise<AdminPayout[]> => {
      const { data, error } = await supabase
        .from("payouts")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;

      const vendorIds = [...new Set((data || []).map((p) => p.vendor_id))];
      const { data: vendors, error: vendorsError } = vendorIds.length
        ? await supabase.from("profiles").select("id, store_name").in("id", vendorIds)
        : { data: [], error: null };
      if (vendorsError) throw vendorsError;
      const names = new Map((vendors || []).map((v) => [v.id, v.store_name]));

      return (data || []).map((p) => ({ ...(p as Payout), store_name: names.get(p.vendor_id) ?? null }));
    },
  });

  const disputesQuery = useQuery({
    queryKey: ["admin-disputes"],
    queryFn: async (): Promise<DisputedOrder[]> => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total, user_id, dispute_reason, disputed_at")
        .eq("dispute_status", "open")
        .order("disputed_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data || []).map((o) => o.user_id))];
      const { data: customers, error: customersError } = userIds.length
        ? await supabase.from("profiles").select("id, email").in("id", userIds)
        : { data: [], error: null };
      if (customersError) throw customersError;
      const emails = new Map((customers || []).map((c) => [c.id, c.email]));

      return (data || []).map((o) => ({
        id: o.id,
        total: Number(o.total),
        dispute_reason: o.dispute_reason,
        disputed_at: o.disputed_at,
        customer_email: emails.get(o.user_id) ?? null,
      }));
    },
  });

  const runPayouts = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-payouts", { body: {} });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Payout run failed");
      return data as { released: number; sent: number; failed: number; waitingForBankAccount: number };
    },
    onSuccess: invalidate,
  });

  const retryPayout = useMutation({
    mutationFn: async (payoutId: string) => {
      const { error } = await supabase.rpc("admin_retry_payout", { p_payout_id: payoutId });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      invalidate();
      runPayouts.mutate();
    },
  });

  const resolveDispute = useMutation({
    mutationFn: async ({ orderId, outcome }: { orderId: string; outcome: "release" | "refund" }) => {
      const { error } = await supabase.rpc("admin_resolve_dispute", { p_order_id: orderId, p_outcome: outcome });
      if (error) throw new Error(error.message);
      return outcome;
    },
    onSuccess: (outcome) => {
      invalidate();
      if (outcome === "release") runPayouts.mutate();
    },
  });

  return {
    payouts: payoutsQuery.data || [],
    disputes: disputesQuery.data || [],
    isLoading: payoutsQuery.isLoading || disputesQuery.isLoading,
    runPayouts,
    retryPayout,
    resolveDispute,
  };
}

export function usePlatformSettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ["platform-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("commission_percent, checkout_commission_percent, auto_release_days")
        .eq("id", 1)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (values: { commission_percent: number; checkout_commission_percent: number; auto_release_days: number }) => {
      const { error } = await supabase.from("platform_settings").update(values).eq("id", 1);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["platform-settings"] }),
  });

  return { settings: settingsQuery.data, isLoading: settingsQuery.isLoading, updateSettings };
}
