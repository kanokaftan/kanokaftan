import { useState, useEffect } from "react";
import { Bell, Globe, Trash2, ChevronRight, Loader2, Moon, Sun, Smartphone } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

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

interface SettingSectionProps {
  title: string;
  children: React.ReactNode;
}

function SettingSection({ title, children }: SettingSectionProps) {
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
  { value: "yo", label: "Yoruba" },
  { value: "ig", label: "Igbo" },
];

const CURRENCIES = [
  { value: "NGN", label: "₦ Naira" },
  { value: "USD", label: "$ Dollar" },
];

export default function Settings() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  
  // Settings state
  const [notifications, setNotifications] = useState(true);
  const [orderUpdates, setOrderUpdates] = useState(true);
  const [promotions, setPromotions] = useState(false);
  const [language, setLanguage] = useState("en");
  const [currency, setCurrency] = useState("NGN");
  
  const { clearAll, unreadCount } = useNotifications();
  const { toast } = useToast();

  // Load preferences from database
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
        setLanguage(data.preferred_language ?? "en");
        setCurrency(data.preferred_currency ?? "NGN");
      }
      setIsLoading(false);
    };

    loadPreferences();
  }, [user]);

  const handleChange = <T,>(setter: React.Dispatch<React.SetStateAction<T>>, value: T) => {
    setter(value);
    setHasChanges(true);
  };

  const handleSavePreferences = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to save your preferences.",
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
      toast({
        title: "Failed to save",
        description: "Could not save your preferences. Please try again.",
        variant: "destructive",
      });
    } else {
      setHasChanges(false);
      toast({
        title: "Preferences saved",
        description: "Your settings have been updated.",
      });
    }
  };

  const handleClearNotifications = () => {
    clearAll.mutate(undefined, {
      onSuccess: () => {
        toast({
          title: "Notifications cleared",
          description: "All notifications have been removed.",
        });
      },
    });
  };

  const getLanguageLabel = () => LANGUAGES.find(l => l.value === language)?.label || "English";
  const getCurrencyLabel = () => CURRENCIES.find(c => c.value === currency)?.label || "₦ Naira";

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Settings</h1>
            <p className="text-sm text-muted-foreground">Manage your preferences</p>
          </div>
          {hasChanges && (
            <Button 
              onClick={handleSavePreferences} 
              disabled={isSaving || !user}
              size="sm"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save"
              )}
            </Button>
          )}
        </div>

        {!user && (
          <div className="bg-muted/50 rounded-xl p-4 text-center">
            <p className="text-sm text-muted-foreground">
              Sign in to save your preferences across devices
            </p>
          </div>
        )}

        {/* Notifications Section */}
        <SettingSection title="Notifications">
          <SettingItem
            icon={<Bell className="h-5 w-5 text-muted-foreground" />}
            label="Push Notifications"
            description="Receive in-app alerts"
          >
            <Switch
              checked={notifications}
              onCheckedChange={(v) => handleChange(setNotifications, v)}
            />
          </SettingItem>

          <SettingItem
            icon={<Smartphone className="h-5 w-5 text-muted-foreground" />}
            label="Order Updates"
            description="Shipping & delivery alerts"
          >
            <Switch
              checked={orderUpdates}
              onCheckedChange={(v) => handleChange(setOrderUpdates, v)}
              disabled={!notifications}
            />
          </SettingItem>

          <SettingItem
            icon={<Bell className="h-5 w-5 text-muted-foreground" />}
            label="Promotions"
            description="Deals & special offers"
          >
            <Switch
              checked={promotions}
              onCheckedChange={(v) => handleChange(setPromotions, v)}
              disabled={!notifications}
            />
          </SettingItem>

          <SettingItem
            icon={<Trash2 className="h-5 w-5 text-muted-foreground" />}
            label="Clear Notifications"
            description={unreadCount > 0 ? `${unreadCount} unread` : "No unread"}
          >
            <Button 
              variant="ghost" 
              size="sm"
              onClick={handleClearNotifications}
              disabled={clearAll.isPending || unreadCount === 0}
              className="text-destructive hover:text-destructive"
            >
              Clear
            </Button>
          </SettingItem>
        </SettingSection>

        {/* Language & Region Section */}
        <SettingSection title="Language & Region">
          <SettingItem
            icon={<Globe className="h-5 w-5 text-muted-foreground" />}
            label="Language"
            description="App display language"
          >
            <div className="relative">
              <select
                value={language}
                onChange={(e) => handleChange(setLanguage, e.target.value)}
                className="appearance-none bg-muted rounded-lg px-3 py-2 pr-8 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.value} value={lang.value}>
                    {lang.label}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rotate-90 pointer-events-none" />
            </div>
          </SettingItem>

          <SettingItem
            icon={<span className="text-lg">₦</span>}
            label="Currency"
            description="Price display format"
          >
            <div className="relative">
              <select
                value={currency}
                onChange={(e) => handleChange(setCurrency, e.target.value)}
                className="appearance-none bg-muted rounded-lg px-3 py-2 pr-8 text-sm font-medium cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {CURRENCIES.map((curr) => (
                  <option key={curr.value} value={curr.value}>
                    {curr.label}
                  </option>
                ))}
              </select>
              <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground rotate-90 pointer-events-none" />
            </div>
          </SettingItem>
        </SettingSection>

        {/* App Info */}
        <div className="text-center pt-4">
          <p className="text-xs text-muted-foreground">
            Kano Kaftan v1.0.0
          </p>
        </div>
      </div>
    </MobileLayout>
  );
}
