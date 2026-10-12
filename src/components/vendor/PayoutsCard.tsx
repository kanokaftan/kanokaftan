import { format } from "date-fns";
import { Wallet } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { payoutStatusLabels, useVendorPayouts, PayoutStatus } from "@/hooks/usePayouts";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);
}

const statusVariant: Record<PayoutStatus, "default" | "secondary" | "destructive" | "outline"> = {
  held: "secondary",
  on_hold: "destructive",
  pending: "outline",
  processing: "outline",
  paid: "default",
  failed: "destructive",
  cancelled: "secondary",
};

export function PayoutsCard({ vendorId }: { vendorId: string }) {
  const { data: payouts, isLoading } = useVendorPayouts(vendorId);

  const paid = payouts?.filter((p) => p.status === "paid").reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const upcoming = payouts
    ?.filter((p) => ["held", "pending", "processing"].includes(p.status))
    .reduce((sum, p) => sum + Number(p.amount), 0) ?? 0;
  const needsBankAccount = payouts?.some((p) => p.status === "pending" && p.failure_reason?.includes("bank account"));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base md:text-lg flex items-center gap-2">
          <Wallet className="h-4 w-4 md:h-5 md:w-5" />
          Payouts
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Paid so far: <span className="font-medium text-foreground">{formatPrice(paid)}</span> · Coming:{" "}
          <span className="font-medium text-foreground">{formatPrice(upcoming)}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {needsBankAccount && (
          <p className="rounded-md bg-amber-50 p-2 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-100">
            You have money waiting. Add your bank account in Settings to receive it.
          </p>
        )}
        {isLoading ? (
          <Skeleton className="h-16 w-full" />
        ) : !payouts?.length ? (
          <p className="text-sm text-muted-foreground">No payouts yet.</p>
        ) : (
          payouts.slice(0, 10).map((payout) => (
            <div key={payout.id} className="flex items-center justify-between gap-2 border-b py-2 text-sm last:border-0">
              <div>
                <p className="font-medium">
                  Order #{payout.order_id.slice(0, 8)} · part {payout.tranche} of 2
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(payout.paid_at ?? payout.created_at), "MMM d, yyyy")}
                  {payout.tranche === 1 && Number(payout.commission_amount) > 0 &&
                    ` · ${payout.commission_percent}% commission: ${formatPrice(Number(payout.commission_amount))}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-medium">{formatPrice(Number(payout.amount))}</p>
                <Badge variant={statusVariant[payout.status]} className="text-[10px]">
                  {payoutStatusLabels[payout.status]}
                </Badge>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
