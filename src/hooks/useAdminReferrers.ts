import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ADMIN_LIST_STALE_TIME_MS, adminRpcError, pagingArgs, resolveListParams, type AdminListParams } from "@/hooks/adminList";

const RPC = "admin_referrers";

/** Sort orders for the referrals list (also the filter chips). */
export const REFERRER_SORTS = ["earned", "invited", "verified", "recent"] as const;
export type ReferrerSort = (typeof REFERRER_SORTS)[number];
export const DEFAULT_REFERRER_SORT: ReferrerSort = "earned";

export interface Referrer {
  id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  is_seller: boolean;
  invited: number;
  verified: number;
  held: number;
  waiting: number;
  blocked: number;
  last_invite_at: string | null;
  reward_k2: number;
  commission_k2: number;
  earned_k2: number;
  balance_k2: number;
}

export interface ReferralTotals {
  referrers: number;
  invited: number;
  verified: number;
  held: number;
  waiting: number;
  reward_k2: number;
  commission_k2: number;
}

const EMPTY_TOTALS: ReferralTotals = { referrers: 0, invited: 0, verified: 0, held: 0, waiting: 0, reward_k2: 0, commission_k2: 0 };
const NUMBER_FIELDS = ["invited", "verified", "held", "waiting", "blocked", "reward_k2", "commission_k2", "earned_k2", "balance_k2"] as const;

function toReferrer(row: Record<string, unknown>): Referrer {
  const r = { ...row } as Record<string, unknown>;
  NUMBER_FIELDS.forEach((key) => { r[key] = Number(r[key] ?? 0); });
  return r as unknown as Referrer;
}

/** Everyone who invited people: counts and K² earned, sorted and searched on the server. */
export function useAdminReferrers(params: AdminListParams<ReferrerSort>) {
  const resolved = resolveListParams(params, DEFAULT_REFERRER_SORT);
  return useQuery({
    queryKey: ["admin-referrers", resolved],
    placeholderData: keepPreviousData,
    staleTime: ADMIN_LIST_STALE_TIME_MS,
    queryFn: async () => {
      const { p_search, p_limit, p_offset } = pagingArgs(resolved) as { p_search: string | null; p_limit: number; p_offset: number };
      const { data, error } = await supabase.rpc(RPC as never, { p_search, p_sort: resolved.filter, p_limit, p_offset } as never);
      if (error) throw adminRpcError(RPC, error, resolved);
      const result = (data ?? {}) as { total?: number; totals?: Record<string, unknown>; rows?: Record<string, unknown>[] };
      const totals = { ...EMPTY_TOTALS };
      Object.keys(EMPTY_TOTALS).forEach((key) => {
        totals[key as keyof ReferralTotals] = Number(result.totals?.[key] ?? 0);
      });
      return { total: Number(result.total ?? 0), totals, rows: (result.rows ?? []).map(toReferrer) };
    },
  });
}
