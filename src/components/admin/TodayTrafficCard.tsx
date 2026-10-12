import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, Laptop, Smartphone, UserPlus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface TodayOverview {
  live: number;
  visitors: number;
  page_views: number;
  devices: { name: string; visitors: number }[];
  top_page: { path: string; name: string; views: number } | null;
  top_shop: { name: string; slug: string | null; views: number } | null;
  signups_today: number;
  recent_signups: { id: string; name: string | null; email: string | null; created_at: string }[];
}

const REFRESH_MS = 60_000;
const count = (n: number) => new Intl.NumberFormat("en-NG").format(n);

/** Admin dashboard: today's traffic at a glance, plus the newest sign-ups. */
export function TodayTrafficCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["admin-today-overview"],
    queryFn: async (): Promise<TodayOverview> => {
      const { data, error } = await supabase.rpc("admin_today_overview");
      if (error) {
        console.error("[TodayTrafficCard] overview failed", error);
        throw new Error(error.message || "Could not load today's traffic");
      }
      return data as unknown as TodayOverview;
    },
    refetchInterval: REFRESH_MS,
  });

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />;
  if (error || !data) {
    return (
      <Card><CardContent className="p-4 text-sm text-destructive">{(error as Error)?.message ?? "Could not load today's traffic"}</CardContent></Card>
    );
  }

  const totalDevices = Math.max(1, data.devices.reduce((sum, d) => sum + d.visitors, 0));

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Today on the site</h3>
          <Link to="/admin/analytics" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            Full analytics <ArrowRight className="h-3 w-3" />
          </Link>
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <div className="rounded-xl bg-muted p-2">
            <p className="flex items-center justify-center gap-1.5 text-lg font-semibold tabular-nums">
              <span className="relative flex h-2 w-2" aria-hidden="true">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
              </span>
              {count(data.live)}
            </p>
            <p className="text-[11px] text-muted-foreground">Online now</p>
          </div>
          {[
            { label: "Visitors", value: data.visitors },
            { label: "Page views", value: data.page_views },
            { label: "Sign-ups", value: data.signups_today },
          ].map((s) => (
            <div key={s.label} className="rounded-xl bg-muted p-2">
              <p className="text-lg font-semibold tabular-nums">{count(s.value)}</p>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        {data.devices.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Devices used</p>
            <div className="flex flex-wrap gap-2">
              {data.devices.map((d) => {
                const Icon = d.name === "Computer" ? Laptop : Smartphone;
                return (
                  <span key={d.name} className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs">
                    <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {d.name} <span className="font-semibold tabular-nums">{count(d.visitors)}</span>
                    <span className="text-muted-foreground">({Math.round((d.visitors / totalDevices) * 100)}%)</span>
                  </span>
                );
              })}
            </div>
          </div>
        )}

        <div className="grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Most viewed page</p>
            {data.top_page ? (
              <Link to={data.top_page.path} className="mt-0.5 block truncate font-medium hover:underline">
                {data.top_page.name} <span className="font-normal text-muted-foreground">· {count(data.top_page.views)} views</span>
              </Link>
            ) : (
              <p className="mt-0.5 text-muted-foreground">No visits yet today</p>
            )}
          </div>
          <div className="rounded-xl border p-3">
            <p className="text-xs text-muted-foreground">Most viewed shop</p>
            {data.top_shop ? (
              <Link to={data.top_shop.slug ? `/shop/${data.top_shop.slug}` : "/admin/vendors"} className="mt-0.5 block truncate font-medium hover:underline">
                {data.top_shop.name} <span className="font-normal text-muted-foreground">· {count(data.top_shop.views)} views</span>
              </Link>
            ) : (
              <p className="mt-0.5 text-muted-foreground">No shop visits yet today</p>
            )}
          </div>
        </div>

        {data.recent_signups.length > 0 && (
          <div>
            <div className="mb-1 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">Newest sign-ups</p>
              <Link to="/admin/users" className="text-xs font-medium text-primary hover:underline">All users</Link>
            </div>
            <ul className="divide-y">
              {data.recent_signups.map((u) => (
                <li key={u.id} className="flex items-center gap-2.5 py-2 text-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                    <UserPlus className="h-4 w-4" aria-hidden="true" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{u.name || "No name yet"}</span>
                    <span className="block truncate text-xs text-muted-foreground">{u.email}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDistanceToNowStrict(new Date(u.created_at), { addSuffix: true })}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
