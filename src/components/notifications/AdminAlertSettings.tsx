import { useEffect, useState } from "react";
import { BarChart3, Loader2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

type VisitFrequency = "off" | "15min" | "hourly";
interface AlertSettings {
  signups: boolean;
  visits: VisitFrequency;
  daily_report: boolean;
}

/** Same defaults as the database: everything on, visitor summaries every 15 minutes. */
const DEFAULTS: AlertSettings = { signups: true, visits: "15min", daily_report: true };

const VISIT_OPTIONS: { value: VisitFrequency; label: string }[] = [
  { value: "15min", label: "15 min" },
  { value: "hourly", label: "Hourly" },
  { value: "off", label: "Off" },
];

/** Admin-only alert choices, shown inside the notification settings sheet. */
export function AdminAlertSettings({ open }: { open: boolean }) {
  const { user } = useAuth();
  const [settings, setSettings] = useState<AlertSettings>(DEFAULTS);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<keyof AlertSettings | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    setLoading(true);
    supabase
      .from("admin_alert_settings")
      .select("signups, visits, daily_report")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoading(false);
        if (error) {
          console.error("[AdminAlertSettings] could not load", error);
          toast.error("Could not load your admin alert settings");
          return;
        }
        if (data) setSettings({ signups: data.signups, visits: data.visits as VisitFrequency, daily_report: data.daily_report });
      });
    return () => {
      cancelled = true;
    };
  }, [open, user]);

  const save = async <K extends keyof AlertSettings>(key: K, value: AlertSettings[K]) => {
    if (!user) return;
    const previous = settings;
    const next = { ...settings, [key]: value };
    setSettings(next);
    setSaving(key);
    const { error } = await supabase.from("admin_alert_settings").upsert({ user_id: user.id, ...next }, { onConflict: "user_id" });
    setSaving(null);
    if (error) {
      console.error("[AdminAlertSettings] could not save", { key, error });
      setSettings(previous);
      toast.error("Could not save. Please try again.");
    }
  };

  const row = (icon: typeof UserPlus, title: string, description: string, control: React.ReactNode, id?: string) => {
    const Icon = icon;
    return (
      <div className="group flex items-center gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="flex min-w-0 flex-1 items-center gap-3 border-b border-border/60 py-3.5 group-last:border-b-0">
          <Label htmlFor={id} className={`min-w-0 flex-1 ${loading ? "opacity-50" : ""}`}>
            <span className="block text-sm font-medium">{title}</span>
            <span className="mt-0.5 block text-xs font-normal text-muted-foreground">{description}</span>
          </Label>
          {control}
        </div>
      </div>
    );
  };

  const switchFor = (key: "signups" | "daily_report") =>
    saving === key ? (
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    ) : (
      <Switch id={`admin-alert-${key}`} checked={settings[key]} disabled={loading} onCheckedChange={(v) => save(key, v)} />
    );

  return (
    <div className="mt-5">
      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Admin alerts</p>
      {row(UserPlus, "New sign-ups", "Straight away, with their name and email.", switchFor("signups"), "admin-alert-signups")}
      <div className="group flex items-start gap-3">
        <span className="mt-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Users className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1 border-b border-border/60 py-3.5">
          <span className="block text-sm font-medium">Who opened the site</span>
          <span className="mt-0.5 block text-xs text-muted-foreground">
            How many people came, their devices, where from, and the most viewed page and shop.
          </span>
          <ToggleGroup
            type="single"
            value={settings.visits}
            onValueChange={(v) => v && save("visits", v as VisitFrequency)}
            className="mt-2 justify-start"
            disabled={loading || saving === "visits"}
            aria-label="How often to summarise visitors"
          >
            {VISIT_OPTIONS.map((o) => (
              <ToggleGroupItem key={o.value} value={o.value} size="sm" variant="outline" className="h-8 rounded-full px-3 text-xs">
                {o.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </div>
      {row(BarChart3, "Nightly report at 9pm", "Visitors, devices, top page and shop, sign-ups and sales for the day.", switchFor("daily_report"), "admin-alert-daily_report")}
    </div>
  );
}
