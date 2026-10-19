import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/** Badge marks shown on shops: the partner's own badge and any partner labels it was given. */
export interface ShopMark {
  partner: string | null;
  choices: string[];
}
export type ShopMarks = Record<string, ShopMark>;

export interface HomepagePartner {
  id: string;
  name: string;
  badge_label: string;
  choice_label: string;
  title: string;
  tagline: string | null;
  store_name: string | null;
  store_slug: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  picks: { store_name: string; store_slug: string; avatar_url: string | null }[];
}

export interface MyPartner {
  id: string;
  name: string;
  badge_label: string;
  choice_label: string;
  commission_percent: number;
  starts_on: string;
  ends_on: string | null;
  store_name: string | null;
  store_slug: string | null;
}

export interface PartnerMember {
  user_id: string;
  email: string | null;
  name: string | null;
}

export interface PartnerSummary {
  id: string;
  name: string;
  vendor_id: string | null;
  badge_label: string;
  choice_label: string | null;
  commission_percent: number;
  starts_on: string;
  ends_on: string | null;
  is_active: boolean;
  show_on_homepage: boolean;
  homepage_title: string | null;
  homepage_tagline: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  notes: string | null;
  store_name: string | null;
  store_slug: string | null;
  members: PartnerMember[];
  choices: number;
  unpaid: number;
  paid: number;
}

/** A removed partner kept for its money records. */
export interface ArchivedPartner {
  id: string;
  name: string;
  badge_label: string;
  commission_percent: number;
  starts_on: string;
  ends_on: string | null;
  archived_at: string;
  store_name: string | null;
  bank_name: string | null;
  account_name: string | null;
  account_number: string | null;
  unpaid: number;
  paid: number;
}

export type PartnerInput = Partial<Omit<PartnerSummary, "id" | "members" | "choices" | "unpaid" | "paid" | "store_name" | "store_slug">> & {
  name: string;
};

export type CommissionStatus = "unpaid" | "paid" | "reversed";

export interface CommissionLine {
  id: string;
  store_name: string;
  tier: "blue" | "gold";
  payment_amount: number;
  payment_paid_at: string;
  commission_percent: number;
  amount: number;
  status: CommissionStatus;
  reversed_reason: string | null;
  payout_id: string | null;
}

export interface PartnerPayout {
  id: string;
  amount: number;
  items: number;
  reference: string | null;
  note: string | null;
  paid_at: string;
}

export interface PartnerStatement {
  lines: CommissionLine[];
  payouts: PartnerPayout[];
  unpaid: number;
  paid: number;
}

export interface ChoiceShop {
  vendor_id: string;
  store_name: string;
  store_slug: string | null;
  avatar_url: string | null;
  city: string | null;
  note?: string | null;
  awarded_at?: string;
}

const MARKS_STALE_MS = 5 * 60 * 1000;
const PARTNER_KEY = ["partners"];

/** Postgres messages from these functions are written for people; anything technical gets the fallback. */
function readable(error: unknown, fallback: string): Error {
  const message = (error as { message?: string })?.message;
  return new Error(message && !/^(JWT|PGRST|permission denied)/i.test(message) ? message : fallback);
}

async function call<T>(fn: Parameters<typeof supabase.rpc>[0], args: Record<string, unknown>, fallback: string): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args as never);
  if (error) {
    console.error(`[partners] ${String(fn)} failed`, error);
    throw readable(error, fallback);
  }
  return data as T;
}

/** All shop marks in one small map, cached for every tile and shop page. */
export function useShopMarks() {
  return useQuery({
    queryKey: [...PARTNER_KEY, "marks"],
    staleTime: MARKS_STALE_MS,
    queryFn: () => call<ShopMarks>("shop_marks", {}, "Couldn't load shop badges."),
  });
}

export function useShopMark(vendorId: string | null | undefined): ShopMark | null {
  const { data } = useShopMarks();
  return (vendorId && data?.[vendorId]) || null;
}

export function useHomepagePartners() {
  return useQuery({
    queryKey: [...PARTNER_KEY, "homepage"],
    staleTime: MARKS_STALE_MS,
    queryFn: () => call<HomepagePartner[]>("homepage_partners", {}, "Couldn't load partners."),
  });
}

export function useMyPartner(enabled: boolean) {
  return useQuery({
    queryKey: [...PARTNER_KEY, "mine"],
    enabled,
    queryFn: () => call<MyPartner | null>("my_partner", {}, "Couldn't load your partner account."),
  });
}

