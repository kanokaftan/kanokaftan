import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MapPin, MessageCircle, Phone, Plus, Star, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  KANO_LGAS, useLogisticsCompanies, useLogisticsOverview, useSaveLogisticsCompany, whatsappNumber,
  type LogisticsCompany, type LogisticsCompanyInput,
} from "@/hooks/useLogistics";
import { cn } from "@/lib/utils";
import { BrandIcon } from "@/components/brand/BrandIcon";

const DEFAULT_PRIORITY = 100;
const EMPTY: LogisticsCompanyInput = {
  name: "", contact_name: "", phone: "", whatsapp: "", email: "", areas: [], is_default: false, is_active: true,
  priority: DEFAULT_PRIORITY, notes: "",
};

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : (error as { message?: string })?.message;
  return message || "Could not save. Please try again.";
}

/** Add / edit a delivery company and the areas it covers. */
function CompanySheet({ company, open, onClose }: { company: LogisticsCompany | null; open: boolean; onClose: () => void }) {
  const save = useSaveLogisticsCompany();
  const [form, setForm] = useState<LogisticsCompanyInput>(EMPTY);
  const [customArea, setCustomArea] = useState("");

  useEffect(() => {
    if (open) setForm(company ? { ...company } : EMPTY);
    setCustomArea("");
  }, [open, company]);

  const areas = form.areas ?? [];
  const has = (area: string) => areas.some((a) => a.toLowerCase() === area.toLowerCase());
  const toggleArea = (area: string) =>
    setForm((f) => ({ ...f, areas: has(area) ? (f.areas ?? []).filter((a) => a.toLowerCase() !== area.toLowerCase()) : [...(f.areas ?? []), area] }));
  const addCustom = () => {
    const parts = customArea.split(",").map((a) => a.trim()).filter(Boolean).filter((a) => !has(a));
    if (parts.length) setForm((f) => ({ ...f, areas: [...(f.areas ?? []), ...parts] }));
    setCustomArea("");
  };
  const customAreas = areas.filter((a) => !KANO_LGAS.some((l) => l.toLowerCase() === a.toLowerCase()));
  const set = <K extends keyof LogisticsCompanyInput>(key: K, value: LogisticsCompanyInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (!form.name.trim()) {
      toast.error("Enter the company name");
      return;
    }
    if (!areas.length && !form.is_default) {
      toast.error("Pick at least one area, or make this the default company");
      return;
    }
    try {
      await save.mutateAsync({ ...form, priority: Number(form.priority) || DEFAULT_PRIORITY });
      toast.success(company ? "Company updated" : "Company added");
      onClose();
    } catch (error) {
      console.error("[AdminLogistics] save failed", error);
      toast.error(errorMessage(error));
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle>{company ? "Edit delivery company" : "Add delivery company"}</SheetTitle>
          <SheetDescription>Paid orders are given to the company covering the customer's area.</SheetDescription>
        </SheetHeader>

        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="lc-name">Company name</Label>
            <Input id="lc-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Kwari Express Riders" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="lc-phone">Phone</Label>
              <Input id="lc-phone" inputMode="tel" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} placeholder="0803 000 0000" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="lc-wa">WhatsApp</Label>
              <Input id="lc-wa" inputMode="tel" value={form.whatsapp ?? ""} onChange={(e) => set("whatsapp", e.target.value)} placeholder="Same as phone" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lc-contact">Contact person (optional)</Label>
            <Input id="lc-contact" value={form.contact_name ?? ""} onChange={(e) => set("contact_name", e.target.value)} />
          </div>

          <div className="space-y-2">
            <Label>Areas covered in Kano</Label>
            <p className="text-xs text-muted-foreground">Tap the local government areas they deliver to. Matching uses the words in the customer's address.</p>
            <div className="flex flex-wrap gap-1.5">
              {KANO_LGAS.map((lga) => (
                <button
                  key={lga}
                  type="button"
                  onClick={() => toggleArea(lga)}
                  aria-pressed={has(lga)}
                  className={cn("rounded-full border px-2.5 py-1 text-xs transition-colors", has(lga) ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}
                >
                  {lga}
                </button>
              ))}
            </div>
            <div className="flex gap-2 pt-1">
              <Input
                value={customArea}
                onChange={(e) => setCustomArea(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } }}
                placeholder="Add neighbourhoods: Sabon Gari, Hotoro, Zoo Road…"
                aria-label="Add neighbourhood"
              />
              <Button type="button" variant="outline" onClick={addCustom} disabled={!customArea.trim()}>Add</Button>
            </div>
            {customAreas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {customAreas.map((area) => (
                  <span key={area} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                    {area}
                    <button type="button" onClick={() => toggleArea(area)} aria-label={`Remove ${area}`} className="rounded-full p-0.5 hover:bg-background">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Default company</p>
              <p className="text-xs text-muted-foreground">Gets every order no other company covers.</p>
            </div>
            <Switch checked={form.is_default ?? false} onCheckedChange={(v) => set("is_default", v)} aria-label="Default company" />
          </div>
          <div className="flex items-center justify-between gap-3 rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Turn off to stop sending them new orders.</p>
            </div>
            <Switch checked={form.is_active ?? true} onCheckedChange={(v) => set("is_active", v)} aria-label="Active" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lc-priority">Priority</Label>
            <Input id="lc-priority" type="number" inputMode="numeric" value={form.priority ?? DEFAULT_PRIORITY} onChange={(e) => set("priority", Number(e.target.value))} />
            <p className="text-xs text-muted-foreground">When two companies cover the same area, the lower number gets the order.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="lc-notes">Notes (optional)</Label>
            <Textarea id="lc-notes" rows={2} value={form.notes ?? ""} onChange={(e) => set("notes", e.target.value)} placeholder="Prices, working hours, pickup times…" />
          </div>
        </div>

        <Button className="mt-6 h-11 w-full" onClick={submit} disabled={save.isPending}>
          {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {company ? "Save changes" : "Add company"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function CompanyCard({ company, openJobs, onEdit }: { company: LogisticsCompany; openJobs: number; onEdit: () => void }) {
  const wa = whatsappNumber(company.whatsapp || company.phone);
  return (
    <div className={cn("rounded-2xl border bg-card p-4", !company.is_active && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="truncate font-semibold">{company.name}</p>
            {company.is_default && <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3" />Default</Badge>}
            {!company.is_active && <Badge variant="outline">Off</Badge>}
          </div>
          {company.contact_name && <p className="text-xs text-muted-foreground">{company.contact_name}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-xl font-bold tabular-nums">{openJobs}</p>
          <p className="text-[11px] text-muted-foreground">open deliveries</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {company.areas.length ? company.areas.map((a) => (
          <span key={a} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px]"><MapPin className="h-3 w-3" />{a}</span>
        )) : <span className="text-xs text-muted-foreground">No areas: only gets orders nobody else covers</span>}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {company.phone && (
          <Button asChild size="sm" variant="outline"><a href={`tel:${company.phone}`}><Phone className="mr-1.5 h-3.5 w-3.5" />Call</a></Button>
        )}
        {wa && (
          <Button asChild size="sm" variant="outline"><a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><BrandIcon brand="whatsapp" className="mr-1.5 h-3.5 w-3.5" />WhatsApp</a></Button>
        )}
        <Button size="sm" variant="secondary" onClick={onEdit}>Edit</Button>
      </div>
    </div>
  );
}

/** Delivery companies by area. Paid orders are assigned to them automatically. */
export default function AdminLogistics() {
  const { data: companies, isLoading, isError, refetch } = useLogisticsCompanies();
  const { data: overview } = useLogisticsOverview();
  const [editing, setEditing] = useState<LogisticsCompany | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const hasDefault = useMemo(() => (companies ?? []).some((c) => c.is_active && c.is_default), [companies]);
  const unassigned = overview?.openByCompany.unassigned ?? 0;

  const openSheet = (company: LogisticsCompany | null) => {
    setEditing(company);
    setSheetOpen(true);
  };

  return (
    <AdminLayout title="Logistics">
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Delivery companies</h2>
            <p className="text-sm text-muted-foreground">
              When a customer pays, we create their pickup code, pick the company covering their area and tell them.
            </p>
          </div>
          <Button onClick={() => openSheet(null)}><Plus className="mr-1.5 h-4 w-4" />Add company</Button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Link to="/admin/orders" className="rounded-2xl border bg-card p-4 hover:bg-muted/40">
            <p className="text-xs text-muted-foreground">Paid, not yet sent</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{overview?.waitingDispatch ?? "…"}</p>
          </Link>
          <div className="rounded-2xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">No company found</p>
            <p className={cn("mt-1 text-2xl font-bold tabular-nums", unassigned > 0 && "text-red-600")}>{overview ? unassigned : "…"}</p>
          </div>
          <div className="col-span-2 rounded-2xl border bg-card p-4 sm:col-span-1">
            <p className="text-xs text-muted-foreground">Active companies</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{companies ? companies.filter((c) => c.is_active).length : "…"}</p>
          </div>
        </div>

        {companies && !hasDefault && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
            No default company yet. Orders from areas nobody covers still get a pickup code, but you'll need to pick a company by hand.
          </div>
        )}

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div>
        ) : isError ? (
          <div className="rounded-2xl border bg-card p-6 text-center text-sm text-muted-foreground">
            Couldn't load delivery companies.
            <Button variant="outline" size="sm" className="ml-2" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : !companies?.length ? (
          <div className="rounded-2xl border bg-card px-6 py-10 text-center">
            <Truck className="mx-auto h-10 w-10 text-muted-foreground/50" />
            <p className="mt-3 font-medium">No delivery companies yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add the companies you work with and the parts of Kano each one covers.</p>
            <Button className="mt-4" onClick={() => openSheet(null)}><Plus className="mr-1.5 h-4 w-4" />Add the first company</Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {companies.map((c) => (
              <CompanyCard key={c.id} company={c} openJobs={overview?.openByCompany[c.id] ?? 0} onEdit={() => openSheet(c)} />
            ))}
          </div>
        )}
      </div>
      <CompanySheet company={editing} open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </AdminLayout>
  );
}
