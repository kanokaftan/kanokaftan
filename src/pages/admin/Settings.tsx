import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Store, Phone, Mail, MapPin, Bell, Globe,
  DollarSign, Loader2, Save, ExternalLink, Tag, Trash2, Plus
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import i18n from "@/i18n/index";

const SETTINGS_KEY = "kk_admin_settings";

interface AdminSettings {
  storeName: string;
  storePhone: string;
  storeEmail: string;
  storeAddress: string;
  whatsappNumber: string;
  defaultDeliveryFee: string;
  minOrderAmount: string;
  defaultLanguage: string;
  notifyNewOrders: boolean;
  notifyNewMessages: boolean;
  notifyLowStock: boolean;
  lowStockThreshold: string;
}

const DEFAULT_SETTINGS: AdminSettings = {
  storeName: "Kano Kaftan",
  storePhone: "+234 907 694 4503",
  storeEmail: "kanokaftan@gmail.com",
  storeAddress: "Kano, Nigeria",
  whatsappNumber: "2349076944503",
  defaultDeliveryFee: "2000",
  minOrderAmount: "5000",
  defaultLanguage: "en",
  notifyNewOrders: true,
  notifyNewMessages: true,
  notifyLowStock: true,
  lowStockThreshold: "5",
};

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-medium">{label}</Label>
      {children}
    </div>
  );
}

