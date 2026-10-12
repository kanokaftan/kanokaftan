import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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

interface Row {
  icon: LucideIcon;
  title: string;
  youGet: string;
  detail: string;
  example?: string;
}

/** The three ways sellers earn on Kano Kaftan, with live rates, in the chosen language. */
export function HowYouEarn({ className }: { className?: string }) {
  const { t } = useTranslation();
  const { data: rates = DEFAULT_RATES } = useEarningRates();
  const keep = (rate: number) => naira(EXAMPLE_PRICE * (1 - rate / 100));

  const rows: Row[] = [
    {
      icon: ShoppingBag,
      title: t("seller.earn.appTitle"),
      youGet: rates.checkout > 0 ? t("seller.earn.appYouGetCut", { rate: rates.checkout }) : t("seller.earn.appYouGet"),
      detail: t("seller.earn.appDetail"),
      example: t("seller.earn.example", { price: naira(EXAMPLE_PRICE), amount: keep(rates.checkout) }),
    },
    {
      icon: MessageCircle,
      title: t("seller.earn.chatTitle"),
      youGet: t("seller.earn.chatYouGet", { rate: rates.chat }),
      detail: t("seller.earn.chatDetail", { rate: rates.chat }),
      example: t("seller.earn.example", { price: naira(EXAMPLE_PRICE), amount: keep(rates.chat) }),
    },
    {
      icon: Handshake,
      title: t("seller.earn.privateTitle"),
      youGet: t("seller.earn.privateYouGet"),
      detail: t("seller.earn.privateDetail"),
    },
  ];

  return (
    <ul className={cn("divide-y overflow-hidden rounded-2xl border bg-card", className)}>
      {rows.map((row) => (
        <li key={row.title} className="flex gap-3 p-4">
          <row.icon className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold leading-snug">{row.title}</p>
            <p className="text-sm font-medium">{row.youGet}</p>
            <p className="mt-1 text-sm text-muted-foreground">{row.detail}</p>
            {row.example && <p className="mt-1 text-xs tabular-nums text-muted-foreground">{row.example}</p>}
          </div>
        </li>
      ))}
    </ul>
  );
}
