import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type Functions = Database["public"]["Functions"];
export type AmbassadorSummary = Functions["admin_ambassador_overview"]["Returns"][number];
export type AmbassadorReferral = Functions["admin_ambassador_referrals"]["Returns"][number];
export type ReferralStatus = "signed_up" | "approved" | "earned" | "paid" | "rejected";

export interface AmbassadorInput {
  id?: string | null;
  full_name: string;
  phone?: string;
  email?: string;
  bank_name?: string;
  account_number?: string;
  account_name?: string;
  notes?: string;
  is_active?: boolean;
  code?: string;
}

const OVERVIEW_KEY = ["ambassadors", "overview"];
const referralsKey = (ambassadorId: string) => ["ambassadors", "referrals", ambassadorId];

/** Postgres error text ("Only admins can …") is already written for people; anything else gets the fallback. */
function readableError(error: unknown, fallback: string): Error {
  const message = (error as { message?: string })?.message;
  return new Error(message && !/^(JWT|PGRST|permission denied)/i.test(message) ? message : fallback);
}

/** Who invited you, for the seller sign-up page. */
export function useAmbassadorInvite(code: string | null) {
  return useQuery({
    queryKey: ["ambassador-invite", code],
    enabled: !!code,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_ambassador_invite", { p_code: code! });
      if (error) {
        console.warn("[ambassadors] invite lookup failed", { code, error });
        return null;
      }
      return data?.[0] ?? null;
    },
  });
}

export function useAmbassadorOverview() {
  return useQuery({
    queryKey: OVERVIEW_KEY,
    queryFn: async (): Promise<AmbassadorSummary[]> => {
      const { data, error } = await supabase.rpc("admin_ambassador_overview");
      if (error) throw readableError(error, "Couldn't load ambassadors.");
      return (data ?? []).map((a) => ({ ...a, owed: Number(a.owed), paid: Number(a.paid) }));
    },
  });
}

export function useAmbassadorReferrals(ambassadorId: string | null) {
  return useQuery({
    queryKey: referralsKey(ambassadorId ?? ""),
    enabled: !!ambassadorId,
    queryFn: async (): Promise<AmbassadorReferral[]> => {
      const { data, error } = await supabase.rpc("admin_ambassador_referrals", { p_ambassador_id: ambassadorId! });
      if (error) throw readableError(error, "Couldn't load this ambassador's sellers.");
      return (data ?? []).map((r) => ({ ...r, reward_amount: r.reward_amount == null ? null : Number(r.reward_amount) }));
    },
  });
}

export function useSaveAmbassador() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: AmbassadorInput) => {
      const { data, error } = await supabase.rpc("admin_save_ambassador", {
        p_id: input.id ?? null,
        p_full_name: input.full_name,
        p_phone: input.phone || null,
        p_email: input.email || null,
        p_bank_name: input.bank_name || null,
        p_account_number: input.account_number || null,
        p_account_name: input.account_name || null,
        p_notes: input.notes || null,
        p_is_active: input.is_active ?? true,
        p_code: input.code || null,
      });
      if (error) throw readableError(error, "Couldn't save the ambassador.");
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY }),
  });
}

export function useMarkReferralPaid(ambassadorId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ sellerId, note }: { sellerId: string; note?: string }) => {
      const { error } = await supabase.rpc("admin_mark_referral_paid", { p_seller_id: sellerId, p_note: note || null });
      if (error) throw readableError(error, "Couldn't record the payment.");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OVERVIEW_KEY });
      queryClient.invalidateQueries({ queryKey: referralsKey(ambassadorId) });
    },
  });
}
