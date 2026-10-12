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
