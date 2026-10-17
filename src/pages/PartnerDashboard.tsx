import { Link } from "react-router-dom";
import { format } from "date-fns";
import { ExternalLink, Gem } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChoiceManager } from "@/components/partners/ChoiceManager";
import { PartnerBadge } from "@/components/partners/PartnerMarks";
import { PartnerStatementView } from "@/components/partners/PartnerStatementView";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { useMyPartner } from "@/hooks/usePartners";

function Message({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <MobileLayout>
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <Gem className="mx-auto h-10 w-10 text-[#9A7400]" />
        <h1 className="mt-4 font-display text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        {action && <div className="mt-6">{action}</div>}
      </div>
    </MobileLayout>
  );
}

/** A partner's page: give their label to shops, and see what they've earned. */
export default function PartnerDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const { data: partner, isLoading, isError, refetch } = useMyPartner(!!user);

  useDocumentMeta({ title: "Partner dashboard - Kano Kaftan", description: "Your Kano Kaftan partner label and earnings." });

  if (authLoading || (user && isLoading)) {
    return (
      <MobileLayout>
        <div className="space-y-3 px-4 pt-4">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </MobileLayout>
    );
  }

  if (!user) {
    return (
      <Message
        title="Partner dashboard"
        body="Sign in with the account Kano Kaftan added to your partner team."
        action={<Button asChild className="rounded-full"><Link to="/auth?redirect=/partner">Sign in</Link></Button>}
      />
    );
  }

  if (isError) {
    return (
      <Message
        title="Couldn't load your dashboard"
        body="Check your connection and try again."
        action={<Button variant="outline" className="rounded-full" onClick={() => refetch()}>Try again</Button>}
      />
    );
  }

  if (!partner) {
    return (
      <Message
        title="This page is for partners"
        body="If you work with a Kano Kaftan partner, ask the Kano Kaftan team to add the email you signed in with."
        action={<Button asChild variant="outline" className="rounded-full"><Link to="/help">Contact Kano Kaftan</Link></Button>}
      />
    );
  }

  return (
    <MobileLayout>
      <div className="space-y-4 px-4 pb-24 pt-4">
        <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-[#1c1917] via-[#2b2410] to-[#5c4613] p-5 text-white">
          <PartnerBadge label={partner.badge_label} />
          <h1 className="mt-3 font-display text-2xl font-bold">{partner.name}</h1>
          <p className="mt-1 text-sm text-white/70">
            Since {format(new Date(partner.starts_on), "d MMM yyyy")}
            {partner.ends_on ? ` · until ${format(new Date(partner.ends_on), "d MMM yyyy")}` : ""}
          </p>
          {partner.store_slug && (
            <Link to={`/shop/${partner.store_slug}`} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[#F5D67A]">
              View your store <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          )}
        </header>

        <ChoiceManager label={partner.choice_label} />

        <div>
          <h2 className="mb-2 px-1 font-semibold">Your earnings</h2>
          <PartnerStatementView partnerId={partner.id} percent={Number(partner.commission_percent)} />
        </div>
      </div>
    </MobileLayout>
  );
}
