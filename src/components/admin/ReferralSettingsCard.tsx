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
import { naira } from "@/lib/naira";

const MAX_CREDIT = 100_000;

interface ReferralSettings {
  referral_enabled: boolean;
  referral_friend_credit: number;
  referral_referrer_credit: number;
  referral_min_order: number;
}

function useReferralSettings() {
  return useQuery({
    queryKey: ["referral-settings"],
    queryFn: async (): Promise<ReferralSettings> => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("referral_enabled, referral_friend_credit, referral_referrer_credit, referral_min_order" as "*")
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

const validAmount = (value: string) => value.trim() !== "" && Number.isFinite(Number(value)) && Number(value) >= 0 && Number(value) <= MAX_CREDIT;

/** Admin: customer "Invite friends" rewards and how the programme is doing. */
export function ReferralSettingsCard() {
  const queryClient = useQueryClient();
  const { data: settings, isLoading } = useReferralSettings();
  const { data: stats } = useReferralOverview();
  const [enabled, setEnabled] = useState(true);
  const [friend, setFriend] = useState("");
  const [referrer, setReferrer] = useState("");
  const [minOrder, setMinOrder] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setEnabled(settings.referral_enabled);
    setFriend(String(Number(settings.referral_friend_credit)));
    setReferrer(String(Number(settings.referral_referrer_credit)));
    setMinOrder(String(Number(settings.referral_min_order)));
  }, [settings]);

  const save = async () => {
    if (![friend, referrer, minOrder].every(validAmount)) {
      toast.error(`Amounts must be between ₦0 and ${naira(MAX_CREDIT)}.`);
      return;
    }
    if (Number(friend) > Number(minOrder) && Number(minOrder) > 0) {
      toast.error("The friend's credit can't be more than the minimum order.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("platform_settings")
      .update({
        referral_enabled: enabled,
        referral_friend_credit: Number(friend),
        referral_referrer_credit: Number(referrer),
        referral_min_order: Number(minOrder),
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
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><Gift className="h-4 w-4" />Invite friends (customers)</CardTitle>
        <CardDescription>
          Customers share a link. The friend gets credit on their first order; the customer who invited them gets credit once that order is completed.
          Credit is paid by Kano Kaftan: sellers are always paid in full.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-40" />
        ) : (
          <>
            <div className="flex items-center justify-between rounded-xl border p-3">
              <div>
                <p className="text-sm font-medium">Programme on</p>
                <p className="text-xs text-muted-foreground">When off, no new invites; credit people already have still works.</p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} aria-label="Invite programme on" />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="ref-friend">Friend gets (₦)</Label>
                <Input id="ref-friend" inputMode="numeric" value={friend} onChange={(e) => setFriend(e.target.value.replace(/[^\d]/g, ""))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-referrer">Inviter gets (₦)</Label>
                <Input id="ref-referrer" inputMode="numeric" value={referrer} onChange={(e) => setReferrer(e.target.value.replace(/[^\d]/g, ""))} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ref-min">Minimum order (₦)</Label>
                <Input id="ref-min" inputMode="numeric" value={minOrder} onChange={(e) => setMinOrder(e.target.value.replace(/[^\d]/g, ""))} />
              </div>
            </div>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button>
          </>
        )}

        {stats && (
          <div className="grid grid-cols-2 gap-2 border-t pt-4 text-center sm:grid-cols-4">
            <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{stats.joined}</p><p className="text-[11px] text-muted-foreground">Friends joined</p></div>
            <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{stats.rewarded}</p><p className="text-[11px] text-muted-foreground">First orders done</p></div>
            <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{naira(Number(stats.credit_spent))}</p><p className="text-[11px] text-muted-foreground">Credit used</p></div>
            <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{naira(Number(stats.credit_outstanding))}</p><p className="text-[11px] text-muted-foreground">Credit unspent</p></div>
          </div>
        )}
        {stats && stats.top_referrers.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Top inviters</p>
            <ul className="divide-y rounded-xl border text-sm">
              {stats.top_referrers.map((r) => (
                <li key={r.user_id} className="flex items-center justify-between px-3 py-2">
                  <span className="truncate">{r.name}</span>
                  <span className="shrink-0 text-muted-foreground">{r.joined} joined · {r.rewarded} ordered</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
