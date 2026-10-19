import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_LIST_STALE_TIME_MS,
  adminRpcError,
  bool,
  pagingArgs,
  parseAdminListResult,
  resolveListParams,
  str,
  strOrNull,
  type AdminListPage,
  type AdminListParams,
  type ResolvedListParams,
} from "@/hooks/adminList";

const RPC = "admin_list_users";

/** Users are buyers only (sellers and admins have their own pages); split by whether they linked a bank account. */
export const ADMIN_USER_ROLE_FILTERS = ["customer", "bank_linked", "bank_missing", "suspicious"] as const;
export type AdminUserRoleFilter = (typeof ADMIN_USER_ROLE_FILTERS)[number];
export const DEFAULT_USER_ROLE_FILTER: AdminUserRoleFilter = "customer";

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  verification_tier?: string | null;
  store_name: string | null;
  created_at: string;
  last_seen_at: string | null;
  roles: string[];
  /** Bank account linked to unlock first-buyer prices and invite rewards (masked: last 4 digits only). */
  bank: { bank_name: string; account_name: string; last4: string; verified_at: string } | null;
  invitedBy: { id: string; name: string } | null;
  friendsInvited: number;
  friendsVerified: number;
  k2Earned: number;
  /** Reasons the account may be a duplicate (see user_trust_flags). Hints to check, not proof. */
  flags: TrustFlag[];
}

export interface TrustFlag {
  code: "same_bank_name" | "same_phone" | "same_device" | "blocked_invite" | "invite_burst";
  label: string;
  other_id: string | null;
}

const num = (value: unknown) => (Number.isFinite(Number(value)) ? Number(value) : 0);

function toFlags(value: unknown): TrustFlag[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((f): f is Record<string, unknown> => !!f && typeof f === "object")
    .map((f) => ({ code: str(f.code) as TrustFlag["code"], label: str(f.label), other_id: strOrNull(f.other_id) }));
}

function toAdminUser(row: Record<string, unknown>): AdminUser {
  const roles = Array.isArray(row.roles) ? row.roles.filter((role): role is string => typeof role === "string") : [];
  return {
    id: str(row.id),
    email: str(row.email),
    full_name: strOrNull(row.full_name),
    phone: strOrNull(row.phone),
    avatar_url: strOrNull(row.avatar_url),
    is_verified: bool(row.is_verified),
    verification_tier: strOrNull(row.verification_tier),
    store_name: strOrNull(row.store_name),
    created_at: str(row.created_at),
    last_seen_at: strOrNull(row.last_seen_at),
    roles: roles.length ? roles : ["customer"],
    bank: row.bank_verified_at
      ? { bank_name: str(row.bank_name), account_name: str(row.bank_account_name), last4: str(row.account_last4), verified_at: str(row.bank_verified_at) }
      : null,
    invitedBy: row.invited_by_id ? { id: str(row.invited_by_id), name: str(row.invited_by_name) || "Someone" } : null,
    friendsInvited: num(row.friends_invited),
    friendsVerified: num(row.friends_verified),
    k2Earned: num(row.k2_earned),
    flags: toFlags(row.flags),
  };
}

async function fetchUsersPage(params: ResolvedListParams<AdminUserRoleFilter>): Promise<AdminListPage<AdminUser>> {
  const { data, error } = await supabase.rpc(RPC, { ...pagingArgs(params), p_role: params.filter });
  if (error) throw adminRpcError(RPC, error, params);
  return parseAdminListResult(data, RPC, toAdminUser);
}