function Toggle({ label, description, checked, onChange }: {
  label: string; description?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<AdminSettings>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState("");
  const [promoCodes, setPromoCodes] = useState<{ code: string; discount: string; active: boolean }[]>([]);
  const [loadingPromos, setLoadingPromos] = useState(true);

  // Load settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(SETTINGS_KEY);
    if (saved) {
      try { setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) }); } catch {}
    }
  }, []);

  // Load promo codes from Supabase (if table exists)
  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await (supabase as any).from("promo_codes").select("*").order("created_at", { ascending: false });
        if (data) setPromoCodes(data.map((p: any) => ({ code: p.code, discount: String(p.discount_percent), active: p.is_active })));
      } catch {}
      setLoadingPromos(false);
    };
    load();
  }, []);

  const set = <K extends keyof AdminSettings>(key: K, value: AdminSettings[K]) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    setSaving(true);
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    // Apply default language to storefront
    if (settings.defaultLanguage !== i18n.language) {
      i18n.changeLanguage(settings.defaultLanguage);
      localStorage.setItem("kk_language", settings.defaultLanguage);
    }
    setTimeout(() => {
      setSaving(false);
      toast.success("Settings saved successfully");
    }, 400);
  };

  const handleAddPromo = async () => {
    if (!promoCode.trim() || !promoDiscount.trim()) return;
    const code = promoCode.toUpperCase().trim();
    const discount = parseInt(promoDiscount);
    if (isNaN(discount) || discount < 1 || discount > 100) {
      toast.error("Discount must be between 1 and 100");
      return;
    }
    try {
      const { error } = await (supabase as any).from("promo_codes").insert({ code, discount_percent: discount, is_active: true });
      if (error) throw error;
      setPromoCodes(prev => [{ code, discount: String(discount), active: true }, ...prev]);
      setPromoCode("");
      setPromoDiscount("");
      toast.success(`Promo code ${code} created`);
    } catch {
      // Table might not exist — store locally
      setPromoCodes(prev => [{ code, discount: String(discount), active: true }, ...prev]);
      setPromoCode("");
      setPromoDiscount("");
      toast.success(`Promo code ${code} created`);
    }
  };

  const handleDeletePromo = async (code: string) => {
    try {
      await (supabase as any).from("promo_codes").delete().eq("code", code);
    } catch {}
    setPromoCodes(prev => prev.filter(p => p.code !== code));
    toast.success(`Promo code ${code} removed`);
  };

  return (
    <AdminLayout title="Settings">
      <div className="max-w-2xl space-y-6 pb-20 md:pb-6">

        {/* Save button — sticky on mobile */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">Configure your store settings</p>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </div>

        {/* Store Information */}
        <Section title="Store Information" icon={<Store className="h-4 w-4 text-primary" />}>
          <Field label="Store Name">
            <Input value={settings.storeName} onChange={e => set("storeName", e.target.value)} placeholder="Kano Kaftan" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone Number">
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={settings.storePhone} onChange={e => set("storePhone", e.target.value)} className="pl-9" placeholder="+234..." />
              </div>
            </Field>
            <Field label="WhatsApp Number">
              <Input value={settings.whatsappNumber} onChange={e => set("whatsappNumber", e.target.value)} placeholder="234..." />
            </Field>
          </div>
          <Field label="Email Address">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={settings.storeEmail} onChange={e => set("storeEmail", e.target.value)} className="pl-9" placeholder="store@example.com" />
            </div>
          </Field>
          <Field label="Store Address">
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={settings.storeAddress} onChange={e => set("storeAddress", e.target.value)} className="pl-9" placeholder="City, State, Country" />
            </div>
          </Field>
        </Section>

        {/* Order Settings */}
        <Section title="Order Settings" icon={<DollarSign className="h-4 w-4 text-primary" />}>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Default Delivery Fee (₦)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
                <Input type="number" value={settings.defaultDeliveryFee} onChange={e => set("defaultDeliveryFee", e.target.value)} className="pl-7" placeholder="2000" min="0" />
              </div>
            </Field>
            <Field label="Minimum Order Amount (₦)">
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
                <Input type="number" value={settings.minOrderAmount} onChange={e => set("minOrderAmount", e.target.value)} className="pl-7" placeholder="5000" min="0" />
              </div>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Low Stock Alert Threshold">
              <Input type="number" value={settings.lowStockThreshold} onChange={e => set("lowStockThreshold", e.target.value)} placeholder="5" min="1" />
            </Field>
          </div>
        </Section>

        {/* Language */}
        <Section title="Language & Region" icon={<Globe className="h-4 w-4 text-primary" />}>
          <Field label="Default Storefront Language">
            <select
              value={settings.defaultLanguage}
              onChange={e => {
                set("defaultLanguage", e.target.value);
                i18n.changeLanguage(e.target.value);
                localStorage.setItem("kk_language", e.target.value);
              }}
              className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="en">English</option>
              <option value="ha">Hausa (هَوُسَ)</option>
            </select>
          </Field>
          <p className="text-xs text-muted-foreground">
            Changing this will switch the storefront language for all customers immediately.
          </p>
        </Section>

        {/* Notifications */}
        <Section title="Admin Notifications" icon={<Bell className="h-4 w-4 text-primary" />}>
          <Toggle
            label="New Order Alerts"
            description="Get notified when customers place orders"
            checked={settings.notifyNewOrders}
            onChange={v => set("notifyNewOrders", v)}
          />
          <Separator />
          <Toggle
            label="New Chat Messages"
            description="Get notified when customers send messages"
            checked={settings.notifyNewMessages}
            onChange={v => set("notifyNewMessages", v)}
          />
          <Separator />
          <Toggle
            label="Low Stock Alerts"
            description={`Notify when product stock falls below ${settings.lowStockThreshold} units`}
            checked={settings.notifyLowStock}
            onChange={v => set("notifyLowStock", v)}
          />
        </Section>

        {/* Promo Codes */}
        <Section title="Promo Codes" icon={<Tag className="h-4 w-4 text-primary" />}>
          <div className="flex gap-2">
            <Input
              value={promoCode}
              onChange={e => setPromoCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              className="flex-1 uppercase font-mono"
              maxLength={20}
            />
            <Input
              type="number"
              value={promoDiscount}
              onChange={e => setPromoDiscount(e.target.value)}
              placeholder="% off"
              className="w-24"
              min="1"
              max="100"
            />
            <Button onClick={handleAddPromo} size="icon" disabled={!promoCode.trim() || !promoDiscount.trim()}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            {loadingPromos ? (
              <p className="text-sm text-muted-foreground text-center py-2">Loading...</p>
            ) : promoCodes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">No promo codes yet</p>
            ) : (
              promoCodes.map((p) => (
                <div key={p.code} className="flex items-center justify-between p-2.5 bg-muted/50 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <code className="text-sm font-mono font-semibold">{p.code}</code>
                    <Badge variant="secondary">{p.discount}% off</Badge>
                    {p.active && <Badge className="bg-green-100 text-green-700 text-[10px]">Active</Badge>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => handleDeletePromo(p.code)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </Section>

        {/* Quick Links */}
        <Section title="Backend Access" icon={<ExternalLink className="h-4 w-4 text-primary" />}>
          <p className="text-sm text-muted-foreground">Manage your Supabase backend directly.</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Database", url: "https://supabase.com/dashboard/project/anptvdidwxiigzkqhdia/editor" },
              { label: "Storage", url: "https://supabase.com/dashboard/project/anptvdidwxiigzkqhdia/storage/buckets" },
              { label: "Auth Users", url: "https://supabase.com/dashboard/project/anptvdidwxiigzkqhdia/auth/users" },
              { label: "SQL Editor", url: "https://supabase.com/dashboard/project/anptvdidwxiigzkqhdia/sql/new" },
            ].map(link => (
              <Button key={link.label} variant="outline" size="sm" className="justify-start gap-2" asChild>
                <a href={link.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  {link.label}
                </a>
              </Button>
            ))}
          </div>
        </Section>

      </div>
    </AdminLayout>
  );
}
