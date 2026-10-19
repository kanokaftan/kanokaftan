import { Link, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { CheckCircle2, Clock, Copy, Gift, Share2, ShoppingBag, UserPlus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMyReferral, type CreditLine } from "@/hooks/useReferral";
import { inviteLink } from "@/lib/customerInvite";
import { naira } from "@/lib/naira";

const CREDIT_LABELS: Record<CreditLine["kind"], string> = {
  referral_welcome: "Welcome credit",
  referral_reward: "Friend's first order",
  order_spend: "Used on an order",
  order_refund: "Order cancelled: returned",
  admin_adjust: "From Kano Kaftan",
};

/** /invite: your link, how it works, who joined and your credit. */
export default function InviteFriends() {
  const { user, isLoading: authLoading } = useAuth();
  const { data, isLoading, isError, refetch } = useMyReferral(!!user);

  if (!authLoading && !user) return <Navigate to="/auth?redirect=/invite" replace />;

  const link = data?.code ? inviteLink(data.code) : "";
  const message = data
    ? `Shop kaftans, shoes and caps from Kano's best sellers on Kano Kaftan. Sign up with my link and get ${naira(Number(data.friend_credit))} off your first order: ${link}`
    : "";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy. Press and hold the link to copy it.");
    }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "Kano Kaftan", text: message });
      } catch (error) {
        // Closing the share sheet isn't an error worth showing.
        if ((error as Error)?.name !== "AbortError") console.error("[invite] share failed", error);
      }
    } else {
      copy();
    }
  };

  return (
    <MobileLayout>
      <div className="mx-auto max-w-lg space-y-5 px-4 py-6">
        <div>
          <h1 className="font-display text-2xl font-bold">Invite friends</h1>
          <p className="mt-1 text-sm text-muted-foreground">Share Kano Kaftan and you both get credit.</p>
        </div>

        {isLoading || authLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
          </div>
        ) : isError || !data ? (
          <div className="rounded-2xl border p-6 text-center text-sm">
            <p className="text-muted-foreground">Couldn't load your invites.</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : !data.enabled ? (
          <div className="rounded-2xl border p-6 text-center text-sm text-muted-foreground">
            Invites are paused right now. Your credit of {naira(Number(data.balance))} still works at checkout.
          </div>
        ) : (
          <>
            {/* Offer + link */}
            <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
              <Gift className="h-7 w-7" />
              <p className="mt-3 text-xl font-bold leading-snug">
                Give {naira(Number(data.friend_credit))}, get {naira(Number(data.referrer_credit))}
              </p>
              <p className="mt-1 text-sm text-primary-foreground/75">
                Friends get {naira(Number(data.friend_credit))} off their first order. You get {naira(Number(data.referrer_credit))} when it's delivered.
              </p>
              <div className="mt-4 flex items-center gap-2 rounded-xl bg-primary-foreground/10 p-2 pl-3">
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{link.replace(/^https?:\/\//, "")}</span>
                <Button size="sm" variant="secondary" onClick={copy} className="shrink-0"><Copy className="mr-1.5 h-4 w-4" />Copy</Button>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button asChild variant="secondary" className="h-11">
                  <a href={`https://wa.me/?text=${encodeURIComponent(message)}`} target="_blank" rel="noopener noreferrer">
                    <BrandIcon brand="whatsapp" colored className="mr-2" />WhatsApp
                  </a>
                </Button>
                <Button variant="secondary" className="h-11" onClick={share}><Share2 className="mr-2 h-4 w-4" />Share</Button>
              </div>
              <p className="mt-3 text-center text-xs text-primary-foreground/70">Your code: <span className="font-mono font-semibold">{data.code}</span></p>
            </section>

            {/* Credit and counts */}
            <section className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-2xl border bg-card p-3">
                <Wallet className="mx-auto h-4 w-4 text-primary" />
                <p className="mt-1 text-lg font-bold">{naira(Number(data.balance))}</p>
                <p className="text-[11px] text-muted-foreground">Your credit</p>
              </div>
              <div className="rounded-2xl border bg-card p-3">
                <UserPlus className="mx-auto h-4 w-4 text-primary" />
                <p className="mt-1 text-lg font-bold">{data.joined}</p>
                <p className="text-[11px] text-muted-foreground">Friends joined</p>
              </div>
              <div className="rounded-2xl border bg-card p-3">
                <Gift className="mx-auto h-4 w-4 text-primary" />
                <p className="mt-1 text-lg font-bold">{naira(Number(data.earned))}</p>
                <p className="text-[11px] text-muted-foreground">Earned</p>
              </div>
            </section>

            {/* How it works */}
            <section className="rounded-2xl border bg-card p-4">
              <h2 className="font-semibold">How it works</h2>
              <ol className="mt-3 space-y-3 text-sm">
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">1</span>Send your link to a friend who hasn't shopped on Kano Kaftan.</li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">2</span>They sign up and get {naira(Number(data.friend_credit))} off their first order of {naira(Number(data.min_order))} or more.</li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">3</span>When that order is delivered and complete, {naira(Number(data.referrer_credit))} is added to your credit.</li>
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                Credit comes off orders of {naira(Number(data.min_order))} or more (not delivery). If an order is cancelled, the credit comes back.
              </p>
            </section>

            {/* Friends */}
            <section>
              <h2 className="mb-2 font-semibold">Your friends</h2>
              {data.friends.length === 0 ? (
                <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">No one yet. Share your link to get started.</p>
              ) : (
                <ul className="divide-y rounded-2xl border bg-card">
                  {data.friends.map((f, i) => (
                    <li key={`${f.name}-${f.joined_at}-${i}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                      {f.status === "rewarded" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" /> : <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.status === "rewarded"
                            ? `First order delivered · you earned ${naira(Number(data.referrer_credit))}`
                            : f.status === "cancelled" ? "Didn't qualify" : `Joined ${format(new Date(f.joined_at), "d MMM")} · waiting for their first order`}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Credit history */}
            {data.history.length > 0 && (
              <section>
                <h2 className="mb-2 font-semibold">Credit history</h2>
                <ul className="divide-y rounded-2xl border bg-card">
                  {data.history.map((h, i) => (
                    <li key={`${h.created_at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{CREDIT_LABELS[h.kind] ?? "Credit"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(h.created_at), "d MMM yyyy")}
                          {h.order_id && <> · <Link to={`/orders/${h.order_id}`} className="underline">order #{h.order_id.slice(0, 8)}</Link></>}
                        </p>
                      </div>
                      <span className={Number(h.amount) > 0 ? "font-semibold text-green-700 dark:text-green-400" : "font-semibold"}>
                        {Number(h.amount) > 0 ? "+" : "−"}{naira(Math.abs(Number(h.amount)))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {Number(data.balance) > 0 && (
              <Button asChild className="h-12 w-full rounded-xl"><Link to="/products"><ShoppingBag className="mr-2 h-4 w-4" />Use my {naira(Number(data.balance))} credit</Link></Button>
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
}
