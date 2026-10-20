import { useState } from "react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { ArrowDownRight, ArrowUpRight, Globe, Info, Minus, RefreshCw } from "lucide-react";
import { LiveVisitorsList } from "@/components/admin/LiveVisitorsList";
import { pageLabel, zoneLabel } from "@/lib/analyticsLabels";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  RANGE_LABELS, useAdminAnalytics, useLiveVisitors,
  type AnalyticsReport, type NamedCount, type RangeKey,
} from "@/hooks/useTrafficAnalytics";
import { cn } from "@/lib/utils";

type TrendMetric = "visitors" | "page_views" | "orders" | "revenue";

const TREND_LABELS: Record<TrendMetric, string> = {
  visitors: "Visitors",
  page_views: "Page views",
  orders: "Paid orders",
  revenue: "Revenue",
};

const MARK_COLOR = "hsl(var(--primary))";
const GRID_COLOR = "hsl(var(--border))";
const AXIS_TEXT = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };
const LIST_LIMIT = 8;

const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);
const count = (n: number) => new Intl.NumberFormat("en-NG").format(n);

function duration(seconds: number | null): string {
  if (!seconds) return "–";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m ? `${m}m ${s}s` : `${s}s`;
}

/** "/products/blue-kaftan" -> "Product · blue kaftan" so the list reads like the app. */
function Delta({ now, before }: { now: number; before: number }) {
  if (!before && !now) return null;
  if (!before) return <span className="text-xs text-muted-foreground">New</span>;
  const change = ((now - before) / before) * 100;
  const Icon = Math.abs(change) < 0.5 ? Minus : change > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", change > 0 ? "text-green-700 dark:text-green-400" : change < 0 ? "text-red-700 dark:text-red-400" : "text-muted-foreground")}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {Math.abs(change).toFixed(0)}%<span className="sr-only">{change >= 0 ? " up" : " down"} from the previous period</span>
    </span>
  );
}

function StatTile({ label, value, sub, delta }: { label: string; value: string; sub?: string; delta?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
        {delta}
        {sub && <span>{sub}</span>}
      </div>
    </div>
  );
}

