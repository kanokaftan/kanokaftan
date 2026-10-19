import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ReferralFriend {
  name: string;
  status: "joined" | "rewarded" | "cancelled";
  joined_at: string;
  rewarded_at: string | null;
}

export interface CreditLine {
  amount: number;
  kind: "referral_welcome" | "referral_reward" | "order_spend" | "order_refund" | "admin_adjust";
  order_id: string | null;
  created_at: string;
}

export interface MyReferral {
  enabled: boolean;
  code: string | null;
  friend_credit: number;
  referrer_credit: number;
  min_order: number;
  balance: number;
  joined: number;
  rewarded: number;
  earned: number;
  friends: ReferralFriend[];
  history: CreditLine[];
}

export interface ReferralInvite {
  valid: boolean;
  inviter?: string;
  friend_credit?: number;
  min_order?: number;
}

export interface MyCredit {
  balance: number;
  min_order: number;
}

export interface ReferralOverview {
  joined: number;
  rewarded: number;
  credit_given: number;
  credit_spent: number;
  credit_outstanding: number;
  top_referrers: { user_id: string; name: string; joined: number; rewarded: number }[];
}

const REFERRAL_KEY = ["referral"];
const CREDIT_KEY = ["credit"];

/** Database messages here are written for people; anything technical gets the fallback. */
function readable(error: { message?: string } | null, fallback: string): Error {
  const message = error?.message;
  return new Error(message && !/^(JWT|PGRST|permission denied)/i.test(message) ? message : fallback);
}

async function call<T>(fn: string, args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) {
    console.error(`[referral] ${fn} failed`, error);
    throw readable(error, fallback);
  }
  return data as T;
}

export function useMyReferral(enabled: boolean) {
  return useQuery({
    queryKey: REFERRAL_KEY,
    enabled,
    queryFn: () => call<MyReferral>("my_referral", {}, "Couldn't load your invites."),
  });
}

export function useMyCredit(enabled: boolean) {
  return useQuery({
    queryKey: CREDIT_KEY,
    enabled,
    queryFn: () => call<MyCredit>("my_credit", {}, "Couldn't load your credit."),
  });
}

export function useReferralInvite(code: string | null) {
  return useQuery({
    queryKey: ["referral-invite", code],
    enabled: !!code,
    staleTime: 10 * 60 * 1000,
    queryFn: () => call<ReferralInvite>("referral_invite", { p_code: code }, "Couldn't check this invite."),
  });
}

export function useClaimReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      call<{ claimed: boolean; reason?: string; credit?: number; min_order?: number }>(
        "claim_customer_referral", { p_code: code }, "Couldn't use this invite.",
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REFERRAL_KEY });
      queryClient.invalidateQueries({ queryKey: CREDIT_KEY });
    },
  });
}

export function useReferralOverview() {
  return useQuery({
    queryKey: ["admin-referral-overview"],
    queryFn: () => call<ReferralOverview>("admin_referral_overview", {}, "Couldn't load invite numbers."),
  });
}
