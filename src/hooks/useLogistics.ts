import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type LogisticsCompany = Database["public"]["Tables"]["logistics_companies"]["Row"];
export type LogisticsCompanyInput = Database["public"]["Tables"]["logistics_companies"]["Insert"];

/** The 44 local government areas of Kano State, for quick area picking. */
export const KANO_LGAS = [
  "Ajingi", "Albasu", "Bagwai", "Bebeji", "Bichi", "Bunkure", "Dala", "Dambatta", "Dawakin Kudu", "Dawakin Tofa",
  "Doguwa", "Fagge", "Gabasawa", "Garko", "Garun Mallam", "Gaya", "Gezawa", "Gwale", "Gwarzo", "Kabo",
  "Kano Municipal", "Karaye", "Kibiya", "Kiru", "Kumbotso", "Kunchi", "Kura", "Madobi", "Makoda", "Minjibir",
  "Nasarawa", "Rano", "Rimin Gado", "Rogo", "Shanono", "Sumaila", "Takai", "Tarauni", "Tofa", "Tsanyawa",
  "Tudun Wada", "Ungogo", "Warawa", "Wudil",
] as const;

export interface LogisticsOverview {
  /** Open (paid, not yet delivered) deliveries per company id, plus "unassigned". */
  openByCompany: Record<string, number>;
  waitingDispatch: number;
}

const COMPANIES_KEY = ["logistics-companies"];

export function useLogisticsCompanies() {
  return useQuery({
    queryKey: COMPANIES_KEY,
    queryFn: async (): Promise<LogisticsCompany[]> => {
      const { data, error } = await supabase
        .from("logistics_companies")
        .select("*")
        .order("is_active", { ascending: false })
        .order("priority")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useLogisticsOverview() {
  return useQuery({
    queryKey: ["logistics-overview"],
    queryFn: async (): Promise<LogisticsOverview> => {
      const { data, error } = await supabase.rpc("admin_logistics_overview");
      if (error) throw error;
      const raw = (data ?? {}) as { open_by_company?: Record<string, number>; waiting_dispatch?: number };
      return { openByCompany: raw.open_by_company ?? {}, waitingDispatch: Number(raw.waiting_dispatch) || 0 };
    },
    refetchInterval: 60_000,
  });
}

/** Add a company (no id) or update one (with id). */
export function useSaveLogisticsCompany() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (company: LogisticsCompanyInput) => {
      const clean = {
        ...company,
        name: company.name.trim(),
        areas: [...new Set((company.areas ?? []).map((a) => a.trim()).filter(Boolean))],
      };
      const { error } = company.id
        ? await supabase.from("logistics_companies").update(clean).eq("id", company.id)
        : await supabase.from("logistics_companies").insert(clean);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COMPANIES_KEY });
      queryClient.invalidateQueries({ queryKey: ["logistics-overview"] });
    },
  });
}

/** WhatsApp/phone numbers typed as 080… become 23480… for wa.me links. */
export function whatsappNumber(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("234")) return digits;
  if (digits.startsWith("0")) return `234${digits.slice(1)}`;
  return digits;
}

// ---------------------------------------------------------------------------
// Delivery company accounts (/delivery) and admin links to them
// ---------------------------------------------------------------------------

export type DeliveryStage = "new" | "accepted" | "picked_up" | "on_the_way" | "delivered" | "cancelled";
export type DeliveryAction = "accept" | "picked_up" | "on_the_way" | "problem";

export interface DeliveryPickup {
  shop: string;
  phone: string | null;
  address: string;
  lat: string | null;
  lng: string | null;
  items: number;
  ready: boolean;
}

export interface DeliveryJob {
  order_id: string;
  ref: string;
  stage: DeliveryStage;
  order_status: string;
  paid_at: string;
  assigned_at: string;
  accepted_at: string | null;
  picked_up_at: string | null;
  delivered_at: string | null;
  rider_name: string | null;
  rider_phone: string | null;
  problem: string | null;
  delivery_fee: number;
  items: number;
  customer: { name: string | null; phone: string | null; address: string };
  pickups: DeliveryPickup[];
}

