import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfilePrivate, withProfilePrivate } from "@/lib/profilePrivate";
import type { Tables } from "@/integrations/supabase/types";

export type VendorApplication = Tables<"vendor_applications">;

export const SELLER_PHONE_PATTERN = /^(\+?234|0)[789][01]\d{8}$/;

export function normalizePhone(value: string): string {
  return value.replace(/[\s-]/g, "");
}

export interface ShopDetails {
  shop_name: string;
  phone: string;
  city: string;
  state: string;
  description: string;
}

/** Returns a message for the first problem, or null when the details are complete. */
export function validateShopDetails(d: ShopDetails): string | null {
  if (d.shop_name.trim().length < 2) return "Enter your shop name";
  if (!SELLER_PHONE_PATTERN.test(normalizePhone(d.phone))) return "Enter a valid Nigerian phone number, e.g. 0803 123 4567";
  if (d.city.trim().length < 2) return "Enter the town or city where you work";
  if (!d.state) return "Choose your state";
  if (d.description.trim().length < 20) return "Tell us a little more about what you sell (at least 20 characters)";
  return null;
}

/** The signed-in user's own seller application, if any. */
export function useMyVendorApplication(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["vendor-application", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_applications")
        .select("*")
        .eq("user_id", userId!)
        .maybeSingle();
      if (error) throw error;
      return data as VendorApplication | null;
    },
  });
}

/** A signed-in customer applies, or fixes a rejected application. */
export function useSubmitVendorApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (details: ShopDetails & { full_name?: string }) => {
      const { data, error } = await supabase.rpc("submit_vendor_application", {
        p_shop_name: details.shop_name.trim(),
        p_phone: normalizePhone(details.phone),
        p_city: details.city.trim(),
        p_state: details.state,
        p_description: details.description.trim(),
        p_full_name: details.full_name?.trim() || undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["vendor-application"] }),
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export interface AdminVendorApplication extends VendorApplication {
  email: string | null;
}

export function useAdminVendorApplications() {
  return useQuery({
    queryKey: ["admin-vendor-applications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vendor_applications")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as VendorApplication[];
      const ids = rows.map((r) => r.user_id);
      const emails = new Map<string, string>();
      if (ids.length) {
        const privateById = await fetchProfilePrivate(ids);
        privateById.forEach((p) => p.email && emails.set(p.id, p.email));
      }
      // Pending first (oldest first, so nobody waits too long), then the rest newest first.
      const pending = rows.filter((r) => r.status === "pending").reverse();
      const rest = rows.filter((r) => r.status !== "pending");
      return [...pending, ...rest].map((r) => ({ ...r, email: emails.get(r.user_id) ?? null })) as AdminVendorApplication[];
    },
  });
}

export function usePendingApplicationCount() {
  const { data } = useAdminVendorApplications();
  return (data ?? []).filter((a) => a.status === "pending").length;
}

export function useReviewVendorApplication() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, approve, note }: { userId: string; approve: boolean; note?: string }) => {
      const { data, error } = await supabase.rpc("admin_review_vendor_application", {
        p_user_id: userId,
        p_approve: approve,
        p_note: note?.trim() || undefined,
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-vendor-applications"] });
      queryClient.invalidateQueries({ queryKey: ["admin-vendors"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });
}

/** wa.me link with a ready-made message, e.g. to tell a seller their shop is ready. */
export function whatsAppLink(phone: string, message: string): string {
  const digits = normalizePhone(phone).replace(/^\+/, "");
  const international = digits.startsWith("0") ? `234${digits.slice(1)}` : digits;
  return `https://wa.me/${international}?text=${encodeURIComponent(message)}`;
}
