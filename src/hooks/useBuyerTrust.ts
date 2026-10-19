import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/** A buyer's verified bank account (masked). */
export interface BuyerBankAccount {
  bank_name: string;
  last4: string;
  account_name: string;
  verified_at: string;
  /** False for accounts linked before the full number was kept: they confirm it once. */
  number_saved?: boolean;
}

export interface FirstBuyerStatus {
  /** Never paid for an order (or signed out): first-buyer prices are shown. */
  first_buyer: boolean;
  signed_in: boolean;
  /** First-buyer prices are applied at checkout only once the bank account is verified. */
  bank_verified: boolean;
}

export interface Bank {
  name: string;
  code: string;
}

const BANK_KEY = ["buyer-bank"];
const FIRST_BUYER_KEY = ["first-buyer-status"];

async function invokeBuyerBank<T>(body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke("buyer-bank-account", { body });
  if (error) {
    // The server explains what went wrong in the response body; show that, not "non-2xx status code".
    let details: { error?: string } | null = null;
    try {
      const response = (error as { context?: Response }).context;
      if (response && typeof response.json === "function") details = await response.json();
    } catch {
      // Body wasn't JSON; use the generic message.
    }
    console.error("[buyer-bank-account] failed", { action: body.action, details, error });
    throw new Error(details?.error || "Something went wrong. Please try again.");
  }
  if (!data?.success) throw new Error(data?.error || "Something went wrong. Please try again.");
  return data as T;
}

export function useBuyerBank() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...BANK_KEY, user?.id],
    enabled: !!user,
    queryFn: async (): Promise<BuyerBankAccount | null> => {
      const { data, error } = await supabase.rpc("my_buyer_bank_account" as never);
      if (error) {
        console.error("[buyer bank] load failed", error);
        throw new Error("Couldn't check your bank account.");
      }
      return (data ?? null) as BuyerBankAccount | null;
    },
  });
}

export function useBanks(enabled: boolean) {
  return useQuery({
    queryKey: ["buyer-banks"],
    enabled,
    staleTime: 60 * 60 * 1000,
    queryFn: async () => (await invokeBuyerBank<{ banks: Bank[] }>({ action: "list_banks" })).banks,
  });
}

export function useVerifyBuyerBank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { bank_code: string; account_number: string }) =>
      invokeBuyerBank<{ account_name: string; bank_name: string; last4: string }>({ action: "verify", ...input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: BANK_KEY });
      queryClient.invalidateQueries({ queryKey: FIRST_BUYER_KEY });
      queryClient.invalidateQueries({ queryKey: ["referral"] });
    },
  });
}

/** Whether to show first-buyer prices. Signed-out visitors count as first buyers. */
export function useFirstBuyerStatus() {
  const { user, isLoading } = useAuth();
  return useQuery({
    queryKey: [...FIRST_BUYER_KEY, user?.id ?? "guest"],
    enabled: !isLoading,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<FirstBuyerStatus> => {
      const { data, error } = await supabase.rpc("first_buyer_status" as never);
      if (error) {
        console.error("[first buyer] status failed", error);
        // When unsure, don't promise a discount.
        return { first_buyer: false, signed_in: !!user, bank_verified: false };
      }
      return data as unknown as FirstBuyerStatus;
    },
  });
}

/** The first-buyer price of an item, rounded to whole naira like the server. */
export function firstBuyerPrice(price: number, percent: number | null | undefined): number {
  const p = Number(percent) || 0;
  return p > 0 ? Math.round(price * (1 - p / 100)) : price;
}

/** Fallback when settings can't be read; matches the server default. */
const DEFAULT_FIRST_BUYER_MIN_PERCENT = 5;

/** The smallest first-buyer discount a seller may set on a product. */
export function useFirstBuyerMinPercent() {
  return useQuery({
    queryKey: ["platform-settings", "first-buyer-min"],
    staleTime: 10 * 60_000,
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("first_buyer_min_percent")
        .eq("id", 1)
        .maybeSingle();
      if (error) {
        console.error("[first buyer] min percent failed", error);
        return DEFAULT_FIRST_BUYER_MIN_PERCENT;
      }
      const value = data?.first_buyer_min_percent;
      return value == null ? DEFAULT_FIRST_BUYER_MIN_PERCENT : Number(value);
    },
  });
}
