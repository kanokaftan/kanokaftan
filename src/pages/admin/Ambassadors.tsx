import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, Copy, Eye, Loader2, Pencil, Plus, Store, UserPlus, Users, Wallet } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import {
  useAmbassadorOverview, useAmbassadorReferrals, useMarkReferralPaid, useSaveAmbassador,
  type AmbassadorInput, type AmbassadorReferral, type AmbassadorSummary, type ReferralStatus,
} from "@/hooks/useAmbassadors";
import { whatsappNumber } from "@/hooks/useLogistics";
import { ambassadorLink } from "@/lib/referral";
import { cn } from "@/lib/utils";

/** Used until the settings row loads; the database applies the real amount. */
const DEFAULT_SELLER_REWARD = 3000;
const COPIED_RESET_MS = 2000;

const EMPTY: AmbassadorInput = {
  full_name: "", phone: "", email: "", bank_name: "", account_number: "", account_name: "", notes: "", is_active: true, code: "",
};

const STATUS: Record<ReferralStatus, { label: string; className: string }> = {
  signed_up: { label: "Waiting for approval", className: "bg-muted text-muted-foreground" },
  approved: { label: "Approved, no sale yet", className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  earned: { label: "Bonus earned", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  paid: { label: "Bonus paid", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  rejected: { label: "Application rejected", className: "bg-destructive/10 text-destructive" },
};

const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function useSellerReward() {
  return useQuery({
    queryKey: ["platform-settings", "ambassador-reward"],
    queryFn: async () => {
      const { data, error } = await supabase.from("platform_settings").select("ambassador_seller_reward").eq("id", 1).maybeSingle();
      if (error) throw error;
      return Number(data?.ambassador_seller_reward ?? DEFAULT_SELLER_REWARD);
    },
  });
}

/** The message an admin sends the ambassador, with the link they should share. */
function welcomeMessage(ambassador: Pick<AmbassadorSummary, "full_name" | "code">, reward: number): string {
  const first = ambassador.full_name.split(" ")[0];
  return [
    `Hi ${first}, welcome to the Kano Kaftan ambassador team.`,
    ``,
    `Your personal seller link: ${ambassadorLink(ambassador.code)}`,
    `Your code: ${ambassador.code}`,
    ``,
    `Share it with tailors and fashion sellers. When someone opens a shop through your link and makes their first sale, you earn ${naira(reward)}.`,
  ].join("\n");
}

/** What the ambassador can forward to sellers. */
function sellerInviteMessage(code: string): string {
  return `Sell your kaftans and fashion on Kano Kaftan. Free shop, customers across Kano, delivery handled for you. Open your shop here: ${ambassadorLink(code)}`;
}

function CopyButton({ text, label, className }: { text: string; label: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch (error) {
      console.error("[Ambassadors] copy failed", error);
      toast.error("Couldn't copy. Press and hold the link to copy it.");
    }
  };
  return (
    <Button type="button" size="sm" variant="outline" onClick={copy} className={className}>
      {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function AmbassadorSheet({ ambassador, open, onClose, onSaved }: {
  ambassador: AmbassadorSummary | null;
  open: boolean;
  onClose: () => void;
  onSaved: (saved: { full_name: string; code: string; phone: string | null }) => void;
}) {
  const save = useSaveAmbassador();
  const [form, setForm] = useState<AmbassadorInput>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(ambassador ? {
      id: ambassador.id,
      full_name: ambassador.full_name,
      phone: ambassador.phone ?? "",
      email: ambassador.email ?? "",
      bank_name: ambassador.bank_name ?? "",
      account_number: ambassador.account_number ?? "",
      account_name: ambassador.account_name ?? "",
      notes: ambassador.notes ?? "",
      is_active: ambassador.is_active,
      code: ambassador.code,
    } : EMPTY);
  }, [open, ambassador]);

  const set = <K extends keyof AmbassadorInput>(key: K, value: AmbassadorInput[K]) => setForm((f) => ({ ...f, [key]: value }));

  const submit = async () => {
    if (form.full_name.trim().length < 2) {
      toast.error("Enter the ambassador's name");
      return;
    }
    try {
      const saved = await save.mutateAsync(form);
      toast.success(ambassador ? "Ambassador updated" : `Ambassador added. Their code is ${saved.code}.`);
      onSaved(saved);
      onClose();
    } catch (error) {
      console.error("[Ambassadors] save failed", { error });
      toast.error(errorMessage(error, "Couldn't save. Please try again."));
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="text-left">
          <SheetTitle>{ambassador ? "Edit ambassador" : "Add ambassador"}</SheetTitle>
          <SheetDescription>
            {ambassador ? "Changing the code breaks links already shared." : "A personal link is created for them straight away."}
          </SheetDescription>
        </SheetHeader>
        <div className="mt-5 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="amb-name">Full name</Label>
            <Input id="amb-name" value={form.full_name} onChange={(e) => set("full_name", e.target.value)} placeholder="Amina Bello" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="amb-phone">Phone / WhatsApp</Label>
              <Input id="amb-phone" type="tel" inputMode="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="0803 123 4567" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="amb-email">Email (optional)</Label>
              <Input id="amb-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
          </div>
          {ambassador && (
            <div className="space-y-1.5">
              <Label htmlFor="amb-code">Link code</Label>
              <Input id="amb-code" value={form.code} onChange={(e) => set("code", e.target.value.toUpperCase())} maxLength={16} />
            </div>
          )}
          <div className="rounded-xl border p-3">
            <p className="mb-3 text-sm font-medium">Where to pay their bonus</p>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="amb-bank">Bank</Label>
                  <Input id="amb-bank" value={form.bank_name} onChange={(e) => set("bank_name", e.target.value)} placeholder="Opay, GTBank…" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="amb-acct">Account number</Label>
                  <Input id="amb-acct" inputMode="numeric" maxLength={10} value={form.account_number}
                    onChange={(e) => set("account_number", e.target.value.replace(/\D/g, ""))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="amb-acct-name">Account name</Label>
                <Input id="amb-acct-name" value={form.account_name} onChange={(e) => set("account_name", e.target.value)} />
              </div>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="amb-notes">Notes</Label>
            <Textarea id="amb-notes" rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} placeholder="Area they cover, agreement signed on…" />
          </div>
          <div className="flex items-center justify-between rounded-xl border p-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">When off, their link stops crediting new sellers.</p>
            </div>
            <Switch checked={form.is_active ?? true} onCheckedChange={(v) => set("is_active", v)} />
          </div>
          <Button className="w-full" onClick={submit} disabled={save.isPending}>
            {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ambassador ? "Save changes" : "Add ambassador"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function ReferralRow({ referral, ambassadorId }: { referral: AmbassadorReferral; ambassadorId: string }) {
  const markPaid = useMarkReferralPaid(ambassadorId);
  const [note, setNote] = useState("");
  const status = STATUS[referral.status as ReferralStatus] ?? STATUS.signed_up;

  const pay = async () => {
    try {
      await markPaid.mutateAsync({ sellerId: referral.seller_id, note: note.trim() });
      toast.success("Bonus marked as paid");
    } catch (error) {
      console.error("[Ambassadors] mark paid failed", { sellerId: referral.seller_id, error });
      toast.error(errorMessage(error, "Couldn't record the payment."));
    }
  };

  return (
    <li className="space-y-2 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-medium">{referral.shop_name || "Unnamed shop"}</p>
          <p className="truncate text-xs text-muted-foreground">
            {[referral.seller_name, referral.seller_phone].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Joined {format(new Date(referral.created_at), "d MMM yyyy")}
            {referral.source === "admin" && " · added by admin"}
            {referral.paid_at && ` · paid ${format(new Date(referral.paid_at), "d MMM")}`}
            {referral.payment_note && ` (${referral.payment_note})`}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}>{status.label}</span>
          {referral.reward_amount != null && <p className="mt-1 text-sm font-semibold tabular-nums">{naira(referral.reward_amount)}</p>}
        </div>
      </div>
      {referral.status === "earned" && (
        <div className="flex gap-2">
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="How it was paid (optional)" className="h-9 text-sm" />
          <Button size="sm" className="h-9 shrink-0" onClick={pay} disabled={markPaid.isPending}>
            {markPaid.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Mark paid"}
          </Button>
        </div>
      )}
    </li>
  );
}

function ReferralsSheet({ ambassador, onClose }: { ambassador: AmbassadorSummary | null; onClose: () => void }) {
  const { data: referrals, isLoading, isError, refetch } = useAmbassadorReferrals(ambassador?.id ?? null);
  return (
    <Sheet open={!!ambassador} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        {ambassador && (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>{ambassador.full_name}</SheetTitle>
              <SheetDescription>
                Sellers who joined with code {ambassador.code}.
                {ambassador.account_number && ` Pay to ${ambassador.bank_name ?? "bank"} ${ambassador.account_number}${ambassador.account_name ? ` (${ambassador.account_name})` : ""}.`}
              </SheetDescription>
            </SheetHeader>
            <div className="mt-4">
              {isLoading ? (
                <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
              ) : isError ? (
                <div className="rounded-xl border p-6 text-center text-sm">
                  <p className="text-muted-foreground">Couldn't load the sellers.</p>
                  <Button size="sm" variant="outline" className="mt-3" onClick={() => refetch()}>Try again</Button>
                </div>
              ) : !referrals?.length ? (
                <div className="rounded-xl border p-6 text-center text-sm text-muted-foreground">
                  No sellers yet. They appear here as soon as someone applies through the link.
                </div>
              ) : (
                <ul className="divide-y overflow-hidden rounded-xl border bg-card">
                  {referrals.map((r) => <ReferralRow key={r.seller_id} referral={r} ambassadorId={ambassador.id} />)}
                </ul>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function AmbassadorCard({ ambassador, reward, onEdit, onView }: {
  ambassador: AmbassadorSummary;
  reward: number;
  onEdit: () => void;
  onView: () => void;
}) {
  const link = ambassadorLink(ambassador.code);
  const wa = whatsappNumber(ambassador.phone);
  const stats = [
    { label: "Link visits", value: ambassador.link_visits },
    { label: "Applied", value: ambassador.sign_ups },
    { label: "Approved", value: ambassador.approved },
    { label: "Selling", value: ambassador.selling },
  ];

  return (
    <li className={cn("rounded-2xl border bg-card p-4", !ambassador.is_active && "opacity-60")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate font-semibold">{ambassador.full_name}</p>
            {!ambassador.is_active && <Badge variant="secondary">Paused</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{ambassador.phone || ambassador.email || "No contact saved"}</p>
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onEdit} aria-label={`Edit ${ambassador.full_name}`}>
          <Pencil className="h-4 w-4" />
        </Button>
      </div>

      <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Seller link · code {ambassador.code}</p>
        <p className="truncate font-mono text-sm">{link.replace(/^https?:\/\//, "")}</p>
      </div>

      <div className="mt-3 grid grid-cols-4 gap-2 text-center">
        {stats.map((s) => (
          <div key={s.label}>
            <p className="text-lg font-bold tabular-nums">{s.value}</p>
            <p className="text-[11px] leading-tight text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between rounded-xl border px-3 py-2 text-sm">
        <span className="text-muted-foreground">Owed</span>
        <span className={cn("font-semibold tabular-nums", ambassador.owed > 0 && "text-amber-700 dark:text-amber-300")}>{naira(ambassador.owed)}</span>
        <span className="text-muted-foreground">Paid</span>
        <span className="font-semibold tabular-nums">{naira(ambassador.paid)}</span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={link} label="Copy link" />
        <CopyButton text={sellerInviteMessage(ambassador.code)} label="Copy invite text" />
        {wa && (
          <Button asChild size="sm" variant="outline">
            <a href={`https://wa.me/${wa}?text=${encodeURIComponent(welcomeMessage(ambassador, reward))}`} target="_blank" rel="noreferrer">
              <BrandIcon brand="whatsapp" className="mr-1.5 h-3.5 w-3.5" />Send to {ambassador.full_name.split(" ")[0]}
            </a>
          </Button>
        )}
        <Button size="sm" onClick={onView} className="ml-auto">
          <Eye className="mr-1.5 h-3.5 w-3.5" />Sellers
        </Button>
      </div>
    </li>
  );
}

/** Admin: register ambassadors, hand out their links, track sellers and bonuses. */
export default function AdminAmbassadors() {
  const { data: ambassadors, isLoading, isError, refetch } = useAmbassadorOverview();
  const { data: reward = DEFAULT_SELLER_REWARD } = useSellerReward();
  const [editing, setEditing] = useState<AmbassadorSummary | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewing, setViewing] = useState<AmbassadorSummary | null>(null);
  const [justAdded, setJustAdded] = useState<{ full_name: string; code: string; phone: string | null } | null>(null);

  const totals = useMemo(() => {
    const list = ambassadors ?? [];
    return {
      active: list.filter((a) => a.is_active).length,
      sellers: list.reduce((sum, a) => sum + a.sign_ups, 0),
      owed: list.reduce((sum, a) => sum + a.owed, 0),
      paid: list.reduce((sum, a) => sum + a.paid, 0),
    };
  }, [ambassadors]);

  const openNew = () => {
    setEditing(null);
    setSheetOpen(true);
  };

  const tiles = [
    { icon: Users, label: "Active ambassadors", value: String(totals.active) },
    { icon: Store, label: "Sellers brought in", value: String(totals.sellers) },
    { icon: Wallet, label: "Bonus owed", value: naira(totals.owed) },
    { icon: Check, label: "Bonus paid", value: naira(totals.paid) },
  ];

  const addedWa = justAdded ? whatsappNumber(justAdded.phone) : null;

  return (
    <AdminLayout title="Ambassadors">
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="max-w-lg text-sm text-muted-foreground">
            Each ambassador gets a personal link. Sellers who apply through it are credited to them, and they earn{" "}
            <strong className="text-foreground">{naira(reward)}</strong> when that shop makes its first sale. Customers who sign up through the link don't count.
          </p>
          <Button onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Add ambassador</Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {tiles.map((tile) => (
            <div key={tile.label} className="rounded-2xl border bg-card p-3">
              <tile.icon className="h-4 w-4 text-muted-foreground" />
              <p className="mt-1.5 text-lg font-bold tabular-nums">{tile.value}</p>
              <p className="text-[11px] text-muted-foreground">{tile.label}</p>
            </div>
          ))}
        </div>

        {justAdded && (
          <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
            <p className="font-medium">{justAdded.full_name} is ready to share</p>
            <p className="mt-1 break-all font-mono text-sm">{ambassadorLink(justAdded.code)}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <CopyButton text={ambassadorLink(justAdded.code)} label="Copy link" />
              {addedWa && (
                <Button asChild size="sm">
                  <a href={`https://wa.me/${addedWa}?text=${encodeURIComponent(welcomeMessage(justAdded, reward))}`} target="_blank" rel="noreferrer">
                    <BrandIcon brand="whatsapp" className="mr-1.5 h-3.5 w-3.5" />Send it on WhatsApp
                  </a>
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => setJustAdded(null)}>Done</Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">{[0, 1].map((i) => <Skeleton key={i} className="h-56 rounded-2xl" />)}</div>
        ) : isError ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Couldn't load ambassadors.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : !ambassadors?.length ? (
          <div className="rounded-2xl border bg-card px-6 py-10 text-center">
            <UserPlus className="mx-auto h-8 w-8 text-muted-foreground/60" />
            <p className="mt-3 font-medium">No ambassadors yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Add your first ambassador to create their personal seller link.</p>
            <Button className="mt-4" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" />Add ambassador</Button>
          </div>
        ) : (
          <ul className="space-y-3">
            {ambassadors.map((a) => (
              <AmbassadorCard
                key={a.id}
                ambassador={a}
                reward={reward}
                onEdit={() => { setEditing(a); setSheetOpen(true); }}
                onView={() => setViewing(a)}
              />
            ))}
          </ul>
        )}
      </div>

      <AmbassadorSheet
        ambassador={editing}
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={(saved) => { if (!editing) setJustAdded(saved); }}
      />
      <ReferralsSheet ambassador={viewing} onClose={() => setViewing(null)} />
    </AdminLayout>
  );
}
