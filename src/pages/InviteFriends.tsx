import { Link, Navigate } from "react-router-dom";
import { format } from "date-fns";
import { BellRing, CheckCircle2, Clock, Copy, Gift, Loader2, Percent, Share2, ShoppingBag, Trophy, UserPlus, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { BuyerBankCard } from "@/components/referral/BuyerBankCard";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { MAX_FRIEND_REMINDERS, useMyReferral, usePingFriend, type CreditLine, type ReferralFriend } from "@/hooks/useReferral";
import { inviteLink } from "@/lib/customerInvite";
import { k2 } from "@/lib/k2";

const CREDIT_LABELS: Record<CreditLine["kind"], string> = {
  referral_welcome: "Welcome credit",
  referral_reward: "Friend verified their account",
  referral_commission: "Share of a friend's order",
  order_spend: "Spent on an order",
  order_refund: "Order cancelled: returned",
  admin_adjust: "From Kano Kaftan",
};

/** "Remind" for a friend who joined but hasn't linked their bank account yet. */
function RemindButton({ friend }: { friend: ReferralFriend }) {
  const ping = usePingFriend();
  if (friend.status !== "joined" || !friend.id) return null;
  const pings = friend.pings ?? 0;

  if (!friend.can_ping) {
    return (
      <span className="shrink-0 text-right text-[11px] leading-tight text-muted-foreground">
        {pings >= MAX_FRIEND_REMINDERS ? "Reminded 5×" : "Reminded"}
        {pings < MAX_FRIEND_REMINDERS && <span className="block">again tomorrow</span>}
      </span>
    );
  }

  const remind = () =>
    ping.mutate(friend.id!, {
      onSuccess: (result) =>
        toast.success(`Reminder sent to ${friend.name}`, {
          description: result.pings_left > 0 ? `You can remind them again tomorrow (${result.pings_left} left).` : "That was the last reminder.",
        }),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Couldn't send the reminder."),
    });

  return (
    <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-full px-3" onClick={remind} disabled={ping.isPending}>
      {ping.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <BellRing className="mr-1 h-3.5 w-3.5" />}
      Remind
    </Button>
  );
}

/** Friend counts with a milestone badge. */
const MILESTONES = [5, 10, 20, 50];

/** /invite: your link, how K² credit works, who joined and your credit. */
export default function InviteFriends() {
  const { user, isLoading: authLoading } = useAuth();
  const { data, isLoading, isError, refetch } = useMyReferral(!!user);

  if (!authLoading && !user) return <Navigate to="/auth?redirect=/invite" replace />;

  const link = data?.code ? inviteLink(data.code) : "";
  const message = `Shop kaftans, shoes and caps from Kano's best sellers on Kano Kaftan. New buyers get first-buyer prices from every shop. Join with my link: ${link}`;
  const perFriend = Number(data?.referrer_credit ?? 0);
  const verified = Number(data?.verified ?? 0);
  const nextMilestone = MILESTONES.find((m) => m > verified) ?? null;
  const previousMilestone = [...MILESTONES].reverse().find((m) => m <= verified) ?? 0;

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
          <p className="mt-1 text-sm text-muted-foreground">Earn K² credit to shop in the app. 1 K² = ₦1.</p>
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
            Invites are paused right now. Your {k2(Number(data.balance))} still works at checkout.
          </div>
        ) : (
          <>
            {/* Offer + link */}
            <section className="rounded-3xl bg-primary p-5 text-primary-foreground">
              <Gift className="h-7 w-7" />
              <p className="mt-3 text-xl font-bold leading-snug">{k2(perFriend)} for every friend</p>
              <p className="mt-1 text-sm text-primary-foreground/75">
                Plus {Number(data.order_percent)}% of everything they buy, for as long as they shop. Credit can't be withdrawn: spend it on anything in the app.
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
                <p className="mt-1 text-lg font-bold">{k2(Number(data.balance))}</p>
                <p className="text-[11px] text-muted-foreground">To spend</p>
              </div>
              <div className="rounded-2xl border bg-card p-3">
                <UserPlus className="mx-auto h-4 w-4 text-primary" />
                <p className="mt-1 text-lg font-bold">{verified}<span className="text-sm font-normal text-muted-foreground">/{data.joined}</span></p>
                <p className="text-[11px] text-muted-foreground">Verified / joined</p>
              </div>
              <div className="rounded-2xl border bg-card p-3">
                <Gift className="mx-auto h-4 w-4 text-primary" />
                <p className="mt-1 text-lg font-bold">{k2(Number(data.earned))}</p>
                <p className="text-[11px] text-muted-foreground">Earned</p>
              </div>
            </section>

            {/* Milestones */}
            {perFriend > 0 && (
              <section className="rounded-2xl border bg-card p-4">
                <div className="flex items-center justify-between">
                  <h2 className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-[#9A7400]" />Milestones</h2>
                  {nextMilestone && <span className="text-xs text-muted-foreground">{nextMilestone - verified} more to {nextMilestone}</span>}
                </div>
                {nextMilestone && (
                  <Progress className="mt-3 h-2" value={((verified - previousMilestone) / (nextMilestone - previousMilestone)) * 100} />
                )}
                <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                  {MILESTONES.map((m) => (
                    <div key={m} className={`rounded-xl p-2 ${verified >= m ? "bg-primary text-primary-foreground" : "bg-muted/60"}`}>
                      <p className="text-sm font-bold">{m}</p>
                      <p className={`text-[10px] ${verified >= m ? "text-primary-foreground/75" : "text-muted-foreground"}`}>{k2(m * perFriend)}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* How it works */}
            <section className="rounded-2xl border bg-card p-4">
              <h2 className="font-semibold">How it works</h2>
              <ol className="mt-3 space-y-3 text-sm">
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">1</span>Send your link to a friend who hasn't shopped on Kano Kaftan. They get first-buyer prices from every shop.</li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">2</span>When they verify their account with a bank account in their own name, you get {k2(perFriend)}.</li>
                <li className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold"><Percent className="h-3 w-3" /></span>Every time one of their orders is delivered, you get {Number(data.order_percent)}% of it as K².</li>
              </ol>
              <p className="mt-3 text-xs text-muted-foreground">
                K² pays for items at checkout (not delivery) and can't be withdrawn. One bank account = one person, so extra accounts don't count.
              </p>
            </section>

            {/* Your own verification */}
            <BuyerBankCard />

            {/* Friends */}
            <section>
              <h2 className="mb-2 font-semibold">Your friends</h2>
              {data.friends.length === 0 ? (
                <p className="rounded-2xl border border-dashed p-4 text-center text-sm text-muted-foreground">No one yet. Share your link to get started.</p>
              ) : (
                <ul className="divide-y rounded-2xl border bg-card">
                  {data.friends.map((f, i) => (
                    <li key={f.id ?? `${f.name}-${f.joined_at}-${i}`} className="flex items-center gap-3 px-4 py-3 text-sm">
                      {f.status === "rewarded" ? <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                        : f.status === "cancelled" ? <XCircle className="h-4 w-4 shrink-0 text-muted-foreground" />
                        : <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {f.status === "rewarded"
                            ? "Verified"
                            : f.status === "cancelled" ? "Didn't count (same person)" : `Joined ${format(new Date(f.joined_at), "d MMM")} · waiting for them to verify`}
                        </p>
                      </div>
                      {Number(f.earned ?? 0) > 0 && <span className="shrink-0 font-semibold text-green-700 dark:text-green-400">+{k2(Number(f.earned))}</span>}
                      <RemindButton friend={f} />
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* Credit history */}
            {data.history.length > 0 && (
              <section>
                <h2 className="mb-2 font-semibold">K² history</h2>
                <ul className="divide-y rounded-2xl border bg-card">
                  {data.history.map((h, i) => (
                    <li key={`${h.created_at}-${i}`} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <p className="truncate">{CREDIT_LABELS[h.kind] ?? "Credit"}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(h.created_at), "d MMM yyyy")}
                          {h.order_id && h.kind !== "referral_commission" && <> · <Link to={`/orders/${h.order_id}`} className="underline">order #{h.order_id.slice(0, 8)}</Link></>}
                        </p>
                      </div>
                      <span className={Number(h.amount) > 0 ? "font-semibold text-green-700 dark:text-green-400" : "font-semibold"}>
                        {Number(h.amount) > 0 ? "+" : "−"}{k2(Math.abs(Number(h.amount)))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {Number(data.balance) > 0 && (
              <Button asChild className="h-12 w-full rounded-xl"><Link to="/products"><ShoppingBag className="mr-2 h-4 w-4" />Shop with my {k2(Number(data.balance))}</Link></Button>
            )}
          </>
        )}
      </div>
    </MobileLayout>
  );
}
