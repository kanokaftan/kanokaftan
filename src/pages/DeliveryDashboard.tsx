import { useMemo, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle, Bike, CheckCircle2, ChevronRight, Clock, KeyRound, Loader2, MapPin, MessageCircle, Navigation,
  Package, Phone, RefreshCw, Store, Truck, User,
} from "lucide-react";
import { toast } from "sonner";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useStartSupportConversation } from "@/hooks/useChat";
import {
  useConfirmDelivery, useDeliveryDashboard, useMyLogisticsCompanyId, useUpdateDeliveryJob, whatsappNumber,
  type DeliveryJob, type DeliveryStage,
} from "@/hooks/useLogistics";
import { naira } from "@/lib/naira";
import { cn } from "@/lib/utils";

const CODE_LENGTH = 6;

type Tab = "new" | "active" | "done";
const TABS: { value: Tab; label: string; stages: DeliveryStage[] }[] = [
  { value: "new", label: "New", stages: ["new"] },
  { value: "active", label: "Active", stages: ["accepted", "picked_up", "on_the_way"] },
  { value: "done", label: "Done", stages: ["delivered", "cancelled"] },
];

const STAGE_LABEL: Record<DeliveryStage, string> = {
  new: "New, waiting for you",
  accepted: "Accepted, go and collect",
  picked_up: "Collected",
  on_the_way: "On the way to customer",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STAGE_TONE: Record<DeliveryStage, string> = {
  new: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  accepted: "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  picked_up: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
  on_the_way: "bg-primary/15 text-primary",
  delivered: "bg-green-500/15 text-green-700 dark:text-green-400",
  cancelled: "bg-muted text-muted-foreground",
};

function errorText(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function mapsUrl(address: string, lat?: string | null, lng?: string | null): string {
  const query = lat && lng ? `${lat},${lng}` : address;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

/** Call / WhatsApp / directions buttons for one stop. */
function ContactButtons({ phone, address, lat, lng }: { phone: string | null; address: string; lat?: string | null; lng?: string | null }) {
  const wa = whatsappNumber(phone);
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {phone && (
        <Button asChild size="sm" variant="outline" className="h-8 rounded-full">
          <a href={`tel:${phone}`}><Phone className="mr-1 h-3.5 w-3.5" />Call</a>
        </Button>
      )}
      {wa && (
        <Button asChild size="sm" variant="outline" className="h-8 rounded-full">
          <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><BrandIcon brand="whatsapp" className="mr-1 h-3.5 w-3.5" />WhatsApp</a>
        </Button>
      )}
      {address && (
        <Button asChild size="sm" variant="outline" className="h-8 rounded-full">
          <a href={mapsUrl(address, lat, lng)} target="_blank" rel="noreferrer"><Navigation className="mr-1 h-3.5 w-3.5" />Directions</a>
        </Button>
      )}
    </div>
  );
}

/** Accept with an optional rider name and phone (the customer sees them). */
function AcceptSheet({ job, onClose }: { job: DeliveryJob | null; onClose: () => void }) {
  const update = useUpdateDeliveryJob();
  const [riderName, setRiderName] = useState("");
  const [riderPhone, setRiderPhone] = useState("");

  const submit = async () => {
    if (!job) return;
    try {
      await update.mutateAsync({ orderId: job.order_id, action: "accept", riderName, riderPhone });
      toast.success(`Order ${job.ref} accepted`);
      setRiderName("");
      setRiderPhone("");
      onClose();
    } catch (error) {
      console.error("[Delivery] accept failed", error);
      toast.error(errorText(error, "Couldn't accept this delivery."));
    }
  };

  return (
    <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <SheetHeader className="text-left">
          <SheetTitle>Accept order {job?.ref}</SheetTitle>
          <SheetDescription>Who's riding? The customer will see the rider's name and number. You can skip this.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="rider-name">Rider name</Label>
            <Input id="rider-name" value={riderName} onChange={(e) => setRiderName(e.target.value)} placeholder="e.g. Musa Ibrahim" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rider-phone">Rider phone</Label>
            <Input id="rider-phone" inputMode="tel" value={riderPhone} onChange={(e) => setRiderPhone(e.target.value)} placeholder="0803 000 0000" />
          </div>
        </div>
        <Button className="mt-5 h-12 w-full rounded-full" onClick={submit} disabled={update.isPending}>
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Accept delivery
        </Button>
      </SheetContent>
    </Sheet>
  );
}

/** The rider types the 6-digit code the customer reads from their app. */
function CodeSheet({ job, onClose }: { job: DeliveryJob | null; onClose: () => void }) {
  const confirm = useConfirmDelivery();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  const close = () => {
    setCode("");
    setMessage(null);
    onClose();
  };

  const submit = async () => {
    if (!job || code.length !== CODE_LENGTH) return;
    try {
      const result = await confirm.mutateAsync({ orderId: job.order_id, code });
      if (result.ok) {
        toast.success(result.message);
        close();
      } else {
        setMessage(result.message);
        setCode("");
      }
    } catch (error) {
      console.error("[Delivery] confirm failed", error);
      setMessage(errorText(error, "Couldn't check the code. Please try again."));
    }
  };

  return (
    <Sheet open={!!job} onOpenChange={(open) => !open && close()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <SheetHeader className="text-left">
          <SheetTitle>Delivery code for {job?.ref}</SheetTitle>
          <SheetDescription>Hand over the parcel, then ask the customer for the 6-digit code in their Kano Kaftan app.</SheetDescription>
        </SheetHeader>
        <div className="mt-5 flex justify-center">
          <InputOTP maxLength={CODE_LENGTH} value={code} onChange={(v) => { setCode(v.replace(/\D/g, "")); setMessage(null); }} inputMode="numeric" autoFocus>
            <InputOTPGroup>
              {Array.from({ length: CODE_LENGTH }, (_, i) => <InputOTPSlot key={i} index={i} className="h-12 w-11 text-lg" />)}
            </InputOTPGroup>
          </InputOTP>
        </div>
        {message && (
          <p role="alert" className="mt-3 rounded-xl bg-destructive/10 p-3 text-center text-sm text-destructive">{message}</p>
        )}
        <Button className="mt-5 h-12 w-full rounded-full" onClick={submit} disabled={code.length !== CODE_LENGTH || confirm.isPending}>
          {confirm.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Confirm delivered
        </Button>
      </SheetContent>
    </Sheet>
  );
}

/** Tell Kano Kaftan something went wrong (customer not answering, wrong address…). */
function ProblemSheet({ job, onClose }: { job: DeliveryJob | null; onClose: () => void }) {
  const update = useUpdateDeliveryJob();
  const [note, setNote] = useState("");
  const quick = ["Customer not answering", "Wrong address", "Seller not ready", "Customer wants another day"];

  const submit = async () => {
    if (!job || !note.trim()) return;
    try {
      await update.mutateAsync({ orderId: job.order_id, action: "problem", note });
      toast.success("Kano Kaftan has been told");
      setNote("");
      onClose();
    } catch (error) {
      console.error("[Delivery] problem report failed", error);
      toast.error(errorText(error, "Couldn't send. Please try again."));
    }
  };

  return (
    <Sheet open={!!job} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <SheetHeader className="text-left">
          <SheetTitle>Problem with {job?.ref}</SheetTitle>
          <SheetDescription>Kano Kaftan will see this straight away and contact you.</SheetDescription>
        </SheetHeader>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {quick.map((q) => (
            <button key={q} type="button" onClick={() => setNote(q)} className="rounded-full border px-3 py-1.5 text-xs hover:bg-muted">{q}</button>
          ))}
        </div>
        <Textarea className="mt-3" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened?" maxLength={500} />
        <Button className="mt-4 h-12 w-full rounded-full" onClick={submit} disabled={!note.trim() || update.isPending}>
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Send to Kano Kaftan
        </Button>
      </SheetContent>
    </Sheet>
  );
}

function JobCard({ job, onAccept, onCode, onProblem }: { job: DeliveryJob; onAccept: () => void; onCode: () => void; onProblem: () => void }) {
  const update = useUpdateDeliveryJob();
  const open = !["delivered", "cancelled"].includes(job.stage);
  const allReady = job.pickups.length > 0 && job.pickups.every((p) => p.ready);

  const advance = async (action: "picked_up" | "on_the_way") => {
    try {
      await update.mutateAsync({ orderId: job.order_id, action });
      toast.success(action === "picked_up" ? "Marked as collected" : "Customer told you're on the way");
    } catch (error) {
      console.error("[Delivery] update failed", error);
      toast.error(errorText(error, "Couldn't update this delivery."));
    }
  };

  return (
    <article className="overflow-hidden rounded-3xl border bg-card shadow-sm">
      <header className="flex items-start justify-between gap-3 p-4 pb-3">
        <div className="min-w-0">
          <p className="font-mono text-sm font-semibold">#{job.ref}</p>
          <p className="text-xs text-muted-foreground">
            {job.items} {job.items === 1 ? "item" : "items"} · assigned {formatDistanceToNowStrict(new Date(job.assigned_at), { addSuffix: true })}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <span className={cn("inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold", STAGE_TONE[job.stage])}>
            {STAGE_LABEL[job.stage]}
          </span>
          <p className="mt-1 text-xs text-muted-foreground">Delivery fee {naira(job.delivery_fee)}</p>
        </div>
      </header>

      {job.problem && open && (
        <p className="mx-4 mb-3 flex items-start gap-2 rounded-xl bg-amber-500/10 p-2.5 text-xs text-amber-800 dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />Reported: {job.problem}
        </p>
      )}

      <ol className="space-y-0 border-t">
        {job.pickups.map((p, i) => (
          <li key={`${p.shop}-${i}`} className="border-b p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              <Store className="h-3.5 w-3.5" />Collect {job.pickups.length > 1 ? `(${i + 1} of ${job.pickups.length})` : ""}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2">
              <p className="break-words font-medium">{p.shop}</p>
              <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", p.ready ? "bg-green-500/15 text-green-700 dark:text-green-400" : "bg-muted text-muted-foreground")}>
                {p.ready ? "Packed and ready" : "Still packing"}
              </span>
            </div>
            <p className="break-words text-sm text-muted-foreground">{p.address || "Address not set: call the shop"} · {p.items} {p.items === 1 ? "item" : "items"}</p>
            {open && <ContactButtons phone={p.phone} address={p.address} lat={p.lat} lng={p.lng} />}
          </li>
        ))}
        <li className="p-4">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            <User className="h-3.5 w-3.5" />Deliver to
          </p>
          <p className="mt-1 break-words font-medium">{job.customer.name || "Customer"}</p>
          <p className="break-words text-sm text-muted-foreground">{job.customer.address || "No address"}</p>
          {open && <ContactButtons phone={job.customer.phone} address={job.customer.address} />}
        </li>
      </ol>

      {job.rider_name && open && (
        <p className="flex items-center gap-1.5 border-t px-4 py-2.5 text-xs text-muted-foreground">
          <Bike className="h-3.5 w-3.5" />Rider: {job.rider_name}{job.rider_phone ? ` · ${job.rider_phone}` : ""}
        </p>
      )}

      {open && (
        <footer className="flex flex-wrap items-center gap-2 border-t bg-muted/30 p-3">
          {job.stage === "new" && (
            <Button className="h-11 flex-1 rounded-full" onClick={onAccept}><CheckCircle2 className="mr-1.5 h-4 w-4" />Accept</Button>
          )}
          {job.stage === "accepted" && (
            <Button className="h-11 flex-1 rounded-full" onClick={() => advance("picked_up")} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Package className="mr-1.5 h-4 w-4" />}
              {allReady ? "I've collected it" : "Collected (check it's packed)"}
            </Button>
          )}
          {job.stage === "picked_up" && (
            <Button className="h-11 flex-1 rounded-full" onClick={() => advance("on_the_way")} disabled={update.isPending}>
              {update.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <Truck className="mr-1.5 h-4 w-4" />}On the way to customer
            </Button>
          )}
          {job.stage === "on_the_way" && (
            <Button className="h-11 flex-1 rounded-full" onClick={onCode}><KeyRound className="mr-1.5 h-4 w-4" />Enter delivery code</Button>
          )}
          {job.stage !== "new" && job.stage !== "on_the_way" && (
            <Button variant="outline" className="h-11 rounded-full" onClick={onCode}><KeyRound className="mr-1.5 h-4 w-4" />Code</Button>
          )}
          <Button variant="ghost" className="h-11 rounded-full text-muted-foreground" onClick={onProblem}>
            <AlertTriangle className="mr-1.5 h-4 w-4" />Problem
          </Button>
        </footer>
      )}
      {job.stage === "delivered" && job.delivered_at && (
        <p className="flex items-center gap-1.5 border-t px-4 py-3 text-xs text-green-700 dark:text-green-400">
          <CheckCircle2 className="h-3.5 w-3.5" />Delivered {formatDistanceToNowStrict(new Date(job.delivered_at), { addSuffix: true })}
        </p>
      )}
    </article>
  );
}

function CenteredMessage({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <MobileLayout>
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <Truck className="mx-auto h-10 w-10 text-primary" />
        <h1 className="mt-4 font-display text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {action && <div className="mt-6 flex flex-col items-center gap-2">{action}</div>}
      </div>
    </MobileLayout>
  );
}

function ChatWithUsButton({ className }: { className?: string }) {
  const navigate = useNavigate();
  const startSupport = useStartSupportConversation();
  const open = async () => {
    try {
      const id = await startSupport.mutateAsync(undefined);
      navigate(`/messages/${id}`);
    } catch (error) {
      console.error("[Delivery] open support chat failed", error);
      toast.error("Couldn't open the chat. Please try again.");
    }
  };
  return (
    <Button variant="outline" className={cn("rounded-full", className)} onClick={open} disabled={startSupport.isPending}>
      {startSupport.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <MessageCircle className="mr-1.5 h-4 w-4" />}
      Chat with Kano Kaftan
    </Button>
  );
}

/** Delivery company dashboard: every order given to the company, step by step to the customer's door. */
export default function DeliveryDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: companyId, isLoading: linkLoading, error: linkError } = useMyLogisticsCompanyId(!!user);
  const { data, isLoading, error, refetch, isFetching } = useDeliveryDashboard(!!companyId);
  const [tab, setTab] = useState<Tab>("new");
  const [accepting, setAccepting] = useState<DeliveryJob | null>(null);
  const [coding, setCoding] = useState<DeliveryJob | null>(null);
  const [reporting, setReporting] = useState<DeliveryJob | null>(null);

  useDocumentMeta({ title: "Delivery dashboard - Kano Kaftan", description: "Deliveries for Kano Kaftan partner companies." });

  const counts = useMemo(() => {
    const jobs = data?.jobs ?? [];
    return Object.fromEntries(TABS.map((t) => [t.value, jobs.filter((j) => t.stages.includes(j.stage)).length])) as Record<Tab, number>;
  }, [data]);
  const visible = useMemo(() => {
    const stages = TABS.find((t) => t.value === tab)?.stages ?? [];
    return (data?.jobs ?? []).filter((j) => stages.includes(j.stage));
  }, [data, tab]);

  if (!authLoading && !user) return <Navigate to="/auth?redirect=/delivery" replace />;

  if (authLoading || linkLoading) {
    return (
      <MobileLayout>
        <div className="space-y-3 px-4 pt-4">
          <Skeleton className="h-24 rounded-3xl" />
          <Skeleton className="h-64 rounded-3xl" />
        </div>
      </MobileLayout>
    );
  }

  if (linkError) {
    return <CenteredMessage title="Couldn't open your dashboard" body={errorText(linkError, "Please try again.")} action={<Button onClick={() => window.location.reload()}>Try again</Button>} />;
  }

  if (!companyId) {
    return (
      <CenteredMessage
        title="Not a delivery account yet"
        body={`You're signed in as ${user?.email}. Ask Kano Kaftan to add this email to your delivery company, then open this page again.`}
        action={<><ChatWithUsButton /><Button asChild variant="ghost"><Link to="/">Back to the shop</Link></Button></>}
      />
    );
  }

  return (
    <MobileLayout>
      <div className="mx-auto max-w-3xl space-y-4 px-4 pb-28 pt-4">
        <section className="rounded-3xl bg-gradient-to-br from-primary to-primary/80 p-5 text-primary-foreground shadow-lg">
          <p className="text-xs uppercase tracking-wider opacity-80">Delivery dashboard</p>
          <h1 className="mt-1 break-words font-display text-2xl font-bold">{data?.company.name ?? "…"}</h1>
          {data?.company.areas?.length ? (
            <p className="mt-1 flex items-start gap-1 text-xs opacity-90"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{data.company.areas.join(", ")}</p>
          ) : null}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {TABS.map((t) => (
              <div key={t.value} className="rounded-2xl bg-white/15 p-2.5 backdrop-blur">
                <p className="text-xl font-bold tabular-nums">{counts[t.value] ?? 0}</p>
                <p className="text-[11px] opacity-90">{t.label}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-2">
          <ChatWithUsButton className="flex-1" />
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => refetch()} aria-label="Refresh" disabled={isFetching}>
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>

        <div role="tablist" className="sticky top-14 z-10 flex gap-1 rounded-full border bg-background/80 p-1 backdrop-blur-xl">
          {TABS.map((t) => (
            <button
              key={t.value}
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setTab(t.value)}
              className={cn("flex-1 rounded-full px-3 py-2 text-sm font-medium transition-colors", tab === t.value ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground")}
            >
              {t.label}{counts[t.value] ? ` (${counts[t.value]})` : ""}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center justify-between gap-2 rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <span className="text-destructive">{errorText(error, "Couldn't load your deliveries.")}</span>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
          </div>
        )}

        {isLoading ? (
          [0, 1].map((i) => <Skeleton key={i} className="h-72 rounded-3xl" />)
        ) : !visible.length ? (
          <div className="rounded-3xl border border-dashed px-6 py-12 text-center text-sm text-muted-foreground">
            <Clock className="mx-auto mb-2 h-7 w-7" />
            {tab === "new" ? "No new deliveries. You'll get a notification when an order is given to you." : tab === "active" ? "Nothing in progress." : "No finished deliveries in the last 30 days."}
            {tab === "new" && counts.active > 0 && (
              <button type="button" onClick={() => setTab("active")} className="mt-3 flex w-full items-center justify-center gap-1 font-medium text-primary">
                {counts.active} in progress<ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {visible.map((job) => (
              <JobCard key={job.order_id} job={job} onAccept={() => setAccepting(job)} onCode={() => setCoding(job)} onProblem={() => setReporting(job)} />
            ))}
          </div>
        )}
      </div>

      <AcceptSheet job={accepting} onClose={() => setAccepting(null)} />
      <CodeSheet job={coding} onClose={() => setCoding(null)} />
      <ProblemSheet job={reporting} onClose={() => setReporting(null)} />
    </MobileLayout>
  );
}
