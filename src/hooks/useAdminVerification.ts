import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { withProfilePrivate } from "@/lib/profilePrivate";
import type { Database } from "@/integrations/supabase/types";

type VerificationRow = Database["public"]["Tables"]["vendor_verification_requests"]["Row"];
type PlacementRow = Database["public"]["Tables"]["featured_placements"]["Row"];

export type VerificationStatus = "awaiting_payment" | "pending_review" | "approved" | "rejected";
export type VerificationStatusFilter = VerificationStatus | "all";

export interface VerificationVendor {
  id: string;
  store_name: string | null;
  store_slug: string | null;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  verification_tier?: string | null;
  verified_until: string | null;
}

export interface AdminVerificationRequest extends VerificationRow {
  vendor: VerificationVendor | null;
}

export interface ActivePromotion extends PlacementRow {
  vendor: Pick<VerificationVendor, "id" | "store_name" | "store_slug" | "avatar_url"> | null;
  product: { id: string; name: string; slug: string } | null;
}

/** Signed URLs for ID documents are short-lived on purpose (private bucket). */
const DOCUMENT_URL_TTL_SECONDS = 600;
const VERIFICATION_DOCS_BUCKET = "verification-docs";

/** Order in which statuses are listed when showing "all": things needing action first. */
const STATUS_SORT_ORDER: Record<string, number> = {
  pending_review: 0,
  awaiting_payment: 1,
  rejected: 2,
  approved: 3,
};

export const ADMIN_VERIFICATION_QUERY_KEY = ["admin-verification-requests"] as const;
const ADMIN_PENDING_COUNT_QUERY_KEY = ["admin-verification-pending-count"] as const;

async function fetchVendorsByIds(ids: string[]): Promise<Map<string, VerificationVendor>> {
  const map = new Map<string, VerificationVendor>();
  if (ids.length === 0) return map;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, store_name, store_slug, full_name, avatar_url, is_verified, verification_tier, verified_until")
    .in("id", ids);

  if (error) {
    console.error("[useAdminVerification] Failed to load vendor profiles", error);
    throw error;
  }

  (await withProfilePrivate(data || [])).forEach((p) => map.set(p.id, p as unknown as VerificationVendor));
  return map;
}

function uniqueIds(ids: (string | null | undefined)[]): string[] {
  return [...new Set(ids.filter((id): id is string => !!id))];
}

/** All verification requests (optionally by status), with the vendor's profile attached. */
export function useAdminVerificationRequests(status: VerificationStatusFilter = "all") {
  return useQuery({
    queryKey: [...ADMIN_VERIFICATION_QUERY_KEY, status],
    queryFn: async (): Promise<AdminVerificationRequest[]> => {
      let query = supabase
        .from("vendor_verification_requests")
        .select("*")
        .order("created_at", { ascending: false });

      if (status !== "all") {
        query = query.eq("status", status);
      }

      const { data, error } = await query;
      if (error) {
        console.error("[useAdminVerification] Failed to load verification requests", error);
        throw error;
      }

      const rows = data || [];
      const vendors = await fetchVendorsByIds(uniqueIds(rows.map((r) => r.vendor_id)));

      return rows
        .map((row) => ({ ...row, vendor: vendors.get(row.vendor_id) ?? null }))
        .sort((a, b) => {
          const byStatus = (STATUS_SORT_ORDER[a.status] ?? 9) - (STATUS_SORT_ORDER[b.status] ?? 9);
          if (byStatus !== 0) return byStatus;
          // Oldest pending first so nobody waits too long; everything else newest first.
          if (a.status === "pending_review") {
            return new Date(a.paid_at || a.created_at).getTime() - new Date(b.paid_at || b.created_at).getTime();
          }
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
    },
  });
}

/** Number of requests waiting for an admin decision (for the tab badge). */
export function usePendingVerificationCount() {
  return useQuery({
    queryKey: ADMIN_PENDING_COUNT_QUERY_KEY,
    queryFn: async (): Promise<number> => {
      const { count, error } = await supabase
        .from("vendor_verification_requests")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_review");
      if (error) {
        console.error("[useAdminVerification] Failed to count pending requests", error);
        throw error;
      }
      return count || 0;
    },
  });
}

/** Creates a short-lived link to a private ID document. */
export async function getVerificationDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from(VERIFICATION_DOCS_BUCKET)
    .createSignedUrl(path, DOCUMENT_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    console.error("[useAdminVerification] Failed to sign document URL", { path, error });
    throw new Error("Could not open the ID document. It may have been removed.");
  }
  return data.signedUrl;
}

/** Signed URL as a query, so the review dialog can preview images inline. */
export function useVerificationDocumentUrl(path: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: ["admin-verification-doc", path],
    queryFn: () => getVerificationDocumentUrl(path as string),
    enabled: enabled && !!path,
    // Refresh well before the signed URL expires.
    staleTime: (DOCUMENT_URL_TTL_SECONDS / 2) * 1000,
    retry: false,
  });
}

