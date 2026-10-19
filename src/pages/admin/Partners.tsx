import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Award, CheckCircle2, Circle, Gem, Loader2, Pencil, Plus, Receipt, Search, Store, Trash2, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceManager } from "@/components/partners/ChoiceManager";
import { PartnerBadge } from "@/components/partners/PartnerMarks";
import { PartnerStatementView } from "@/components/partners/PartnerStatementView";
import {
  useAddPartnerMember, useDeletePartner, usePartnerFindShops, usePartnerOverview, useRemovePartnerMember, useSavePartner,
  type ChoiceShop, type PartnerInput, type PartnerSummary,
} from "@/hooks/usePartners";
import { naira } from "@/lib/naira";
import { cn } from "@/lib/utils";

const SEARCH_DELAY_MS = 300;
const DEFAULT_BADGE = "Founding Partner";
const MAX_PERCENT = 100;

type FormState = {
  name: string;
  vendor: Pick<ChoiceShop, "vendor_id" | "store_name" | "avatar_url"> | null;
  badge_label: string;
  choice_label: string;
  commission_percent: string;
  starts_on: string;
  ends_on: string;
  is_active: boolean;
  show_on_homepage: boolean;
  homepage_title: string;
  homepage_tagline: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  notes: string;
};

const today = () => format(new Date(), "yyyy-MM-dd");
const inOneYear = () => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return format(date, "yyyy-MM-dd");
};

function toForm(partner: PartnerSummary | null): FormState {
  return {
    name: partner?.name ?? "",
    vendor: partner?.vendor_id ? { vendor_id: partner.vendor_id, store_name: partner.store_name ?? "Store", avatar_url: null } : null,
    badge_label: partner?.badge_label ?? DEFAULT_BADGE,
    choice_label: partner?.choice_label ?? "",
    commission_percent: partner ? String(partner.commission_percent) : "",
    starts_on: partner?.starts_on ?? today(),
    ends_on: partner ? partner.ends_on ?? "" : inOneYear(),
    is_active: partner?.is_active ?? true,
    show_on_homepage: partner?.show_on_homepage ?? true,
    homepage_title: partner?.homepage_title ?? "",
    homepage_tagline: partner?.homepage_tagline ?? "",
    bank_name: partner?.bank_name ?? "",
    account_name: partner?.account_name ?? "",
    account_number: partner?.account_number ?? "",
    notes: partner?.notes ?? "",
  };
}

/** Pick the partner's own store from the sellers on Kano Kaftan. */
function StorePicker({ value, onChange }: { value: FormState["vendor"]; onChange: (shop: FormState["vendor"]) => void }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const { data: shops, isFetching } = usePartnerFindShops(search, open);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input]);

  if (value && !open) {
    return (
      <div className="flex items-center gap-3 rounded-xl border p-2.5">
        <Store className="h-4 w-4 shrink-0 text-muted-foreground" />
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{value.store_name}</p>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)}>Change</Button>
        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => onChange(null)} aria-label="Remove store"><X className="h-4 w-4" /></Button>
      </div>
    );
  }

  if (!open) {
    return <Button type="button" variant="outline" className="w-full justify-start" onClick={() => setOpen(true)}><Search className="mr-2 h-4 w-4" />Choose their store</Button>;
  }

  return (
    <div className="rounded-xl border">
      <div className="flex items-center gap-2 border-b p-2">
        <Search className="ml-1 h-4 w-4 text-muted-foreground" />
        <input autoFocus value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search store name" className="h-8 flex-1 bg-transparent text-sm outline-none" />
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)}>Close</Button>
      </div>
      <ul className="max-h-56 overflow-y-auto p-1">
        {(shops ?? []).map((shop) => (
          <li key={shop.vendor_id}>
            <button
              type="button"
              onClick={() => { onChange(shop); setOpen(false); }}
              className="flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm hover:bg-muted"
            >
              <Avatar className="h-8 w-8"><AvatarImage src={shop.avatar_url || undefined} alt="" /><AvatarFallback>{shop.store_name.charAt(0)}</AvatarFallback></Avatar>
              <span className="min-w-0 flex-1 truncate">{shop.store_name}</span>
              {shop.city && <span className="text-xs text-muted-foreground">{shop.city}</span>}
            </button>
          </li>
        ))}
        {isFetching && !shops && <li className="flex justify-center p-4"><Loader2 className="h-4 w-4 animate-spin" /></li>}
        {!isFetching && shops?.length === 0 && <li className="p-4 text-center text-sm text-muted-foreground">No stores found. They must open a seller account first.</li>}
      </ul>
    </div>
  );
}

