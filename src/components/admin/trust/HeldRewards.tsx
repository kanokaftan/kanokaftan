import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { Check, Loader2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useHeldReferrals, useRecheckTrust, useReviewHeldReferral, useTrustStatus } from "@/hooks/useAdminUsers";
import { k2 } from "@/lib/k2";

const errorText = (error: unknown, fallback: string) => (error instanceof Error && error.message ? error.message : fallback);

/** "Checked 3 h ago · Recheck now": warnings are saved each night; this works them out again on demand. */
export function TrustCheckBar() {
  const { data: status } = useTrustStatus();
  const recheck = useRecheckTrust();
  const run = () =>
    recheck.mutate(undefined, {
      onSuccess: (count) => toast.success(`Checked ${count} accounts`),
      onError: (e) => toast.error(errorText(e, "Couldn't recheck. Please try again.")),
    });
  return (
    <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>
        {status?.checked_at ? `Checked ${formatDistanceToNowStrict(new Date(status.checked_at), { addSuffix: true })} · every night at 2am` : "Checked every night at 2am"}
      </span>
      <Button variant="ghost" size="sm" className="h-7 rounded-full px-2.5 text-xs" onClick={run} disabled={recheck.isPending}>
        {recheck.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="mr-1 h-3.5 w-3.5" />}
        Recheck now
      </Button>
    </div>
  );
}

/** Invite rewards waiting for a decision: approve pays the inviter's K², reject means the invite doesn't count. */
export function HeldRewards() {
  const { data: held, isLoading, error } = useHeldReferrals();
  const review = useReviewHeldReferral();

  if (isLoading || (!error && !held?.length)) return null;
  if (error) return <p className="mb-3 text-sm text-destructive">{errorText(error, "Couldn't load rewards on hold.")}</p>;

  const decide = (id: string, approve: boolean, who: string) =>
    review.mutate(
      { id, approve },
      {
        onSuccess: () => toast.success(approve ? `K² paid to ${who}` : "Reward rejected: the invite doesn't count"),
        onError: (e) => toast.error(errorText(e, "Couldn't save the decision.")),
      },
    );

  return (
    <section className="mb-4 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3">
      <h2 className="flex items-center gap-1.5 text-sm font-semibold">
        <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden="true" />
        Rewards on hold ({held!.length})
      </h2>
      <p className="mt-0.5 text-xs text-muted-foreground">A friend verified, but one of the accounts has a warning. Check, then approve or reject.</p>
      <ul className="mt-2 space-y-2">
        {held!.map((h) => {
          const busy = review.isPending && review.variables?.id === h.id;
          return (
            <li key={h.id} className="rounded-xl border bg-card p-3 text-sm">
              <p>
                <Link to={`/admin/users/${h.referrer_id}`} className="font-semibold hover:underline">{h.referrer_name}</Link>
                {" invited "}
                <Link to={`/admin/users/${h.friend_id}`} className="font-semibold hover:underline">{h.friend_name}</Link>
                {h.friend_bank_name && <span className="text-muted-foreground"> (bank: {h.friend_bank_name})</span>}
              </p>
              {h.reason && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{h.reason}</p>}
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground">
                  {k2(Number(h.amount))} · held {formatDistanceToNowStrict(new Date(h.held_at), { addSuffix: true })}
                </span>
                <span className="flex gap-1.5">
                  <Button size="sm" variant="outline" className="h-8 rounded-full" disabled={busy} onClick={() => decide(h.id, false, h.referrer_name)}>
                    <X className="mr-1 h-3.5 w-3.5" />Reject
                  </Button>
                  <Button size="sm" className="h-8 rounded-full" disabled={busy} onClick={() => decide(h.id, true, h.referrer_name)}>
                    {busy ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}Approve
                  </Button>
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