export interface DeliveryDashboard {
  company: { id: string; name: string; phone: string | null; areas: string[] };
  jobs: DeliveryJob[];
}

export interface LogisticsMember {
  user_id: string;
  email: string;
  name: string;
}

const DELIVERY_KEY = ["delivery-dashboard"];
const DELIVERY_REFRESH_MS = 30_000;

/** Postgres error text is written for people; anything technical gets the fallback. */
function readableError(error: unknown, fallback: string): Error {
  const message = (error as { message?: string })?.message;
  return new Error(message && !/^(JWT|PGRST|permission denied)/i.test(message) ? message : fallback);
}

/** "Kofar waika, , Gwale" → "Kofar waika, Gwale". */
export function tidyAddress(address: string | null | undefined): string {
  return (address ?? "").split(",").map((part) => part.trim()).filter(Boolean).join(", ");
}

/** The delivery company this account belongs to (links it by email the first time), or null. */
export function useMyLogisticsCompanyId(enabled: boolean) {
  return useQuery({
    queryKey: ["my-logistics-company"],
    enabled,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("my_logistics_company_id" as never);
      if (error) throw readableError(error, "Couldn't check your delivery account.");
      return (data as string | null) ?? null;
    },
  });
}

export function useDeliveryDashboard(enabled: boolean) {
  return useQuery({
    queryKey: DELIVERY_KEY,
    enabled,
    refetchInterval: DELIVERY_REFRESH_MS,
    queryFn: async (): Promise<DeliveryDashboard> => {
      const { data, error } = await supabase.rpc("logistics_dashboard" as never);
      if (error) throw readableError(error, "Couldn't load your deliveries.");
      const raw = data as unknown as DeliveryDashboard;
      return {
        company: raw.company,
        jobs: (raw.jobs ?? []).map((job) => ({
          ...job,
          delivery_fee: Number(job.delivery_fee) || 0,
          items: Number(job.items) || 0,
          customer: { ...job.customer, address: tidyAddress(job.customer?.address) },
          pickups: (job.pickups ?? []).map((p) => ({ ...p, items: Number(p.items) || 0, address: tidyAddress(p.address) })),
        })),
      };
    },
  });
}

export function useUpdateDeliveryJob() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; action: DeliveryAction; note?: string; riderName?: string; riderPhone?: string }) => {
      const { error } = await supabase.rpc("logistics_update_job" as never, {
        p_order_id: input.orderId,
        p_action: input.action,
        p_note: input.note ?? null,
        p_rider_name: input.riderName ?? null,
        p_rider_phone: input.riderPhone ?? null,
      } as never);
      if (error) throw readableError(error, "Couldn't update this delivery. Please try again.");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: DELIVERY_KEY }),
  });
}

export interface ConfirmDeliveryResult {
  ok: boolean;
  code: "delivered" | "already_delivered" | "wrong_code" | "too_many" | "cancelled";
  message: string;
}

/** The rider types the customer's 6-digit delivery code. */
export function useConfirmDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { orderId: string; code: string }): Promise<ConfirmDeliveryResult> => {
      const { data, error } = await supabase.rpc("logistics_confirm_delivery" as never, {
        p_order_id: input.orderId,
        p_code: input.code,
      } as never);
      if (error) throw readableError(error, "Couldn't check the code. Please try again.");
      return data as unknown as ConfirmDeliveryResult;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: DELIVERY_KEY }),
  });
}

/** Admin: who has signed in for each company, keyed by company id. */
export function useLogisticsMembers() {
  return useQuery({
    queryKey: ["logistics-members"],
    queryFn: async (): Promise<Record<string, LogisticsMember[]>> => {
      const { data, error } = await supabase.rpc("admin_logistics_members" as never);
      if (error) throw readableError(error, "Couldn't load company logins.");
      return (data as unknown as Record<string, LogisticsMember[]>) ?? {};
    },
  });
}

/** Admin: open (or reuse) the chat with one account, returns the conversation id. */
export function useOpenUserChat() {
  return useMutation({
    mutationFn: async (userId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("admin_open_user_chat" as never, { p_user_id: userId } as never);
      if (error) throw readableError(error, "Couldn't open the chat.");
      return data as unknown as string;
    },
  });
}