/** One page of users (buyers), searched and filtered by bank status in the database. */
export function useAdminUsers(params: AdminListParams<AdminUserRoleFilter> = {}) {
  const queryClient = useQueryClient();
  const resolved = resolveListParams(params, DEFAULT_USER_ROLE_FILTER);

  const usersQuery = useQuery({
    queryKey: ["admin-users", "list", resolved],
    queryFn: () => fetchUsersPage(resolved),
    placeholderData: keepPreviousData,
    staleTime: ADMIN_LIST_STALE_TIME_MS,
  });

  const updateUserVerification = useMutation({
    mutationFn: async ({ userId, isVerified }: { userId: string; isVerified: boolean }) => {
      const { error } = await supabase.from("profiles").update({ is_verified: isVerified }).eq("id", userId);
      if (error) {
        console.error("[useAdminUsers] update verification failed", { userId, isVerified, error });
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });

  return {
    users: usersQuery.data?.rows ?? [],
    total: usersQuery.data?.total ?? 0,
    isLoading: usersQuery.isLoading,
    isFetching: usersQuery.isFetching,
    isPlaceholderData: usersQuery.isPlaceholderData,
    error: usersQuery.error,
    refetch: usersQuery.refetch,
    updateUserVerification,
  };
}

export type AdminUserRoleCounts = Record<AdminUserRoleFilter, number>;

/** How many people match the search in each role, for the filter chips (asks for totals only, no rows). */
export function useAdminUserRoleCounts(search: string) {
  const trimmed = search.trim();
  return useQuery({
    queryKey: ["admin-users", "counts", trimmed],
    queryFn: async (): Promise<AdminUserRoleCounts> => {
      const totals = await Promise.all(
        ADMIN_USER_ROLE_FILTERS.map(async (role) => {
          const { data, error } = await supabase.rpc(RPC, { p_search: trimmed || null, p_role: role, p_limit: 0, p_offset: 0 });
          if (error) throw adminRpcError(RPC, error, { role, search: trimmed });
          return [role, parseAdminListResult(data, RPC, toAdminUser).total] as const;
        }),
      );
      return Object.fromEntries(totals) as AdminUserRoleCounts;
    },
    placeholderData: keepPreviousData,
    staleTime: ADMIN_LIST_STALE_TIME_MS,
  });
}

/** Most rows the server returns per request; the export walks through pages of this size. */
const EXPORT_PAGE_SIZE = 200;
/** Safety stop for very large exports. */
const EXPORT_MAX_ROWS = 20_000;

/** Every user matching the search and filter (for "Download CSV"). */
export async function fetchAllAdminUsers(search: string, filter: AdminUserRoleFilter): Promise<AdminUser[]> {
  const all: AdminUser[] = [];
  for (let offset = 0; offset < EXPORT_MAX_ROWS; offset += EXPORT_PAGE_SIZE) {
    const { data, error } = await supabase.rpc(RPC, {
      p_search: search.trim() || null, p_role: filter, p_limit: EXPORT_PAGE_SIZE, p_offset: offset,
    });
    if (error) throw adminRpcError(RPC, error, { search, filter, offset });
    const page = parseAdminListResult(data, RPC, toAdminUser);
    all.push(...page.rows);
    if (page.rows.length < EXPORT_PAGE_SIZE || all.length >= page.total) break;
  }
  return all;
}

export interface AdminUserTrust {
  flags: (TrustFlag & { other_name: string | null; other_email: string | null; other_is_seller: boolean })[];
  invited_by: { id: string; name: string; status: string; joined_at: string } | null;
  k2_balance: number;
  k2_earned: number;
  friends: { id: string; name: string; email: string; referral_id: string; status: string; held_reason: string | null; joined_at: string; pings: number; bank_linked: boolean }[];
}

/** One user's invites, K² and duplicate-account hints (admin user page). */
export function useAdminUserTrust(userId: string | undefined) {
  return useQuery({
    queryKey: ["admin-trust", "user", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AdminUserTrust> => {
      const { data, error } = await supabase.rpc("admin_user_trust" as never, { p_user_id: userId } as never);
      if (error) throw adminRpcError("admin_user_trust", error, { userId });
      return data as unknown as AdminUserTrust;
    },
  });
}

export interface HeldReferral {
  id: string;
  held_at: string;
  reason: string | null;
  referrer_id: string;
  referrer_name: string;
  friend_id: string;
  friend_name: string;
  friend_bank_name: string | null;
  amount: number;
}

async function adminCall<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn as never, args as never);
  if (error) throw adminRpcError(fn, error, args);
  return data as T;
}

const TRUST_KEYS = [["admin-users"], ["admin-trust"]] as const;

function useInvalidateTrust() {
  const queryClient = useQueryClient();
  return () => TRUST_KEYS.forEach((queryKey) => queryClient.invalidateQueries({ queryKey: [...queryKey] }));
}

/** Invite rewards waiting for an admin because one side has a warning. */
export function useHeldReferrals() {
  return useQuery({
    queryKey: ["admin-trust", "held"],
    queryFn: () => adminCall<HeldReferral[]>("admin_held_referrals"),
    staleTime: ADMIN_LIST_STALE_TIME_MS,
  });
}

/** When warnings were last worked out for everyone, and how many rewards wait. */
export function useTrustStatus() {
  return useQuery({
    queryKey: ["admin-trust", "status"],
    queryFn: () => adminCall<{ checked_at: string | null; held: number }>("admin_trust_status"),
    staleTime: ADMIN_LIST_STALE_TIME_MS,
  });
}

export function useReviewHeldReferral() {
  const invalidate = useInvalidateTrust();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) =>
      adminCall<"approved" | "rejected">("admin_review_held_referral", { p_id: id, p_approve: approve }),
    onSettled: invalidate,
  });
}

export function useDismissTrustFlag() {
  const invalidate = useInvalidateTrust();
  return useMutation({
    mutationFn: ({ userId, code, otherId }: { userId: string; code: TrustFlag["code"]; otherId: string | null }) =>
      adminCall<void>("admin_dismiss_trust_flag", { p_user_id: userId, p_code: code, p_other_id: otherId }),
    onSettled: invalidate,
  });
}

/** Works out everyone's warnings now (normally done each night). */
export function useRecheckTrust() {
  const invalidate = useInvalidateTrust();
  return useMutation({
    mutationFn: () => adminCall<number>("admin_recheck_trust_flags"),
    onSettled: invalidate,
  });
}