/** Ranked rows with a thin proportional bar: easier to read on a phone than a pie chart. */
function RankedList({
  title, rows, metric, metricLabel, label = (n) => n, href, extra,
}: {
  title: string;
  rows: NamedCount[];
  metric: string;
  metricLabel: string;
  label?: (name: string) => string;
  href?: (row: NamedCount) => string | null;
  extra?: (row: NamedCount) => string | null;
}) {
  const shown = rows.slice(0, LIST_LIMIT);
  const max = Math.max(1, ...shown.map((r) => Number(r[metric]) || 0));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-baseline justify-between text-sm font-semibold">
          {title}
          <span className="text-xs font-normal text-muted-foreground">{metricLabel}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No data yet</p>
        ) : (
          <ul className="space-y-2.5">
            {shown.map((row) => {
              const value = Number(row[metric]) || 0;
              const link = href?.(row);
              const text = label(String(row.name));
              const note = extra?.(row);
              return (
                <li key={String(row.name)}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    {link ? (
                      <Link to={link} className="min-w-0 truncate hover:underline">{text}</Link>
                    ) : (
                      <span className="min-w-0 truncate">{text}</span>
                    )}
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {note && <span className="mr-2 text-xs">{note}</span>}
                      {count(value)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary/80" style={{ width: `${(value / max) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function ChartTooltip({ active, payload, label, metric, unit }: {
  active?: boolean; payload?: { value: number }[]; label?: string; metric: TrendMetric; unit: "hour" | "day";
}) {
  if (!active || !payload?.length || !label) return null;
  const value = payload[0].value;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-md">
      <p className="text-muted-foreground">{format(parseISO(label), unit === "hour" ? "EEE d MMM, HH:00" : "EEE d MMM yyyy")}</p>
      <p className="mt-0.5 font-semibold">{TREND_LABELS[metric]}: {metric === "revenue" ? naira(value) : count(value)}</p>
    </div>
  );
}

function TrendCard({ report }: { report: AnalyticsReport }) {
  const [metric, setMetric] = useState<TrendMetric>("visitors");
  const tickFormat = (at: string) => format(parseISO(at), report.unit === "hour" ? "HH:mm" : "d MMM");
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 pb-2">
        <CardTitle className="text-sm font-semibold">Over time</CardTitle>
        <Tabs value={metric} onValueChange={(v) => setMetric(v as TrendMetric)}>
          <TabsList className="h-8 rounded-full">
            {(Object.keys(TREND_LABELS) as TrendMetric[]).map((m) => (
              <TabsTrigger key={m} value={m} className="rounded-full px-2.5 text-xs">{TREND_LABELS[m]}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="h-56 px-2 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={report.series} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={MARK_COLOR} stopOpacity={0.18} />
                <stop offset="100%" stopColor={MARK_COLOR} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
            <XAxis dataKey="at" tickFormatter={tickFormat} tick={AXIS_TEXT} tickLine={false} axisLine={false} minTickGap={24} />
            <YAxis
              tick={AXIS_TEXT} tickLine={false} axisLine={false} width={metric === "revenue" ? 64 : 36} allowDecimals={false}
              tickFormatter={(v: number) => (metric === "revenue" ? `₦${v >= 1000 ? `${Math.round(v / 1000)}k` : v}` : count(v))}
            />
            <Tooltip content={<ChartTooltip metric={metric} unit={report.unit} />} cursor={{ stroke: GRID_COLOR }} />
            <Area type="monotone" dataKey={metric} stroke={MARK_COLOR} strokeWidth={2} fill="url(#trendFill)" activeDot={{ r: 4 }} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function FunnelCard({ funnel }: { funnel: AnalyticsReport["funnel"] }) {
  const steps = [
    { label: "Visits", value: funnel.sessions },
    { label: "Viewed a product", value: funnel.viewed_product },
    { label: "Added to cart", value: funnel.added_to_cart },
    { label: "Started checkout", value: funnel.started_checkout },
    { label: "Paid", value: funnel.purchased },
  ];
  const top = Math.max(1, funnel.sessions);
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Shopping funnel</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {steps.map((step, i) => {
          const prev = i === 0 ? null : steps[i - 1].value;
          const kept = prev ? Math.round((step.value / prev) * 100) : null;
          return (
            <div key={step.label}>
              <div className="flex items-baseline justify-between text-sm">
                <span>{step.label}</span>
                <span className="tabular-nums">
                  {count(step.value)}
                  {kept !== null && <span className="ml-2 text-xs text-muted-foreground">{kept}% of previous</span>}
                </span>
              </div>
              <div className="mt-1 h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div className="h-full rounded-full bg-primary" style={{ width: `${(step.value / top) * 100}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function HoursCard({ hours }: { hours: AnalyticsReport["hours"] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Busiest times <span className="font-normal text-muted-foreground">(Nigerian time)</span></CardTitle>
      </CardHeader>
      <CardContent className="h-44 px-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={hours} margin={{ top: 4, right: 8, left: 0, bottom: 0 }} barCategoryGap={2}>
            <CartesianGrid vertical={false} stroke={GRID_COLOR} strokeDasharray="3 3" />
            <XAxis dataKey="hour" tick={AXIS_TEXT} tickLine={false} axisLine={false} interval={2}
              tickFormatter={(h: number) => `${h % 12 || 12}${h < 12 ? "am" : "pm"}`} />
            <YAxis tick={AXIS_TEXT} tickLine={false} axisLine={false} width={30} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: "hsl(var(--muted))" }}
              content={({ active, payload }) => active && payload?.length ? (
                <div className="rounded-xl border bg-popover px-3 py-2 text-xs shadow-md">
                  {String(payload[0].payload.hour).padStart(2, "0")}:00 – {count(Number(payload[0].value))} page views
                </div>
              ) : null}
            />
            <Bar dataKey="page_views" fill={MARK_COLOR} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function LiveCard() {
  const { data, isLoading } = useLiveVisitors();
  const people = data?.people ?? [];
  const signedIn = people.filter((p) => p.user_id).length;
  return (
    <Card>
      <CardContent className="flex items-start gap-3 p-4">
        <span className="relative mt-1.5 flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-green-500" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm">
            <span className="text-2xl font-semibold tabular-nums">{isLoading ? "–" : count(data?.visitors ?? 0)}</span>{" "}
            on the site right now
            {people.length > 0 && <span className="text-muted-foreground"> · {signedIn} signed in, {people.length - signedIn} {people.length - signedIn === 1 ? "guest" : "guests"}</span>}
          </p>
          {!!data?.pages.length && (
            <p className="mt-1 break-words text-xs text-muted-foreground">
              {data.pages.slice(0, 3).map((p) => `${pageLabel(p.name)} (${p.visitors})`).join(" · ")}
            </p>
          )}
        </div>
      </CardContent>
      <LiveVisitorsList people={people} preview={6} />
    </Card>
  );
}

export default function AdminAnalytics() {
  const [range, setRange] = useState<RangeKey>("7d");
  const { data: report, isLoading, error, refetch, isFetching } = useAdminAnalytics(range);
  const s = report?.summary;
  const p = report?.previous;
  const appTotal = report ? report.app.app + report.app.browser : 0;

  return (
    <AdminLayout title="Analytics">
      <div className="space-y-4">
        {/* Range filter, one row above everything it controls */}
        <div className="flex items-center gap-2">
          <div className="-mx-1 flex flex-1 gap-1.5 overflow-x-auto px-1 pb-1">
            {(Object.keys(RANGE_LABELS) as RangeKey[]).map((key) => (
              <Button key={key} size="sm" variant={range === key ? "default" : "outline"} className="h-8 shrink-0 rounded-full px-3 text-xs"
                onClick={() => setRange(key)} aria-pressed={range === key}>
                {RANGE_LABELS[key]}
              </Button>
            ))}
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 rounded-full" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>

        <LiveCard />

        {error ? (
          <Card><CardContent className="p-6 text-center text-sm text-destructive">{(error as Error).message}</CardContent></Card>
        ) : isLoading || !report || !s || !p ? (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
            <Skeleton className="col-span-2 h-64 rounded-2xl md:col-span-4" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatTile label="Visitors" value={count(s.visitors)} delta={<Delta now={s.visitors} before={p.visitors} />} sub={`${count(s.new_visitors)} new`} />
              <StatTile label="Visits" value={count(s.sessions)} delta={<Delta now={s.sessions} before={p.sessions} />} />
              <StatTile label="Page views" value={count(s.page_views)} delta={<Delta now={s.page_views} before={p.page_views} />} sub={`${s.pages_per_session ?? 0} per visit`} />
              <StatTile label="Time on site" value={duration(s.avg_session_seconds)} sub={`${s.bounce_rate ?? 0}% left after 1 page`} />
              <StatTile label="Revenue (paid)" value={naira(s.revenue)} delta={<Delta now={s.revenue} before={p.revenue} />} />
              <StatTile label="Paid orders" value={count(s.paid_orders)} delta={<Delta now={s.paid_orders} before={p.paid_orders} />} sub={`${count(s.orders)} placed`} />
              <StatTile label="Conversion" value={`${s.conversion_rate ?? 0}%`} sub="of visits paid" />
              <StatTile label="New sign-ups" value={count(s.signups)} delta={<Delta now={s.signups} before={p.signups} />} />
            </div>

            <TrendCard report={report} />

            <div className="grid gap-4 md:grid-cols-2">
              <FunnelCard funnel={report.funnel} />
              <RankedList title="Where visitors come from" rows={report.sources} metric="sessions" metricLabel="visits"
                extra={(r) => (Number(r.purchases) ? `${r.purchases} paid ·` : null)} />
              <RankedList title="Top pages" rows={report.pages} metric="views" metricLabel="views" label={pageLabel} href={(r) => String(r.name)} />
              <RankedList title="First page of the visit" rows={report.landing_pages} metric="sessions" metricLabel="visits" label={pageLabel}
                extra={(r) => `${r.bounce_rate}% left ·`} />
              <RankedList title="Most viewed products" rows={report.products} metric="views" metricLabel="views"
                href={(r) => `/products/${r.slug}`} extra={(r) => (Number(r.add_to_cart) ? `${r.add_to_cart} to cart ·` : null)} />
              <RankedList title="Most visited shops" rows={report.shops} metric="visitors" metricLabel="visitors"
                href={(r) => (r.slug ? `/shop/${r.slug}` : null)} />
              <RankedList title="What people search for" rows={report.searches} metric="count" metricLabel="searches" />
              <RankedList title="Websites that sent visitors" rows={report.referrers} metric="sessions" metricLabel="visits" />
              {report.campaigns.length > 0 && (
                <RankedList title="Campaigns (utm links)" rows={report.campaigns} metric="sessions" metricLabel="visits"
                  extra={(r) => (Number(r.purchases) ? `${r.purchases} paid ·` : null)} />
              )}
              <RankedList title="Countries (from device time zone)" rows={report.timezones} metric="visitors" metricLabel="visitors" label={zoneLabel} />
              <RankedList title="Devices" rows={report.devices} metric="sessions" metricLabel="visits" />
              <RankedList title="Phone / computer system" rows={report.os} metric="sessions" metricLabel="visits" />
              <RankedList title="Browsers & apps" rows={report.browsers} metric="sessions" metricLabel="visits" />
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Home-screen app vs browser</CardTitle></CardHeader>
                <CardContent>
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img"
                    aria-label={`${report.app.app} visits from the home-screen app, ${report.app.browser} from a browser`}>
                    <div className="h-full bg-primary" style={{ width: `${appTotal ? (report.app.app / appTotal) * 100 : 0}%` }} />
                  </div>
                  <div className="mt-2 flex justify-between text-sm">
                    <span><span className="font-semibold tabular-nums">{count(report.app.app)}</span> app</span>
                    <span><span className="font-semibold tabular-nums">{count(report.app.browser)}</span> browser</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <HoursCard hours={report.hours} />

            <Card>
              <CardContent className="flex gap-2 p-4 text-xs text-muted-foreground">
                <Info className="h-4 w-4 shrink-0" aria-hidden="true" />
                <p>
                  Admins, search robots and test tools aren't counted. A visit ends after 30 minutes without activity.
                  To see which posts bring sales, share links with <code>?utm_source=instagram&amp;utm_campaign=sallah</code> added
                  (for example <span className="inline-flex items-center gap-0.5"><Globe className="h-3 w-3" />kanokaftan.shop/?utm_source=whatsapp&amp;utm_campaign=status</span>).
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
