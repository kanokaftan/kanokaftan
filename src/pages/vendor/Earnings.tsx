import { Link } from "react-router-dom";
import { ChevronRight, ShieldCheck, Wallet } from "lucide-react";
import { VendorLayout } from "@/components/vendor/VendorLayout";
import { HowYouEarn } from "@/components/vendor/HowYouEarn";

/** Seller: the three ways to earn on Kano Kaftan and what we keep in each. */
export default function VendorEarnings() {
  return (
    <VendorLayout title="How you earn">
      <div className="mx-auto max-w-lg space-y-4">
        <p className="text-sm text-muted-foreground">
          There are three ways to sell on Kano Kaftan. Delivery fees are paid by the customer and kept by Kano Kaftan for
          delivery; they never come out of your price.
        </p>
        <HowYouEarn />
        <div className="space-y-2 rounded-2xl border bg-card p-4 text-sm">
          <p className="flex items-start gap-2">
            <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>
              For ways 1 and 2, money goes straight to your bank account: half when the customer pays, the rest once the
              order is delivered.
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span>Orders through Kano Kaftan come with buyer protection, which helps customers trust your shop.</span>
          </p>
        </div>
        <Link to="/vendor/settings" className="flex items-center justify-between rounded-2xl border bg-card px-4 py-3 text-sm font-medium active:bg-muted/60">
          Check your bank account for payouts
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      </div>
    </VendorLayout>
  );
}
