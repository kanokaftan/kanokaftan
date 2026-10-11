import { useEffect, useState } from "react";
import { BellRing, Loader2, Megaphone, Package } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { AdminAlertSettings } from "@/components/notifications/AdminAlertSettings";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

type PrefKey = "notification_push" | "notification_orders" | "notification_promotions";
type Prefs = Record<PrefKey, boolean>;

/** Same defaults as the Settings page. */
const DEFAULT_PREFS: Prefs = { notification_push: true, notification_orders: true, notification_promotions: false };

const OPTIONS: { key: PrefKey; icon: typeof BellRing; title: string; description: string }[] = [
  {
    key: "notification_push",
    icon: BellRing,
    title: "Phone notifications",
    description: "Alerts on your lock screen. Messages and calls always come through when this is on.",
  },
  { key: "notification_orders", icon: Package, title: "Orders & payments", description: "Payment received, shipped, delivered." },
  {
    key: "notification_promotions",
    icon: Megaphone,
    title: "Offers & stories",
    description: "Sales, new products and stories from shops you follow.",
  },
];

/** Quick notification choices, saved the moment a switch is flipped. */
export function NotificationSettingsSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { user, isAdmin } = useAuth();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<PrefKey | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("profiles")
      .select("notification_push, notification_orders, notification_promotions")
      .eq("id", user.id)
      .single()
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          console.error("[NotificationSettings] could not load preferences", error);
          toast.error("Could not load your notification settings");
          return;
        }
        setPrefs({
          notification_push: data.notification_push ?? DEFAULT_PREFS.notification_push,
          notification_orders: data.notification_orders ?? DEFAULT_PREFS.notification_orders,
          notification_promotions: data.notification_promotions ?? DEFAULT_PREFS.notification_promotions,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const toggle = async (key: PrefKey, value: boolean) => {
    if (!user) return;
    const previous = prefs[key];
    setPrefs((p) => ({ ...p, [key]: value }));
    setSaving(key);
    const { error } = await supabase.from("profiles").update({ [key]: value }).eq("id", user.id);
    setSaving(null);
    if (error) {
      console.error("[NotificationSettings] could not save", { key, error });
      setPrefs((p) => ({ ...p, [key]: previous }));
      toast.error("Could not save. Please try again.");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="max-h-[90dvh] overflow-y-auto rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>Notification settings</SheetTitle>
          <SheetDescription>Choose what we tell you about. Changes save straight away.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {OPTIONS.map(({ key, icon: Icon, title, description }) => {
            const disabled = loading || (key !== "notification_push" && !prefs.notification_push);
            return (
              <div key={key} className="group flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-3 border-b border-border/60 py-3.5 group-last:border-b-0">
                  <Label htmlFor={`pref-${key}`} className={`min-w-0 flex-1 cursor-pointer ${disabled ? "opacity-50" : ""}`}>
                    <span className="block text-sm font-medium">{title}</span>
                    <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{description}</span>
                  </Label>
                  {saving === key ? (
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                  ) : (
                    <Switch id={`pref-${key}`} checked={prefs[key]} disabled={disabled} onCheckedChange={(v) => toggle(key, v)} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {isAdmin && <AdminAlertSettings open={open} />}
      </SheetContent>
    </Sheet>
  );
}
