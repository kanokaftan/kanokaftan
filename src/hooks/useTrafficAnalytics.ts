import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "90d" | "12m";

export const RANGE_LABELS: Record<RangeKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "7 days",
  "30d": "30 days",
  "90d": "90 days",
  "12m": "12 months",
};

/** Nigeria is UTC+1 all year (no daylight saving), so "midnight in Kano" is easy to compute. */
const LAGOS_OFFSET_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LIVE_REFRESH_MS = 30_000;
const REPORT_REFRESH_MS = 5 * 60_000;

function lagosMidnight(at: number): number {
  return Math.floor((at + LAGOS_OFFSET_MS) / DAY_MS) * DAY_MS - LAGOS_OFFSET_MS;
}

/** The [from, to) window for a preset, in Nigerian days. */
export function rangeBounds(key: RangeKey, now = Date.now()): { from: Date; to: Date } {
  const today = lagosMidnight(now);
  const days: Record<Exclude<RangeKey, "today" | "yesterday">, number> = { "7d": 7, "30d": 30, "90d": 90, "12m": 365 };
  if (key === "today") return { from: new Date(today), to: new Date(now) };
  if (key === "yesterday") return { from: new Date(today - DAY_MS), to: new Date(today) };
  return { from: new Date(today - (days[key] - 1) * DAY_MS), to: new Date(now) };
}

export interface NamedCount {
  name: string;
  [metric: string]: string | number | null;
}

export interface AnalyticsReport {
  unit: "hour" | "day";
  summary: {
    visitors: number;
    new_visitors: number;
    sessions: number;
    page_views: number;
    bounce_rate: number | null;
    avg_session_seconds: number | null;
    pages_per_session: number | null;
    signups: number;
    orders: number;
    paid_orders: number;
    revenue: number;
    conversion_rate: number | null;
  };
  previous: { visitors: number; sessions: number; page_views: number; paid_orders: number; revenue: number; signups: number };
  series: { at: string; visitors: number; page_views: number; orders: number; revenue: number }[];
  funnel: { sessions: number; viewed_product: number; added_to_cart: number; started_checkout: number; purchased: number };
  sources: NamedCount[];
  referrers: NamedCount[];
  campaigns: NamedCount[];
  pages: NamedCount[];
  landing_pages: NamedCount[];
  products: (NamedCount & { slug: string })[];
  shops: (NamedCount & { slug: string | null })[];
  searches: NamedCount[];
  devices: NamedCount[];
  os: NamedCount[];
  browsers: NamedCount[];
  app: { app: number; browser: number };
  timezones: NamedCount[];
  hours: { hour: number; page_views: number }[];
}

export type LiveVisitorRole = "guest" | "buyer" | "seller" | "admin" | "delivery";

/** One person on the site in the last 5 minutes (account details when signed in on this device today). */
export interface LiveVisitor {
  visitor_id: string;
  user_id: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  store_name: string | null;
  role: LiveVisitorRole;
  path: string;
  source: string | null;
  device: string | null;
  os: string | null;
  browser: string | null;
  app: boolean;
  timezone: string | null;
  last_seen: string;
  visit_started: string | null;
  pages_seen: number;
}

export interface LiveVisitors {
  visitors: number;
  pages: { name: string; visitors: number }[];
  people: LiveVisitor[];
}

export function useAdminAnalytics(range: RangeKey) {
  return useQuery({
    queryKey: ["admin-analytics", range],
    queryFn: async (): Promise<AnalyticsReport> => {
      const { from, to } = rangeBounds(range);
      const { data, error } = await supabase.rpc("admin_analytics", { p_from: from.toISOString(), p_to: to.toISOString() });
      if (error) {
        console.error("[analytics] report failed", { range, error });
        throw new Error(error.message || "Could not load analytics");
      }
      return data as unknown as AnalyticsReport;
    },
    staleTime: 60_000,
    refetchInterval: REPORT_REFRESH_MS,
  });
}

export function useLiveVisitors() {
  return useQuery({
    queryKey: ["admin-live-visitors"],
    queryFn: async (): Promise<LiveVisitors> => {
      const { data, error } = await supabase.rpc("admin_live_visitors");
      if (error) {
        console.error("[analytics] live visitors failed", error);
        throw new Error(error.message || "Could not load live visitors");
      }
      const raw = data as unknown as LiveVisitors;
      return { ...raw, people: raw.people ?? [] };
    },
    refetchInterval: LIVE_REFRESH_MS,
  });
}

export interface VendorAnalytics {
  days: number;
  visitors: number;
  shop_views: number;
  product_views: number;
  add_to_cart: number;
  wishlist: number;
  series: { at: string; views: number; visitors: number }[];
  sources: { name: string; visitors: number }[];
  products: { id: string; name: string; slug: string; views: number; add_to_cart: number }[];
}

export function useVendorAnalytics(days: number, enabled = true) {
  return useQuery({
    queryKey: ["vendor-analytics", days],
    queryFn: async (): Promise<VendorAnalytics> => {
      const { data, error } = await supabase.rpc("vendor_analytics", { p_days: days });
      if (error) {
        console.error("[analytics] vendor report failed", error);
        throw new Error(error.message || "Could not load your shop stats");
      }
      return data as unknown as VendorAnalytics;
    },
    enabled,
    staleTime: 5 * 60_000,
  });
}