export function usePartnerStatement(partnerId: string | null | undefined) {
  return useQuery({
    queryKey: [...PARTNER_KEY, "statement", partnerId],
    enabled: !!partnerId,
    queryFn: () => call<PartnerStatement>("partner_statement", { p_partner_id: partnerId }, "Couldn't load the statement."),
  });
}

export function usePartnerChoices(partnerId: string | null | undefined, enabled = true) {
  return useQuery({
    queryKey: [...PARTNER_KEY, "choices", partnerId ?? "mine"],
    enabled,
    queryFn: () => call<ChoiceShop[]>("partner_choice_list", { p_partner_id: partnerId ?? null }, "Couldn't load your picks."),
  });
}

export function usePartnerFindShops(search: string, enabled: boolean) {
  return useQuery({
    queryKey: [...PARTNER_KEY, "find", search],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: () => call<ChoiceShop[]>("partner_find_shops", { p_search: search }, "Couldn't search shops."),
  });
}

function useInvalidatePartners() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PARTNER_KEY });
}

export function useAwardChoice(partnerId?: string | null) {
  const invalidate = useInvalidatePartners();
  return useMutation({
    mutationFn: ({ vendorId, note }: { vendorId: string; note?: string }) =>
      call<void>("partner_award_choice", { p_vendor_id: vendorId, p_note: note || null, p_partner_id: partnerId ?? null }, "Couldn't give the label."),
    onSuccess: invalidate,
  });
}

export function useWithdrawChoice(partnerId?: string | null) {
  const invalidate = useInvalidatePartners();
  return useMutation({
    mutationFn: (vendorId: string) =>
      call<void>("partner_withdraw_choice", { p_vendor_id: vendorId, p_partner_id: partnerId ?? null }, "Couldn't remove the label."),
    onSuccess: invalidate,
  });
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export function usePartnerOverview() {
  return useQuery({
    queryKey: [...PARTNER_KEY, "overview"],
    queryFn: () => call<PartnerSummary[]>("admin_partner_overview", {}, "Couldn't load partners."),
  });
}

export function useArchivedPartners(enabled: boolean) {
  return useQuery({
    queryKey: [...PARTNER_KEY, "archived"],
    enabled,
    queryFn: () => call<ArchivedPartner[]>("admin_archived_partners", {}, "Couldn't load removed partners."),
  });
}

export function useSavePartner() {
  const invalidate = useInvalidatePartners();
  return useMutation({
    mutationFn: ({ id, input }: { id: string | null; input: PartnerInput }) =>
      call<string>("admin_save_partner", { p_id: id, p_data: input as unknown as Json }, "Couldn't save the partner."),
    onSuccess: invalidate,
  });
}

/** Removes a partner: fully if they never earned commission, otherwise archived (money records kept). */
export function useDeletePartner() {
  const invalidate = useInvalidatePartners();
  return useMutation({
    mutationFn: (partnerId: string) =>
      call<"deleted" | "archived">("admin_delete_partner", { p_id: partnerId }, "Couldn't remove the partner."),
    onSuccess: invalidate,
  });
}

export function useAddPartnerMember(partnerId: string) {
  const invalidate = useInvalidatePartners();
  return useMutation({
    mutationFn: (email: string) =>
      call<string>("admin_add_partner_member", { p_partner_id: partnerId, p_email: email }, "Couldn't add this person."),
    onSuccess: invalidate,
  });
}

export function useRemovePartnerMember(partnerId: string) {
  const invalidate = useInvalidatePartners();
  return useMutation({
    mutationFn: (userId: string) =>
      call<void>("admin_remove_partner_member", { p_partner_id: partnerId, p_user_id: userId }, "Couldn't remove this person."),
    onSuccess: invalidate,
  });
}

export function usePayPartner(partnerId: string) {
  const invalidate = useInvalidatePartners();
  return useMutation({
    mutationFn: ({ reference, note }: { reference?: string; note?: string }) =>
      call<string>("admin_pay_partner", { p_partner_id: partnerId, p_reference: reference || null, p_note: note || null }, "Couldn't record the payout."),
    onSuccess: invalidate,
  });
}

export function useReverseCommission() {
  const invalidate = useInvalidatePartners();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      call<void>("admin_reverse_partner_commission", { p_commission_id: id, p_reason: reason }, "Couldn't reverse this commission."),
    onSuccess: invalidate,
  });
}
