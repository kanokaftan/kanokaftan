import { useState } from "react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { PayoutSettingsCard } from "@/components/admin/PayoutSettingsCard";
import { ActivePromotionsCard, MonetisationSettingsCard } from "@/components/admin/MonetisationSettingsCard";
import { ReferralSettingsCard } from "@/components/admin/ReferralSettingsCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Globe, ExternalLink, Tag, Trash2, Plus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID as string | undefined;

function Section({ title, description, icon, children }: {
  title: string; description?: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          {icon}
          {title}
        </CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** Shipping promo codes, stored in public.shipping_promo_codes and applied server-side by place_order. */
function PromoCodesCard() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"free" | "percentage">("percentage");
  const [discount, setDiscount] = useState("");
  const [expiresAt, setExpiresAt] = useState("");

  const promosQuery = useQuery({
    queryKey: ["admin-promo-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shipping_promo_codes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["admin-promo-codes"] });

  const addPromo = useMutation({
    mutationFn: async () => {
      const normalized = code.toUpperCase().trim();
      const value = discountType === "free" ? 100 : parseInt(discount, 10);
      if (!normalized) throw new Error("Enter a code");
      if (isNaN(value) || value < 1 || value > 100) throw new Error("Discount must be between 1 and 100");
      const { error } = await supabase.from("shipping_promo_codes").insert({
        code: normalized,
        discount_type: discountType,
        discount_value: value,
        is_active: true,
        expires_at: expiresAt ? new Date(`${expiresAt}T23:59:59`).toISOString() : null,
      });
      if (error) throw error;
      return normalized;
    },
    onSuccess: (normalized) => {
      setCode("");
      setDiscount("");
      setExpiresAt("");
      toast.success(`Promo code ${normalized} created`);
      invalidate();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Could not create promo code"),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("shipping_promo_codes").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error("Could not update promo code"),
  });

  const deletePromo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shipping_promo_codes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Promo code removed");
      invalidate();
    },
    onError: () => toast.error("Could not remove promo code"),
  });

  const promos = promosQuery.data || [];

  return (
    <Section
      title="Shipping Promo Codes"
      description="Discounts on the delivery fee, applied at checkout."
      icon={<Tag className="h-4 w-4 text-primary" />}
    >
      <div className="grid grid-cols-2 gap-2">
        <Input
          value={code}
          onChange={e => setCode(e.target.value.toUpperCase())}
          placeholder="CODE"
          className="col-span-2 uppercase font-mono"
          maxLength={20}
        />
        <Select value={discountType} onValueChange={(v) => setDiscountType(v as "free" | "percentage")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="percentage">% off delivery</SelectItem>
            <SelectItem value="free">Free delivery</SelectItem>
          </SelectContent>
        </Select>
        <Input
          type="number"
          value={discountType === "free" ? "100" : discount}
          onChange={e => setDiscount(e.target.value)}
          placeholder="% off"
          min="1"
          max="100"
          disabled={discountType === "free"}
        />
        <div className="col-span-2 flex gap-2">
          <div className="flex-1 space-y-1">
            <Label className="text-xs text-muted-foreground">Expires (optional)</Label>
            <Input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
          </div>
          <Button
            onClick={() => addPromo.mutate()}
            className="self-end gap-1"
            disabled={addPromo.isPending || !code.trim() || (discountType === "percentage" && !discount.trim())}
          >
            {addPromo.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {promosQuery.isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-2">Loading...</p>
        ) : promos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">No promo codes yet</p>
        ) : (
          promos.map((p) => {
            const expired = p.expires_at ? new Date(p.expires_at) < new Date() : false;
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 p-2.5 bg-muted/50 rounded-lg border">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <code className="text-sm font-mono font-semibold">{p.code}</code>
                  <Badge variant="secondary">
                    {p.discount_type === "free" ? "Free delivery" : `${p.discount_value}% off`}
                  </Badge>
                  {expired ? (
                    <Badge variant="outline" className="text-[10px]">Expired</Badge>
                  ) : p.expires_at ? (
                    <span className="text-[11px] text-muted-foreground">until {format(new Date(p.expires_at), "MMM d, yyyy")}</span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Switch
                    checked={!!p.is_active}
                    onCheckedChange={(v) => toggleActive.mutate({ id: p.id, is_active: v })}
                    aria-label="Active"
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => deletePromo.mutate(p.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Section>
  );
}

export default function AdminSettings() {
  const { i18n } = useTranslation();

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
    try {
      localStorage.setItem("kk_language", lang);
    } catch {
      // storage unavailable; language still applies for this session
    }
  };

  const backendLinks = PROJECT_ID
    ? [
        { label: "Database", url: `https://supabase.com/dashboard/project/${PROJECT_ID}/editor` },
        { label: "Storage", url: `https://supabase.com/dashboard/project/${PROJECT_ID}/storage/buckets` },
        { label: "Auth Users", url: `https://supabase.com/dashboard/project/${PROJECT_ID}/auth/users` },
        { label: "Edge Functions", url: `https://supabase.com/dashboard/project/${PROJECT_ID}/functions` },
      ]
    : [];

  return (
    <AdminLayout title="Settings">
      <div className="grid gap-6 md:grid-cols-2 pb-20 md:pb-6">
        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between md:col-span-2">
          <div>
            <p className="font-semibold">Appearance</p>
            <p className="text-sm text-muted-foreground">System follows this device's light or dark setting.</p>
          </div>
          <ThemeToggle />
        </div>

        <PayoutSettingsCard />
        <ReferralSettingsCard />

        <MonetisationSettingsCard />

        <ActivePromotionsCard />

        <PromoCodesCard />

        <Section
          title="Language"
          description="Display language for this device."
          icon={<Globe className="h-4 w-4 text-primary" />}
        >
          <Select value={i18n.language?.startsWith("ha") ? "ha" : "en"} onValueChange={changeLanguage}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="en">English</SelectItem>
              <SelectItem value="ha">Hausa</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Customers choose their own language from the storefront; this only changes it on this device.
          </p>
        </Section>

        {backendLinks.length > 0 && (
          <Section
            title="Backend Access"
            description="Manage the Supabase backend directly."
            icon={<ExternalLink className="h-4 w-4 text-primary" />}
          >
            <div className="grid grid-cols-2 gap-2">
              {backendLinks.map(link => (
                <Button key={link.label} variant="outline" size="sm" className="justify-start gap-2" asChild>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-3.5 w-3.5" />
                    {link.label}
                  </a>
                </Button>
              ))}
            </div>
          </Section>
        )}
      </div>
    </AdminLayout>
  );
}
