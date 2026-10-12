import { useState, useEffect } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Bell, Globe, Trash2, ChevronRight, Loader2, Palette, Smartphone, Volume2 } from "lucide-react";
import { setSoundsEnabled, soundsEnabled } from "@/lib/callTones";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { PhoneNotificationsCard } from "@/components/notifications/PhoneNotificationsCard";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import { currentLanguage, setLanguage as saveLanguage } from "@/i18n/language";

function applyLanguage(value: string) {
  saveLanguage(value === "ha" ? "ha" : "en");
}

interface SettingItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}

function SettingItem({ icon, label, description, children, className }: SettingItemProps) {
  return (
    <div className={cn("flex items-center justify-between gap-4 py-4", className)}>
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex-shrink-0 h-10 w-10 rounded-full bg-muted flex items-center justify-center">
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <Label className="text-sm font-medium">{label}</Label>
          {description && (
            <p className="text-xs text-muted-foreground truncate">{description}</p>
          )}
        </div>
      </div>
      <div className="flex-shrink-0">{children}</div>
    </div>
  );
}

function SettingSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-card rounded-xl border overflow-hidden">
      <div className="px-4 py-3 bg-muted/50 border-b">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      <div className="px-4 divide-y">{children}</div>
    </div>
  );
}

const LANGUAGES = [
  { value: "en", label: "English" },
  { value: "ha", label: "Hausa" },
];

const CURRENCIES = [
  { value: "NGN", label: "₦ Naira" },
  { value: "USD", label: "$ Dollar" },
];

export default function Settings() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [notifications, setNotifications] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [language, setLanguage] = useState<string>(() => currentLanguage());
  const [currency, setCurrency] = useState("NGN");
  // Stored on this device only, so it applies straight away (no Save needed).
  const [sounds, setSounds] = useState(soundsEnabled);

  const { clearAll, unreadCount } = useNotifications();
  const { toast } = useToast();

  // Load preferences from the profile
  useEffect(() => {
    const loadPreferences = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("notification_push, notification_orders, notification_promotions, preferred_language, preferred_currency")
        .eq("id", user.id)
        .single();

      if (!error && data) {
        setNotifications(data.notification_push ?? true);
        setOrderUpdates(data.notification_orders ?? true);
        setPromotions(data.notification_promotions ?? false);
        setCurrency(data.preferred_currency ?? "NGN");
        const lang = data.preferred_language;
        if (lang && LANGUAGES.some((l) => l.value === lang)) {
          setLanguage(lang);
          applyLanguage(lang);
        }
      }
      setIsLoading(false);
    };

    loadPreferences();
  }, [user]);

  const handleChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    setter(value);
    setHasChanges(true);
  };

  // Language applies immediately (and is remembered on this device);
  // signed-in users also get it saved to their profile on Save.
  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    applyLanguage(value);
    if (user) setHasChanges(true);
  };

  const handleSave = async () => {
    if (!user) {
      toast({
        title: t("settings.signInRequired"),
        description: t("settings.signInToSync"),
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        notification_push: notifications,
        notification_orders: orderUpdates,
        notification_promotions: promotions,
        preferred_language: language,
        preferred_currency: currency,
      })
      .eq("id", user.id);
    setIsSaving(false);

    if (error) {
      toast({ title: t("settings.saveFailed"), variant: "destructive" });
    } else {
      setHasChanges(false);
      toast({ title: t("settings.saved") });
    }
  };

  const handleClearNotifications = () => {
    clearAll.mutate(undefined, {
      onSuccess: () => toast({ title: t("settings.notificationsCleared") }),
    });
  };

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="px-4 py-6 pb-32 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t("settings.title")}</h1>
          {hasChanges && (
            <Button onClick={handleSave} disabled={isSaving || !user} size="sm">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("settings.saveChanges")}
            </Button>
          )}
        </div>

        {!user && (
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">{t("settings.signInToSync")}</p>
          </div>
        )}

        <SettingSection title={t("settings.notifications")}>
          <PhoneNotificationsCard onEnabled={() => { setNotifications(true); setOrderUpdates(true); setPromotions(true); }} />

          <SettingItem
            icon={<Bell className="h-5 w-5 text-muted-foreground" />}
            label={t("settings.pushNotifications")}
            description={t("settings.pushNotificationsDesc")}
          >
            <Switch checked={notifications} onCheckedChange={(v) => handleChange(setNotifications, v)} />
          </SettingItem>

          <SettingItem
            icon={<Smartphone className="h-5 w-5 text-muted-foreground" />}
            label={t("settings.orderUpdates")}
            description={t("settings.orderUpdatesDesc")}
          >
            <Switch checked={orderUpdates} onCheckedChange={(v) => handleChange(setOrderUpdates, v)} disabled={!notifications} />
          </SettingItem>

          <SettingItem
            icon={<Bell className="h-5 w-5 text-muted-foreground" />}
            label={t("settings.promotions")}
            description={t("settings.promotionsDesc")}
          >
            <Switch checked={promotions} onCheckedChange={(v) => handleChange(setPromotions, v)} disabled={!notifications} />
          </SettingItem>

          <SettingItem
            icon={<Volume2 className="h-5 w-5 text-muted-foreground" />}
            label={t("settings.sounds", "Sounds")}
            description={t("settings.soundsDesc", "Message, reaction and call sounds")}
          >
            <Switch
              checked={sounds}
              onCheckedChange={(v) => {
                setSounds(v);
                setSoundsEnabled(v);
              }}
            />
          </SettingItem>

          <SettingItem
            icon={<Trash2 className="h-5 w-5 text-muted-foreground" />}
            label={t("settings.clearNotifications")}
            description={unreadCount > 0 ? t("settings.unread", { count: unreadCount }) : t("settings.noUnread")}
          >
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearNotifications}
              disabled={clearAll.isPending || unreadCount === 0}
              className="text-destructive hover:text-destructive"
            >
              {t("settings.clear")}
            </Button>
          </SettingItem>
        </SettingSection>

        <SettingSection title="Appearance">
          <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Palette className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">Theme</p>
                <p className="text-sm text-muted-foreground">System follows your phone's light or dark setting</p>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </SettingSection>

        <SettingSection title={t("settings.languageRegion")}>
          <SettingItem
            icon={<Globe className="h-5 w-5 text-muted-foreground" />}
            label={t("settings.language")}
            description={t("settings.languageDesc")}
          >
            <div className="relative">
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                className="appearance-none bg-muted rounded-lg px-3 py-2 pr-8 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>{lang.label}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rotate-90 pointer-events-none" />
            </div>
          </SettingItem>

          <SettingItem
            icon={<span className="text-lg">₦</span>}
            label={t("settings.currency")}
            description={t("settings.currencyDesc")}
          >
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => handleChange(setCurrency, e.target.value)}
                className="appearance-none bg-muted rounded-lg px-3 py-2 pr-8 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr.value} value={curr.value}>{curr.label}</option>
                ))}
              </select>
              <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rotate-90 pointer-events-none" />
            </div>
          </SettingItem>
        </SettingSection>

        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">Kano Kaftan v1.0.0</p>
        </div>
      </div>
    </MobileLayout>
  );
}
