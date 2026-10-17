import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  ADMIN_LIST_STALE_TIME_MS,
  adminRpcError,
  bool,
  fetchAllAdminPages,
  num,
  pagingArgs,
  parseAdminListResult,
  recordOrNull,
  resolveListParams,
  str,
  strOrNull,
  type AdminListPage,
  type AdminListParams,
  type ResolvedListParams,
} from "@/hooks/adminList";

const RPC = "admin_list_vendors";

export type BadgeTier = "none" | "blue" | "gold";

/** The badge a seller shows right now. */
export function badgeTierOf(vendor: { is_verified: boolean; verification_tier?: string | null }): BadgeTier {
  if (!vendor.is_verified) return "none";
  return vendor.verification_tier === "gold" ? "gold" : "blue";
}

export const ADMIN_VENDOR_FILTERS = ["all", "verified", "gold", "unverified"] as const;
export type AdminVendorFilter = (typeof ADMIN_VENDOR_FILTERS)[number];
export const DEFAULT_VENDOR_FILTER: AdminVendorFilter = "all";

export interface AdminVendor {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  verification_tier?: string | null;
  store_name: string | null;
  store_slug: string | null;
  store_description: string | null;
  created_at: string;
  product_count: number;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  payout_preference: string | null;
  store_address: {
    street?: string;
    city?: string;
    state?: string;
  } | null;
  total_sales: number;
  pending_payout: number;
}

function toStoreAddress(value: unknown): AdminVendor["store_address"] {
  const address = recordOrNull(value);
  if (!address) return null;
  return {
    street: strOrNull(address.street) ?? undefined,
    city: strOrNull(address.city) ?? undefined,
    state: strOrNull(address.state) ?? undefined,
  };
}

function toAdminVendor(row: Record<string, unknown>): AdminVendor {
  return {
    id: str(row.id),
    email: str(row.email),
    full_name: strOrNull(row.full_name),
    phone: strOrNull(row.phone),
    avatar_url: strOrNull(row.avatar_url),
    is_verified: bool(row.is_verified),
    verification_tier: strOrNull(row.verification_tier),
    store_name: strOrNull(row.store_name),
    store_slug: strOrNull(row.store_slug),
    store_description: strOrNull(row.store_description),
    created_at: str(row.created_at),
    product_count: num(row.product_count),
    bank_name: strOrNull(row.bank_name),
    account_number: strOrNull(row.account_number),
    account_name: strOrNull(row.account_name),
    payout_preference: strOrNull(row.payout_preference),
    store_address: toStoreAddress(row.store_address),
    total_sales: num(row.total_sales),
    pending_payout: num(row.pending_payout),
  };
}

async function callListVendors(args: {
  p_search: string | null;
  p_filter: AdminVendorFilter;
  p_limit: number;
  p_offset: number;
}): Promise<AdminListPage<AdminVendor>> {
  const { data, error } = await supabase.rpc(RPC, args);
  if (error) throw adminRpcError(RPC, error, args);
  return parseAdminListResult(data, RPC, toAdminVendor);
}

const fetchVendorsPage = (params: ResolvedListParams<AdminVendorFilter>) =>
  callListVendors({ ...pagingArgs(params), p_filter: params.filter });

/** Sets a seller's badge directly; the database function also notifies the seller. */
export function useSetVendorTier() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ vendorId, tier }: { vendorId: string; tier: BadgeTier }) => {
      const { error } = await supabase.rpc("admin_set_verification_tier", { p_vendor_id: vendorId, p_tier: tier });
      if (error) {
        console.error("[useSetVendorTier] admin_set_verification_tier failed", { vendorId, tier, error });
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
      queryClient.invalidateQueries({ queryKey: ["shops"] });
    },
  });
}

/** One page of sellers with their product count, sales and pending payout, searched and filtered in the database. */
export function useAdminVendors(params: AdminListParams<AdminVendorFilter> = {}) {
  const resolved = resolveListParams(params, DEFAULT_VENDOR_FILTER);
  const setTier = useSetVendorTier();

  const vendorsQuery = useQuery({
    queryKey: ["admin-vendors", "list", resolved],
    queryFn: () => fetchVendorsPage(resolved),
    placeholderData: keepPreviousData,
    staleTime: ADMIN_LIST_STALE_TIME_MS,
  });

  return {
    vendors: vendorsQuery.data?.rows ?? [],
    total: vendorsQuery.data?.total ?? 0,
    isLoading: vendorsQuery.isLoading,
    isFetching: vendorsQuery.isFetching,
    isPlaceholderData: vendorsQuery.isPlaceholderData,
    error: vendorsQuery.error,
    refetch: vendorsQuery.refetch,
    setTier,
  };
}

/** Every seller (200 per request), for pickers such as "Sold by" on the product form. */
export function useAllAdminVendors() {
  const vendorsQuery = useQuery({
    queryKey: ["admin-vendors", "all"],
    queryFn: () =>
      fetchAllAdminPages((limit, offset) => callListVendors({ p_search: null, p_filter: "all", p_limit: limit, p_offset: offset })),
    staleTime: ADMIN_LIST_STALE_TIME_MS,
  });

  return {
    vendors: vendorsQuery.data ?? [],
    isLoading: vendorsQuery.isLoading,
    error: vendorsQuery.error,
  };
}

export type AdminVendorFilterCounts = Record<AdminVendorFilter, number>;

/** How many sellers match the search under each filter chip (totals only, no rows). */
export function useAdminVendorFilterCounts(search: string) {
  const trimmed = search.trim();
  return useQuery({
    queryKey: ["admin-vendors", "counts", trimmed],
    queryFn: async (): Promise<AdminVendorFilterCounts> => {
      const totals = await Promise.all(
        ADMIN_VENDOR_FILTERS.map(async (filter) => {
          const { total } = await callListVendors({ p_search: trimmed || null, p_filter: filter, p_limit: 0, p_offset: 0 });
          return [filter, total] as const;
        }),
      );
      return Object.fromEntries(totals) as AdminVendorFilterCounts;
    },
    placeholderData: keepPreviousData,
    staleTime: ADMIN_LIST_STALE_TIME_MS,
  });
}
