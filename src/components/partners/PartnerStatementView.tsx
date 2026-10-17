import { useState } from "react";
import { format } from "date-fns";
import { Loader2, Undo2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { usePartnerStatement, usePayPartner, useReverseCommission, type CommissionLine, type CommissionStatus } from "@/hooks/usePartners";
import { naira } from "@/lib/naira";
import { cn } from "@/lib/utils";


const STATUS: Record<CommissionStatus, { label: string; className: string }> = {
  unpaid: { label: "To be paid", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  reversed: { label: "Refunded", className: "bg-muted text-muted-foreground line-through" },
};

function Line({ line, onReverse }: { line: CommissionLine; onReverse?: (line: CommissionLine) => void }) {
  const status = STATUS[line.status];
  const isRefundLine = line.amount < 0;
  return (
    <li className="flex items-start justify-between gap-3 p-3.5">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium">{line.store_name}</p>
        <p className="text-xs text-muted-foreground">
          {isRefundLine ? "Refund" : `${line.tier === "gold" ? "Gold" : "Blue"} badge`} · {naira(Math.abs(line.payment_amount))} · {format(new Date(line.payment_paid_at), "d MMM yyyy")}
        </p>
        {line.reversed_reason && <p className="mt-0.5 text-[11px] text-muted-foreground">{line.reversed_reason}</p>}
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <p className={cn("text-sm font-semibold tabular-nums", isRefundLine && "text-destructive")}>{naira(line.amount)}</p>
        <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}>{isRefundLine ? "Deducted next payout" : status.label}</span>
        {onReverse && line.status !== "reversed" && !isRefundLine && (
          <button type="button" onClick={() => onReverse(line)} className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground">
            <Undo2 className="h-3 w-3" />Refunded?
          </button>
        )}
      </div>
    </li>
  );
}

/**
 * A partner's commission: what's owed, what's been paid, and every badge
 * payment counted. Admins can record a payout and reverse a refunded payment.
 */
export function PartnerStatementView({ partnerId, percent, admin = false }: { partnerId: string; percent: number; admin?: boolean }) {
  const { data, isLoading, isError, refetch } = usePartnerStatement(partnerId);
  const pay = usePayPartner(partnerId);
  const reverse = useReverseCommission();
  const [payOpen, setPayOpen] = useState(false);
  const [reference, setReference] = useState("");
  const [reversing, setReversing] = useState<CommissionLine | null>(null);
  const [reason, setReason] = useState("");

  if (isLoading) return <Skeleton className="h-48 rounded-2xl" />;
  if (isError || !data) {
    return (
      <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
        Couldn't load the statement. <button type="button" className="font-medium underline" onClick={() => refetch()}>Try again</button>
      </div>
    );
  }

  const recordPayout = () =>
    pay.mutate(
      { reference: reference.trim() },
      {
        onSuccess: () => {
          toast.success("Payout recorded. The partner has been notified.");
          setPayOpen(false);
          setReference("");
        },
        onError: (error) => toast.error(error.message),
      },
    );

  const confirmReverse = () => {
    if (!reversing) return;
    reverse.mutate(
      { id: reversing.id, reason: reason.trim() || "Badge payment refunded" },
      {
        onSuccess: () => toast.success("Commission reversed"),
        onError: (error) => toast.error(error.message),
        onSettled: () => {
          setReversing(null);
          setReason("");
        },
      },
    );
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">To be paid</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums">{naira(Number(data.unpaid))}</p>
        </div>
        <div className="rounded-2xl border bg-card p-3.5">
          <p className="text-xs text-muted-foreground">Paid so far</p>
          <p className="mt-0.5 text-xl font-bold tabular-nums">{naira(Number(data.paid))}</p>
        </div>
      </div>

      {admin && (
        <Button className="h-11 w-full rounded-full" disabled={Number(data.unpaid) === 0 || pay.isPending} onClick={() => setPayOpen(true)}>
          <Wallet className="mr-2 h-4 w-4" />Record payout of {naira(Number(data.unpaid))}
        </Button>
      )}

      <p className="px-1 text-xs text-muted-foreground">
        {percent}% of every Blue and Gold badge payment, renewals included, from every seller except sellers who joined through an ambassador's link.
        Refunded payments are taken back from the next payout.
      </p>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <h3 className="border-b px-3.5 py-2.5 text-sm font-semibold">Badge payments counted</h3>
        {data.lines.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No badge payments yet. They'll appear here as sellers pay.</p>
        ) : (
          <ul className="divide-y">{data.lines.map((line) => <Line key={line.id} line={line} onReverse={admin ? setReversing : undefined} />)}</ul>
        )}
      </section>

      {data.payouts.length > 0 && (
        <section className="overflow-hidden rounded-2xl border bg-card">
          <h3 className="border-b px-3.5 py-2.5 text-sm font-semibold">Payouts</h3>
          <ul className="divide-y">
            {data.payouts.map((payout) => (
              <li key={payout.id} className="flex items-center justify-between gap-3 p-3.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">{format(new Date(payout.paid_at), "d MMM yyyy")}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {payout.items} payment{payout.items === 1 ? "" : "s"}{payout.reference ? ` · Ref ${payout.reference}` : ""}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold tabular-nums">{naira(Number(payout.amount))}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AlertDialog open={payOpen} onOpenChange={setPayOpen}>
        <AlertDialogContent className="max-w-[90vw] rounded-2xl md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Record payout of {naira(Number(data.unpaid))}?</AlertDialogTitle>
            <AlertDialogDescription>
              Send the money by bank transfer first, then record it here. Every unpaid line is marked paid and the partner gets a notification.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transfer reference (optional)" className="h-11 rounded-xl" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={recordPayout} disabled={pay.isPending}>
              {pay.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Record payout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!reversing} onOpenChange={(open) => !open && setReversing(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-2xl md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Badge payment refunded?</AlertDialogTitle>
            <AlertDialogDescription>
              {reversing?.status === "paid"
                ? `This commission was already paid, so ${naira(reversing.amount)} will be taken off the next payout.`
                : "This commission will be cancelled."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (optional)" className="h-11 rounded-xl" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmReverse}>Reverse commission</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