export function useReviewVerification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ requestId, approve, note }: { requestId: string; approve: boolean; note?: string }) => {
      const trimmed = note?.trim();
      if (!approve && !trimmed) {
        throw new Error("Tell the seller what to fix before rejecting.");
      }

      const { data, error } = await supabase.rpc("admin_review_verification", {
        p_request_id: requestId,
        p_approve: approve,
        p_note: trimmed || undefined,
      });

      if (error) {
        console.error("[useAdminVerification] Review failed", { requestId, approve, error });
        throw new Error(error.message || "Could not save the review");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_VERIFICATION_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_PENDING_COUNT_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
}

// ---------------------------------------------------------------------------
// Monetisation settings & promotions (admin Settings / Finance)
// ---------------------------------------------------------------------------

export interface MonetisationSettings {
  verification_fee: number;
  gold_verification_fee: number;
  verification_period_days: number | null;
  featured_product_weekly_fee: number;
  featured_shop_weekly_fee: number;
  featured_max_weeks: number;
}

const MONETISATION_SETTINGS_QUERY_KEY = ["admin-monetisation-settings"] as const;

export function useMonetisationSettings() {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: MONETISATION_SETTINGS_QUERY_KEY,
    queryFn: async (): Promise<MonetisationSettings> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("verification_fee, gold_verification_fee, verification_period_days, featured_product_weekly_fee, featured_shop_weekly_fee, featured_max_weeks")
        .eq("id", 1)
        .single();
      if (error) {
        console.error("[useAdminVerification] Failed to load monetisation settings", error);
        throw error;
      }
      return {
        verification_fee: Number(data.verification_fee),
        gold_verification_fee: Number(data.gold_verification_fee),
        verification_period_days: data.verification_period_days,
        featured_product_weekly_fee: Number(data.featured_product_weekly_fee),
        featured_shop_weekly_fee: Number(data.featured_shop_weekly_fee),
        featured_max_weeks: data.featured_max_weeks,
      };
    },
  });

  const updateSettings = useMutation({
    mutationFn: async (values: MonetisationSettings) => {
      const { error } = await supabase.from("platform_settings").update(values).eq("id", 1);
      if (error) {
        console.error("[useAdminVerification] Failed to save monetisation settings", error);
        throw new Error(error.message || "Could not save settings");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MONETISATION_SETTINGS_QUERY_KEY });
      // Any other screen caching platform_settings (vendor pricing, payouts card).
      queryClient.invalidateQueries({
        predicate: (q) => typeof q.queryKey[0] === "string" && (q.queryKey[0] as string).includes("settings"),
      });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSettings,
  };
}

/** Paid featured placements that are currently running. */
export function useActivePromotions() {
  return useQuery({
    queryKey: ["admin-active-promotions"],
    queryFn: async (): Promise<ActivePromotion[]> => {
      const { data, error } = await supabase
        .from("featured_placements")
        .select("*, product:products(id, name, slug)")
        .eq("status", "active")
        .order("ends_at", { ascending: true });

      if (error) {
        console.error("[useAdminVerification] Failed to load active promotions", error);
        throw error;
      }

      const rows = data || [];
      const vendors = await fetchVendorsByIds(uniqueIds(rows.map((r) => r.vendor_id)));

      return rows.map((row) => {
        const vendor = vendors.get(row.vendor_id);
        return {
          ...row,
          product: (row.product as ActivePromotion["product"]) ?? null,
          vendor: vendor
            ? { id: vendor.id, store_name: vendor.store_name, store_slug: vendor.store_slug, avatar_url: vendor.avatar_url }
            : null,
        };
      });
    },
  });
}

export interface PlatformFeeIncome {
  verificationAllTime: number;
  verificationThisMonth: number;
  featuredAllTime: number;
  featuredThisMonth: number;
}

function sumPaid(rows: { amount: number; paid_at: string | null }[], since?: Date) {
  return rows.reduce((sum, r) => {
    if (!r.paid_at) return sum;
    if (since && new Date(r.paid_at) < since) return sum;
    return sum + Number(r.amount || 0);
  }, 0);
}

/** Money earned from verification fees and featured placements (paid rows only). */
export function usePlatformFeeIncome() {
  return useQuery({
    queryKey: ["admin-platform-fee-income"],
    queryFn: async (): Promise<PlatformFeeIncome> => {
      const [verifications, placements] = await Promise.all([
        supabase.from("vendor_verification_requests").select("amount, paid_at").not("paid_at", "is", null),
        supabase.from("featured_placements").select("amount, paid_at").not("paid_at", "is", null),
      ]);

      if (verifications.error || placements.error) {
        const error = verifications.error || placements.error;
        console.error("[useAdminVerification] Failed to load platform fee income", error);
        throw error;
      }

      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const verificationRows = verifications.data || [];
      const placementRows = placements.data || [];

      return {
        verificationAllTime: sumPaid(verificationRows),
        verificationThisMonth: sumPaid(verificationRows, monthStart),
        featuredAllTime: sumPaid(placementRows),
        featuredThisMonth: sumPaid(placementRows, monthStart),
      };
    },
  });
}
