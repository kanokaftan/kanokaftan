import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Check, Copy, Share2, Store, UserPlus, Wallet } from "lucide-react";
import { toast } from "sonner";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { BrandIcon } from "@/components/brand/BrandIcon";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useMyAmbassadorDashboard, type MyAmbassadorSeller, type ReferralStatus } from "@/hooks/useAmbassadors";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { ambassadorLink } from "@/lib/referral";
import { cn } from "@/lib/utils";

const COPIED_RESET_MS = 2000;

const STATUS: Record<ReferralStatus, { label: string; hint: string; className: string }> = {
  signed_up: { label: "Applied", hint: "Waiting for Kano Kaftan to approve the shop", className: "bg-muted text-muted-foreground" },
  approved: { label: "Shop open", hint: "Bonus comes when they pay for a verification badge", className: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  earned: { label: "Bonus earned", hint: "Kano Kaftan will pay this to you", className: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200" },
  paid: { label: "Bonus paid", hint: "Paid to you", className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  rejected: { label: "Not approved", hint: "The shop wasn't approved, so no bonus", className: "bg-destructive/10 text-destructive" },
};

const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);

function inviteText(code: string): string {
  return `Sell your kaftans and fashion on Kano Kaftan. Free shop, customers across Kano, delivery handled for you. Open your shop here: ${ambassadorLink(code)}`;
}

function SellerRow({ seller }: { seller: MyAmbassadorSeller }) {
  const status = STATUS[seller.status] ?? STATUS.signed_up;
  const name = seller.shop_slug ? (
    <Link to={`/shop/${seller.shop_slug}`} className="truncate font-medium hover:underline">{seller.shop_name}</Link>
  ) : (
    <span className="truncate font-medium">{seller.shop_name}</span>
  );
  return (
    <li className="flex items-start justify-between gap-3 p-3.5">
      <div className="min-w-0">
        <p className="flex min-w-0">{name}</p>
        <p className="text-xs text-muted-foreground">
          {seller.owner_first_name ? `${seller.owner_first_name} · ` : ""}joined {format(new Date(seller.joined_at), "d MMM yyyy")}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">{status.hint}</p>
      </div>
      <div className="shrink-0 text-right">
        <span className={cn("inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", status.className)}>{status.label}</span>
        {seller.reward_amount != null && <p className="mt-1 text-sm font-semibold tabular-nums">{naira(seller.reward_amount)}</p>}
      </div>
    </li>
  );
}

/** An ambassador's own page: their link, the sellers they brought in, and what they've earned. */
export default function AmbassadorDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { data, isLoading, isError, refetch } = useMyAmbassadorDashboard(!!user);
  const [copied, setCopied] = useState(false);

  useDocumentMeta({ title: "Ambassador dashboard - Kano Kaftan", description: "Your Kano Kaftan ambassador link, sellers and earnings." });

  if (authLoading || (user && isLoading)) {
    return (
      <MobileLayout>
        <div className="space-y-3 px-4 pt-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </MobileLayout>
    );
  }

  if (!user) {
    return (
      <MobileLayout>
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <UserPlus className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 font-display text-xl font-bold">Ambassador dashboard</h1>
          <p className="mt-2 text-sm text-muted-foreground">Sign in with the email you gave the Kano Kaftan team to see the sellers you invited.</p>
          <Button asChild className="mt-6 rounded-full"><Link to="/auth?redirect=/ambassador">Sign in</Link></Button>
        </div>
      </MobileLayout>
    );
  }

  if (isError) {
    return (
      <MobileLayout>
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">Couldn't load your dashboard.</p>
          <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => refetch()}>Try again</Button>
        </div>
      </MobileLayout>
    );
  }

  if (!data) {
    return (
      <MobileLayout>
        <div className="mx-auto max-w-md px-6 py-16 text-center">
          <UserPlus className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 font-display text-xl font-bold">You're not an ambassador yet</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Apply to become one: you get your own link and earn a bonus for every seller you bring. If the team already registered you,
            sign in with the same email you gave them.
          </p>
          <Button asChild className="mt-6 rounded-full"><Link to="/ambassadors/join">Become an ambassador</Link></Button>
        </div>
      </MobileLayout>
    );
  }

  const link = ambassadorLink(data.code);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch (error) {
      console.error("[AmbassadorDashboard] copy failed", error);
      toast.error("Couldn't copy. Press and hold the link to copy it.");
    }
  };
  const share = async () => {
    if (!navigator.share) return copy();
    try {
      await navigator.share({ title: "Sell on Kano Kaftan", text: inviteText(data.code) });
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") console.error("[AmbassadorDashboard] share failed", error);
    }
  };

  const stats = [
    { label: "Link visits", value: data.link_visits },
    { label: "Applied", value: data.totals.sign_ups },
    { label: "Shops open", value: data.totals.approved },
    { label: "Selling", value: data.totals.selling },
  ];

  return (
    <MobileLayout>
      <div className="space-y-4 px-4 pb-24 pt-4">
        <div>
          <h1 className="font-display text-xl font-bold">Hi {data.full_name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Your ambassador dashboard</p>
        </div>

        {!data.is_active && (
          <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            Your link is paused, so new sellers aren't being credited. Contact Kano Kaftan to turn it back on.
          </p>
        )}

        <section className="rounded-2xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your seller link · code {data.code}</p>
          <p className="mt-1 break-all font-mono text-sm">{link.replace(/^https?:\/\//, "")}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Button size="sm" variant="outline" onClick={copy}>
              {copied ? <Check className="mr-1.5 h-3.5 w-3.5" /> : <Copy className="mr-1.5 h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}
            </Button>
            <Button asChild size="sm" variant="outline">
              <a href={`https://wa.me/?text=${encodeURIComponent(inviteText(data.code))}`} target="_blank" rel="noreferrer">
                <BrandIcon brand="whatsapp" className="mr-1.5 h-3.5 w-3.5" />WhatsApp
              </a>
            </Button>
            <Button size="sm" onClick={share}><Share2 className="mr-1.5 h-3.5 w-3.5" />Share</Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Send it to tailors and fashion sellers. You earn {naira(data.reward_per_seller)} every time a shop that opened through your link pays for a verification badge, renewals included.
          </p>
        </section>

        <div className="grid grid-cols-4 gap-2 text-center">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border bg-card px-1 py-3">
              <p className="text-lg font-bold tabular-nums">{s.value}</p>
              <p className="text-[11px] leading-tight text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <section className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl border bg-card p-3">
            <Wallet className="h-4 w-4 text-muted-foreground" />
            <p className={cn("mt-1.5 text-xl font-bold tabular-nums", data.totals.owed > 0 && "text-amber-700 dark:text-amber-300")}>{naira(data.totals.owed)}</p>
            <p className="text-[11px] text-muted-foreground">Earned, not paid yet</p>
          </div>
          <div className="rounded-2xl border bg-card p-3">
            <Check className="h-4 w-4 text-muted-foreground" />
            <p className="mt-1.5 text-xl font-bold tabular-nums">{naira(data.totals.paid)}</p>
            <p className="text-[11px] text-muted-foreground">
              Paid to you{data.payout_account ? ` · ${data.payout_account}` : ""}
            </p>
          </div>
        </section>
        {!data.payout_account && (
          <p className="text-xs text-muted-foreground">Send your bank details to the Kano Kaftan team so they can pay your bonuses.</p>
        )}

        <section>
          <h2 className="mb-2 text-sm font-semibold">Sellers you invited</h2>
          {data.sellers.length ? (
            <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
              {data.sellers.map((s, i) => <SellerRow key={`${s.shop_name}-${s.joined_at}-${i}`} seller={s} />)}
            </ul>
          ) : (
            <div className="rounded-2xl border bg-card px-6 py-8 text-center">
              <Store className="mx-auto h-8 w-8 text-muted-foreground/60" />
              <p className="mt-3 font-medium">No sellers yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Share your link. Sellers appear here as soon as they apply.</p>
            </div>
          )}
        </section>
      </div>
    </MobileLayout>
  );
}
