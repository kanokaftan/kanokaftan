import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useReferralOverview } from "@/hooks/useReferral";
import { k2 } from "@/lib/k2";
import { naira } from "@/lib/naira";

/** Same limits as the database checks on platform_settings. */
const MAX_REWARD = 100_000;
const MAX_ORDER_PERCENT = 50;
const MAX_FIRST_BUYER_PERCENT = 90;

interface ReferralSettings {
  referral_enabled: boolean;
  referral_referrer_credit: number;
  referral_order_percent: number;
  first_buyer_min_percent: number;
  ambassador_badge_reward: number;
}

function useReferralSettings() {
  return useQuery({
    queryKey: ["referral-settings"],
    queryFn: async (): Promise<ReferralSettings> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("referral_enabled, referral_referrer_credit, referral_order_percent, first_buyer_min_percent, ambassador_badge_reward" as "*")
        .eq("id", 1)
        .single();
      if (error) {
        console.error("[referral settings] load failed", error);
        throw new Error("Couldn't load invite settings.");
      }
      return data as unknown as ReferralSettings;
    },
  });
}

const inRange = (value: string, max: number) =>
  value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= max;

const digitsOnly = (value: string) => value.replace(/[^\d.]/g, "");

/** Admin: K² invite rewards, first-buyer discount floor and the ambassador badge bonus. */
export function ReferralSettingsCard() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useReferralSettings();
  const { data: stats } = useReferralOverview();
  const [enabled, setEnabled] = useState(true);
  const [referrer, setReferrer] = useState("");
  const [orderPercent, setOrderPercent] = useState("");
  const [firstBuyerMin, setFirstBuyerMin] = useState("");
  const [badgeReward, setBadgeReward] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.referral_enabled);
    setReferrer(String(Number(settings.referral_referrer_credit)));
    setOrderPercent(String(Number(settings.referral_order_percent)));
    setFirstBuyerMin(String(Number(settings.first_buyer_min_percent)));
    setBadgeReward(String(Number(settings.ambassador_badge_reward)));
  }, [settings]);

  const save = async () => {
    if (!inRange(referrer, MAX_REWARD) || !inRange(badgeReward, MAX_REWARD)) {
      toast.error(`Rewards must be between 0 and ${MAX_REWARD.toLocaleString("en-NG")}.`);
      return;
    }
    if (!inRange(orderPercent, MAX_ORDER_PERCENT)) {
      toast.error(`The share of a friend's orders must be between 0% and ${MAX_ORDER_PERCENT}%.`);
      return;
    }
    if (!inRange(firstBuyerMin, MAX_FIRST_BUYER_PERCENT)) {
      toast.error(`The first-buyer minimum must be between 0% and ${MAX_FIRST_BUYER_PERCENT}%.`);
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({
        referral_enabled: enabled,
        referral_referrer_credit: Number(referrer),
        referral_order_percent: Number(orderPercent),
        first_buyer_min_percent: Number(firstBuyerMin),
        ambassador_badge_reward: Number(badgeReward),
      } as never)
      .eq("id", 1);
    setSaving(false);
    if (error) {
      console.error("[referral settings] save failed", error);
      toast.error("Couldn't save invite settings.");
      return;
    }
    toast.success("Invite settings saved");
    queryClient.invalidateQueries({ queryKey: ["referral-settings"] });
    queryClient.invalidateQueries({ queryKey: ["referral"] });
    queryClient.invalidateQueries({ queryKey: ["platform-settings"] });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Gift className="h-4 w-4" />Invites, K² and first-buyer prices</CardTitle>
        <CardDescription>
          Customers earn K² (1 K² = ₦1, spendable on items, never withdrawable) when a friend they invited links a bank account in their own name,
          plus a share of every order that friend completes. K² is paid by Kano Kaftan. First-buyer discounts are paid by the seller.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Invites on</p>
                <p className="text-xs text-muted-foreground">When off, no new invites; K² people already have still works.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Invite programme on" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="ref-referrer">K² per verified friend</Label>
                <Input id="ref-referrer" inputMode="numeric" value={referrer} onChange={(e) => setReferrer(digitsOnly(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-percent">Share of friend's orders (%)</Label>
                <Input id="ref-percent" inputMode="decimal" value={orderPercent} onChange={(e) => setOrderPercent(digitsOnly(e.target.value))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-first-buyer">Minimum first-buyer discount (%)</Label>
                <Input id="ref-first-buyer" inputMode="decimal" value={firstBuyerMin} onChange={(e) => setFirstBuyerMin(digitsOnly(e.target.value))} />
                <p className="text-[11px] text-muted-foreground">Sellers must give at least this on every product they post.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-badge">Ambassador bonus per badge payment (₦)</Label>
                <Input id="ref-badge" inputMode="numeric" value={badgeReward} onChange={(e) => setBadgeReward(digitsOnly(e.target.value))} />
                <p className="text-[11px] text-muted-foreground">Paid each time a seller they brought buys or renews a badge.</p>
              </div>
            </div>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-2 border-t pt-4 text-center sm:grid-cols-4">
            <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{stats.joined}</p><p className="text-[11px] text-muted-foreground">Friends joined</p></div>
            <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{stats.verified_buyers ?? stats.rewarded}</p><p className="text-[11px] text-muted-foreground">Bank-verified buyers</p></div>
            <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{k2(Number(stats.credit_spent))}</p><p className="text-[11px] text-muted-foreground">K² spent</p></div>
            <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{k2(Number(stats.credit_outstanding))}</p><p className="text-[11px] text-muted-foreground">K² unspent ({naira(Number(stats.credit_outstanding))})</p></div>
          </div>
        )}
        {stats && stats.top_referrers.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top inviters</p>
            <ul className="divide-y rounded-xl border text-sm">
              {stats.top_referrers.map((r) => (
                <li key={r.user_id} className="flex items-center justify-between px-3 py-2">
                  <span className="truncate">{r.name}</span>
                  <span className="shrink-0 text-muted-foreground">{r.joined} joined · {r.rewarded} verified</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
