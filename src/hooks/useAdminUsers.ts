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

export const ADMIN_USER_ROLE_FILTERS = ["customer", "vendor", "admin", "all"] as const;
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
  };
}

async function fetchUsersPage(params: ResolvedListParams<AdminUserRoleFilter>): Promise<AdminListPage<AdminUser>> {
  const { data, error } = await supabase.rpc(RPC, { ...pagingArgs(params), p_role: params.filter });
  if (error) throw adminRpcError(RPC, error, params);
  return parseAdminListResult(data, RPC, toAdminUser);
}

/** One page of people (customers by default), searched and filtered by role in the database. */
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
