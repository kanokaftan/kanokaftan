import { useQuery } from "@tanstack/react-query";
import { Handshake, MessageCircle, ShoppingBag, type LucideIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

/** Used only until the real rates load (same as the database defaults). */
const DEFAULT_RATES = { checkout: 0, chat: 10 };
/** Price used in the worked example. */
const EXAMPLE_PRICE = 20_000;

const naira = (n: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

/** Commission per way of selling: app checkout and orders arranged through our chat. */
export function useEarningRates() {
  return useQuery({
    queryKey: ["platform-settings", "earning-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("commission_percent, checkout_commission_percent")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return {
        checkout: Number(data?.checkout_commission_percent ?? DEFAULT_RATES.checkout),
        chat: Number(data?.commission_percent ?? DEFAULT_RATES.chat),
      };
    },
    staleTime: 10 * 60_000,
  });
}

interface Model {
  icon: LucideIcon;
  title: string;
  youGet: string;
  detail: string;
  example?: string;
  tint: string;
}

function models(rates: { checkout: number; chat: number }): Model[] {
  const keep = (rate: number) => EXAMPLE_PRICE * (1 - rate / 100);
  return [
    {
      icon: ShoppingBag,
      title: "Customer buys in the app",
      youGet: rates.checkout > 0 ? `Your price minus ${rates.checkout}%` : "100% of your price",
      detail:
        "The customer pays Kano Kaftan at checkout and we deliver. You get half when they pay and the rest after delivery. We keep only the delivery fee the customer paid.",
      example: `${naira(EXAMPLE_PRICE)} item → you get ${naira(keep(rates.checkout))}`,
      tint: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    },
    {
      icon: MessageCircle,
      title: "We sell it for you through our chat",
      youGet: `Your price minus ${rates.chat}%`,
      detail: `When a customer asks Kano Kaftan for your product, we arrange the order, payment and delivery. We keep a ${rates.chat}% commission plus the delivery fee.`,
      example: `${naira(EXAMPLE_PRICE)} item → you get ${naira(keep(rates.chat))}`,
      tint: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    },
    {
      icon: Handshake,
      title: "You close the deal yourself",
      youGet: "100% yours, no fees",
      detail:
        "Chat or call customers and sell to them privately. Kano Kaftan takes nothing, but the deal, payment and delivery are between you and the customer, without our buyer protection.",
      tint: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
    },
  ];
}

/** The three ways sellers earn on Kano Kaftan, with live rates. */
export function HowYouEarn({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { data: rates = DEFAULT_RATES } = useEarningRates();
  return (
    <ol className={cn("space-y-2.5", className)}>
      {models(rates).map((m, i) => (
        <li key={m.title} className="flex gap-3 rounded-2xl border bg-card p-3.5">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", m.tint)}>
            <m.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Way {i + 1}</p>
            <p className="font-semibold leading-snug">{m.title}</p>
            <p className="mt-0.5 text-sm font-semibold text-primary">{m.youGet}</p>
            {!compact && <p className="mt-1 text-sm text-muted-foreground">{m.detail}</p>}
            {!compact && m.example && <p className="mt-1.5 inline-block rounded-md bg-muted px-2 py-0.5 text-xs tabular-nums">{m.example}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
