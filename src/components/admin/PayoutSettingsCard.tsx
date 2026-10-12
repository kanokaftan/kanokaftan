import { useEffect, useState } from "react";
import { Percent } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePlatformSettings } from "@/hooks/usePayouts";
import { toast } from "sonner";

export function PayoutSettingsCard() {
  const { settings, updateSettings } = usePlatformSettings();
  const [commission, setCommission] = useState("");
  const [checkoutCommission, setCheckoutCommission] = useState("");
  const [releaseDays, setReleaseDays] = useState("");

  useEffect(() => {
    if (settings) {
      setCommission(String(settings.commission_percent));
      setCheckoutCommission(String(settings.checkout_commission_percent ?? 0));
      setReleaseDays(String(settings.auto_release_days));
    }
  }, [settings]);

  const commissionValue = Number(commission);
  const checkoutValue = Number(checkoutCommission);
  const percentOk = (raw: string, value: number) => raw !== "" && value >= 0 && value <= 100;
  const daysValue = Number(releaseDays);
  const valid =
    percentOk(commission, commissionValue) && percentOk(checkoutCommission, checkoutValue) &&
    Number.isInteger(daysValue) && daysValue >= 1 && daysValue <= 60;

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        commission_percent: commissionValue,
        checkout_commission_percent: checkoutValue,
        auto_release_days: daysValue,
      });
      toast.success("Payout settings saved. They apply to new orders.");
    } catch (error: unknown) {
      console.error("[PayoutSettingsCard] save failed", error);
      toast.error(error instanceof Error ? error.message : "Could not save settings");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Percent className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Commission & payouts</CardTitle>
        </div>
        <CardDescription>
          Your cut of each sale by how it was made (delivery fees always stay with Kano Kaftan), and how long after
          shipping the vendor's second half is released if the customer doesn't confirm.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="checkout-commission">App checkout orders (%)</Label>
            <Input id="checkout-commission" type="number" min={0} max={100} step="0.5" value={checkoutCommission} onChange={(e) => setCheckoutCommission(e.target.value)} />
            <p className="text-xs text-muted-foreground">Customer pays in the app. 0 = seller gets full price.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="commission">Orders through our chat (%)</Label>
            <Input id="commission" type="number" min={0} max={100} step="0.5" value={commission} onChange={(e) => setCommission(e.target.value)} />
            <p className="text-xs text-muted-foreground">Orders you create for customers in chat.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="release-days">Auto-release (days)</Label>
            <Input id="release-days" type="number" min={1} max={60} value={releaseDays} onChange={(e) => setReleaseDays(e.target.value)} />
          </div>
        </div>
        <Button onClick={handleSave} disabled={!valid || updateSettings.isPending}>
          Save
        </Button>
      </CardContent>
    </Card>
  );
}