/** Remove a partner after confirming. Partners with commission history are archived so the money records stay. */
function DeletePartnerButton({ partner, onDone, compact = false }: { partner: PartnerSummary; onDone?: () => void; compact?: boolean }) {
  const remove = useDeletePartner();
  const hasMoney = Number(partner.unpaid) > 0 || Number(partner.paid) > 0;

  const confirm = () => {
    remove.mutate(partner.id, {
      onSuccess: (outcome) => {
        toast.success(
          outcome === "archived"
            ? `${partner.name} removed. Their commission records are kept for your books.`
            : `${partner.name} removed`,
        );
        onDone?.();
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        {compact ? (
          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Remove ${partner.name}`}>
            <Trash2 className="h-4 w-4" />
          </Button>
        ) : (
          <Button type="button" variant="outline" className="w-full border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 className="mr-2 h-4 w-4" />Remove partner
          </Button>
        )}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {partner.name}?</AlertDialogTitle>
          <AlertDialogDescription>
            Their {partner.badge_label} badge, homepage spot and "{partner.choice_label || `${partner.name}'s Choice`}" picks disappear,
            their staff lose access to /partner and they stop earning commission.
            {hasMoney
              ? " Their commission and payout records are kept so your books stay complete."
              : " They have no commission history, so everything about them is deleted."}
            {Number(partner.unpaid) > 0 && ` They still have ${naira(Number(partner.unpaid))} unpaid: pay it from their statement first if you owe it.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep</AlertDialogCancel>
          <AlertDialogAction onClick={confirm} disabled={remove.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {remove.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Remove
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function PartnerForm({ partner, open, onOpenChange }: { partner: PartnerSummary | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const [form, setForm] = useState<FormState>(() => toForm(partner));
  const save = useSavePartner();
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (open) setForm(toForm(partner));
  }, [open, partner]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const percent = Number(form.commission_percent || 0);
    if (form.name.trim().length < 2) return toast.error("Enter the partner's name.");
    if (!Number.isFinite(percent) || percent < 0 || percent > MAX_PERCENT) return toast.error("Commission must be between 0 and 100%.");
    if (form.ends_on && form.ends_on < form.starts_on) return toast.error("The end date is before the start date.");

    const input: PartnerInput = {
      name: form.name.trim(),
      vendor_id: form.vendor?.vendor_id ?? null,
      badge_label: form.badge_label.trim() || DEFAULT_BADGE,
      choice_label: form.choice_label.trim() || null,
      commission_percent: percent,
      starts_on: form.starts_on,
      ends_on: form.ends_on || null,
      is_active: form.is_active,
      show_on_homepage: form.show_on_homepage,
      homepage_title: form.homepage_title.trim() || null,
      homepage_tagline: form.homepage_tagline.trim() || null,
      bank_name: form.bank_name.trim() || null,
      account_name: form.account_name.trim() || null,
      account_number: form.account_number.trim() || null,
      notes: form.notes.trim() || null,
    };
    save.mutate(
      { id: partner?.id ?? null, input },
      {
        onSuccess: () => {
          toast.success(partner ? "Partner saved" : `${input.name} added as a partner`);
          onOpenChange(false);
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  const choicePreview = form.choice_label.trim() || `${form.name.trim() || "Partner"}'s Choice`;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{partner ? `Edit ${partner.name}` : "New partner"}</SheetTitle>
          <SheetDescription>Terms from the signed agreement. Commission counts badge payments during these dates.</SheetDescription>
        </SheetHeader>
        <form onSubmit={submit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Partner name</Label>
            <Input id="p-name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Marmara Design" />
          </div>
          <div className="space-y-1.5">
            <Label>Their store on Kano Kaftan</Label>
            <StorePicker value={form.vendor} onChange={(v) => set("vendor", v)} />
            <p className="text-xs text-muted-foreground">Gets the partner badge. They open it like any seller at /sell.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-badge">Badge text</Label>
              <Input id="p-badge" value={form.badge_label} onChange={(e) => set("badge_label", e.target.value)} maxLength={40} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-choice">Their label</Label>
              <Input id="p-choice" value={form.choice_label} onChange={(e) => set("choice_label", e.target.value)} placeholder={choicePreview} maxLength={40} />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-xl bg-muted/50 p-3">
            <span className="text-xs text-muted-foreground">Preview:</span>
            <PartnerBadge label={form.badge_label || DEFAULT_BADGE} size="sm" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-pct">Commission %</Label>
              <Input id="p-pct" type="number" inputMode="decimal" min={0} max={MAX_PERCENT} step="0.5" value={form.commission_percent} onChange={(e) => set("commission_percent", e.target.value)} placeholder="10" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-start">Starts</Label>
              <Input id="p-start" type="date" value={form.starts_on} onChange={(e) => set("starts_on", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-end">Ends</Label>
              <Input id="p-end" type="date" value={form.ends_on} onChange={(e) => set("ends_on", e.target.value)} />
            </div>
          </div>
          <div className="space-y-3 rounded-xl border p-3">
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Active (badge, label and commission on)</span>
              <Switch checked={form.is_active} onCheckedChange={(v) => set("is_active", v)} />
            </label>
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>Show on the homepage</span>
              <Switch checked={form.show_on_homepage} onCheckedChange={(v) => set("show_on_homepage", v)} />
            </label>
          </div>
          {form.show_on_homepage && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="p-title">Homepage title</Label>
                <Input id="p-title" value={form.homepage_title} onChange={(e) => set("homepage_title", e.target.value)} placeholder={form.name || "Marmara Design"} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="p-tag">Homepage line</Label>
                <Input id="p-tag" value={form.homepage_tagline} onChange={(e) => set("homepage_tagline", e.target.value)} placeholder="Kano's home of fine tailoring, now on Kano Kaftan" />
              </div>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Commission bank account</Label>
            <Input value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="Bank name" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={form.account_name} onChange={(e) => set("account_name", e.target.value)} placeholder="Account name" />
              <Input value={form.account_number} onChange={(e) => set("account_number", e.target.value.replace(/\D/g, "").slice(0, 10))} inputMode="numeric" placeholder="Account number" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-notes">Notes</Label>
            <Textarea id="p-notes" value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={3} placeholder="Agreement signed on…, CAC number…" />
          </div>
          <Button type="submit" className="w-full" disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{partner ? "Save" : "Add partner"}
          </Button>
          {partner && <DeletePartnerButton partner={partner} onDone={() => onOpenChange(false)} />}
        </form>
      </SheetContent>
    </Sheet>
  );
}

function PeopleEditor({ partner }: { partner: PartnerSummary }) {
  const [email, setEmail] = useState("");
  const add = useAddPartnerMember(partner.id);
  const remove = useRemovePartnerMember(partner.id);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.includes("@")) return toast.error("Enter their email address.");
    add.mutate(email.trim(), {
      onSuccess: () => {
        toast.success(`${email.trim()} can now open the partner dashboard`);
        setEmail("");
      },
      onError: (error) => toast.error(error.message),
    });
  };

  return (
    <div className="space-y-2">
      {partner.members.map((m) => (
        <div key={m.user_id} className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">{m.name || m.email}{m.name && m.email ? <span className="text-muted-foreground"> · {m.email}</span> : null}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            aria-label={`Remove ${m.email}`}
            onClick={() => remove.mutate(m.user_id, { onError: (error) => toast.error(error.message) })}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
      <form onSubmit={submit} className="flex gap-2">
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Their sign-in email" className="h-9" />
        <Button type="submit" size="sm" variant="outline" disabled={add.isPending}>
          {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}

function Step({ done, children }: { done: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2 text-sm">
      {done ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />}
      <span className={cn(done && "text-muted-foreground line-through")}>{children}</span>
    </li>
  );
}

function PartnerCard({ partner, onEdit, onStatement, onPicks }: {
  partner: PartnerSummary;
  onEdit: () => void;
  onStatement: () => void;
  onPicks: () => void;
}) {
  const choiceLabel = partner.choice_label || `${partner.name}'s Choice`;
  const steps = [
    { done: true, text: "Agreement terms saved" },
    { done: !!partner.vendor_id, text: "Their store linked (they open it at /sell, you approve it under Sellers)" },
    { done: partner.members.length > 0, text: "Their staff can sign in to /partner (add their email below)" },
    { done: Number(partner.commission_percent) > 0, text: "Commission % set" },
    { done: partner.choices > 0, text: `First "${choiceLabel}" given` },
  ];

  return (
    <article className="rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{partner.name}</h2>
            <PartnerBadge label={partner.badge_label} size="sm" />
            {!partner.is_active && <Badge variant="secondary">Paused</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {Number(partner.commission_percent)}% of badge payments · {format(new Date(partner.starts_on), "d MMM yyyy")}
            {partner.ends_on ? ` – ${format(new Date(partner.ends_on), "d MMM yyyy")}` : " onwards"}
          </p>
          {partner.store_slug && (
            <Link to={`/shop/${partner.store_slug}`} className="text-sm font-medium text-primary hover:underline">{partner.store_name}</Link>
          )}
        </div>
        <div className="flex shrink-0">
          <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Edit partner"><Pencil className="h-4 w-4" /></Button>
          <DeletePartnerButton partner={partner} compact />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold">{partner.choices}</p><p className="text-[11px] text-muted-foreground">Shops picked</p></div>
        <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold tabular-nums">{naira(Number(partner.unpaid))}</p><p className="text-[11px] text-muted-foreground">To pay</p></div>
        <div className="rounded-xl bg-muted/50 p-2"><p className="text-lg font-bold tabular-nums">{naira(Number(partner.paid))}</p><p className="text-[11px] text-muted-foreground">Paid</p></div>
      </div>

      <ul className="mt-4 space-y-1.5">{steps.map((s) => <Step key={s.text} done={s.done}>{s.text}</Step>)}</ul>

      <div className="mt-4">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">People who can open /partner</p>
        <PeopleEditor partner={partner} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button variant="outline" onClick={onPicks} className="min-w-0"><Award className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">{choiceLabel}</span></Button>
        <Button variant="outline" onClick={onStatement} className="min-w-0"><Receipt className="mr-2 h-4 w-4 shrink-0" /><span className="truncate">Statement</span></Button>
      </div>
    </article>
  );
}

/** Admin: partners such as Marmara Design (Founding Partner Agreement). */
export default function AdminPartners() {
  const { data: partners, isLoading, isError, refetch } = usePartnerOverview();
  const [editing, setEditing] = useState<PartnerSummary | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [statementFor, setStatementFor] = useState<PartnerSummary | null>(null);
  const [picksFor, setPicksFor] = useState<PartnerSummary | null>(null);

  const openForm = (partner: PartnerSummary | null) => {
    setEditing(partner);
    setFormOpen(true);
  };

  return (
    <AdminLayout title="Partners">
      <div className="mb-4 space-y-3 sm:flex sm:items-center sm:justify-between sm:gap-3 sm:space-y-0">
        <p className="text-sm text-muted-foreground">Brands with a signed partner agreement: their badge, their label and their commission.</p>
        <Button onClick={() => openForm(null)} className="h-11 w-full shrink-0 sm:w-auto"><Plus className="mr-2 h-4 w-4" />Add partner</Button>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 rounded-2xl" />
      ) : isError ? (
        <div className="rounded-2xl border p-8 text-center text-sm text-muted-foreground">
          Couldn't load partners. <button type="button" className="underline" onClick={() => refetch()}>Try again</button>
        </div>
      ) : !partners?.length ? (
        <div className="rounded-2xl border border-dashed p-8 text-center">
          <Gem className="mx-auto h-10 w-10 text-[#9A7400]" />
          <h2 className="mt-3 font-semibold">No partners yet</h2>
          <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Once the agreement is signed, add the partner here. You'll get a checklist to finish setting them up.
          </p>
          <Button className="mt-4" onClick={() => openForm(null)}><Plus className="mr-2 h-4 w-4" />Add a partner</Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {partners.map((p) => (
            <PartnerCard key={p.id} partner={p} onEdit={() => openForm(p)} onStatement={() => setStatementFor(p)} onPicks={() => setPicksFor(p)} />
          ))}
        </div>
      )}

      <PartnerForm partner={editing} open={formOpen} onOpenChange={setFormOpen} />

      <Sheet open={!!statementFor} onOpenChange={(open) => !open && setStatementFor(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{statementFor?.name} statement</SheetTitle>
            <SheetDescription>
              {statementFor?.bank_name
                ? `Pay to ${statementFor.account_name ?? ""} · ${statementFor.bank_name} ${statementFor.account_number ?? ""}`
                : "Add their bank account in Edit before paying."}
            </SheetDescription>
          </SheetHeader>
          {statementFor && (
            <div className="mt-4">
              <PartnerStatementView partnerId={statementFor.id} percent={Number(statementFor.commission_percent)} admin />
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={!!picksFor} onOpenChange={(open) => !open && setPicksFor(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{picksFor?.choice_label || `${picksFor?.name}'s Choice`}</SheetTitle>
            <SheetDescription>The partner normally manages this from /partner. You can help them here.</SheetDescription>
          </SheetHeader>
          {picksFor && (
            <div className="mt-4">
              <ChoiceManager partnerId={picksFor.id} label={picksFor.choice_label || `${picksFor.name}'s Choice`} />
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AdminLayout>
  );
}
