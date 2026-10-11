import { useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { Eye } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useVendorAnalytics } from "@/hooks/useTrafficAnalytics";

const PERIODS = [7, 30, 90] as const;
const MARK_COLOR = "hsl(var(--primary))";
const count = (n: number) => new Intl.NumberFormat("en-NG").format(n);

/** A seller's own traffic: how many people saw their shop and products, and from where. */
export function ShopStatsCard() {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const { data, isLoading, error } = useVendorAnalytics(days);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 py-3 md:py-5">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <Eye className="h-4 w-4" aria-hidden="true" /> Shop visitors
        </CardTitle>
        <Tabs value={String(days)} onValueChange={(v) => setDays(Number(v) as (typeof PERIODS)[number])}>
          <TabsList className="h-8 rounded-full">
            {PERIODS.map((d) => (
              <TabsTrigger key={d} value={String(d)} className="rounded-full px-2.5 text-xs">{d}d</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {error ? (
          <p className="text-sm text-destructive">{(error as Error).message}</p>
        ) : isLoading || !data ? (
          <Skeleton className="h-40 rounded-xl" />
        ) : (
          <>
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                { label: "Visitors", value: data.visitors },
                { label: "Shop views", value: data.shop_views },
                { label: "Product views", value: data.product_views },
                { label: "Added to cart", value: data.add_to_cart },
              ].map((stat) => (
                <div key={stat.label} className="rounded-xl bg-muted p-2">
                  <p className="text-lg font-semibold tabular-nums">{count(stat.value)}</p>
                  <p className="text-[11px] leading-tight text-muted-foreground">{stat.label}</p>
                </div>
              ))}
            </div>

            <div className="h-28">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.series} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                  <defs>
                    <linearGradient id="shopViewsFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={MARK_COLOR} stopOpacity={0.18} />
                      <stop offset="100%" stopColor={MARK_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="at" hide />
                  <Tooltip
                    cursor={{ stroke: "hsl(var(--border))" }}
                    content={({ active, payload }) => active && payload?.length ? (
                      <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="text-muted-foreground">{format(parseISO(String(payload[0].payload.at)), "EEE d MMM")}</p>
                        <p className="font-semibold">{count(Number(payload[0].payload.visitors))} visitors · {count(Number(payload[0].value))} views</p>
                      </div>
                    ) : null}
                  />
                  <Area type="monotone" dataKey="views" stroke={MARK_COLOR} strokeWidth={2} fill="url(#shopViewsFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {data.products.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Most viewed products</p>
                <ul className="divide-y text-sm">
                  {data.products.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 py-1.5">
                      <Link to={`/products/${p.slug}`} className="min-w-0 truncate hover:underline">{p.name}</Link>
                      <span className="shrink-0 tabular-nums text-muted-foreground">
                        {count(p.views)} views{p.add_to_cart ? ` · ${count(p.add_to_cart)} to cart` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data.sources.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Visitors came from: {data.sources.map((s) => `${s.name} (${s.visitors})`).join(", ")}
              </p>
            )}
            {data.visitors === 0 && (
              <p className="text-xs text-muted-foreground">
                No visitors yet in this period. Share your shop link on WhatsApp status and Instagram to bring buyers in.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
