import { useState, useEffect } from "react";
import { Bell, Globe, Trash2, ChevronRight, Loader2, Smartphone } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n/index";

const SETTINGS_KEY = "kk_user_settings";

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

function loadSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export default function Settings() {
  const { t } = useTranslation();
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [notifications, setNotifications] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [language, setLanguage] = useState(() => localStorage.getItem("kk_language") || "en");
  const [currency, setCurrency] = useState("NGN");

  const { clearAll, unreadCount } = useNotifications();
  const { toast } = useToast();

  useEffect(() => {
    const saved = loadSettings();
    if (saved) {
      if (saved.notifications !== undefined) setNotifications(saved.notifications);
      if (saved.orderUpdates !== undefined) setOrderUpdates(saved.orderUpdates);
      if (saved.promotions !== undefined) setPromotions(saved.promotions);
      if (saved.currency) setCurrency(saved.currency);
    }
    const savedLang = localStorage.getItem("kk_language") || "en";
    setLanguage(savedLang);
  }, []);

  const handleChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    setter(value);
    setHasChanges(true);
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    setHasChanges(true);
    i18n.changeLanguage(value);
    localStorage.setItem("kk_language", value);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({
        notifications,
        orderUpdates,
        promotions,
        currency,
      }));
      setHasChanges(false);
      toast({ title: t("settings.saved") });
    } catch {
      toast({ title: "Failed to save", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleClearNotifications = () => {
    clearAll.mutate(undefined, {
      onSuccess: () => toast({ title: "Notifications cleared" }),
    });
  };

  return (
    <MobileLayout>
      <div className="px-4 py-6 pb-32 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">{t("settings.title")}</h1>
          {hasChanges && (
            <Button onClick={handleSave} disabled={isSaving} size="sm">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("settings.saveChanges")}
            </Button>
          )}
        </div>

        <SettingSection title={t("settings.notifications")}>
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
            icon={<Trash2 className="h-5 w-5 text-muted-foreground" />}
            label={t("settings.clearNotifications")}
            description={unreadCount > 0 ? `${unreadCount} ${t("settings.unread_other", { count: unreadCount })}` : t("settings.noUnread")}
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
