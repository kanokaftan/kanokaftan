import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Copy, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface PaymentsStatus {
  connected: boolean;
  mode: "live" | "test" | null;
  transfer_balance?: number;
  webhook_url: string;
  pending_payouts: number;
  payouts_waiting_for_bank_account: number;
  sellers_with_bank_account: number;
  problem: string | null;
}

/** Re-check every minute so the card turns green on its own once the key is added. */
const STATUS_REFRESH_MS = 60 * 1000;

const formatNaira = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);

async function fetchPaymentsStatus(): Promise<PaymentsStatus> {
  const { data, error } = await supabase.functions.invoke("payments-status", { body: {} });
  if (error) {
    let message = "Could not check payments. Please try again.";
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      try {
        const body = await context.clone().json();
        if (typeof body?.error === "string") message = body.error;
      } catch {
        // Not JSON; keep the generic message.
      }
    }
    console.error("[PaymentsStatusCard] payments-status failed", error);
    throw new Error(message);
  }
  if (!data?.success) throw new Error(data?.error || "Could not check payments");
  return data as PaymentsStatus;
}

/** Shows whether Paystack is connected and what is still needed for checkout and payouts. */
export function PaymentsStatusCard() {
  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["admin-payments-status"],
    queryFn: fetchPaymentsStatus,
    refetchInterval: STATUS_REFRESH_MS,
    retry: 1,
  });

  const copyWebhook = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.webhook_url);
      toast.success("Webhook URL copied");
    } catch (copyError) {
      console.error("[PaymentsStatusCard] copy failed", copyError);
      toast.error("Couldn't copy. Select the text and copy it instead.");
    }
  };

  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            Payments (Paystack)
            {data && (
              <Badge variant={data.connected ? "default" : "destructive"} className="rounded-full">
                {data.connected ? `Connected · ${data.mode === "live" ? "Live" : "Test mode"}` : "Not connected"}
              </Badge>
            )}
          </CardTitle>
          <CardDescription className="text-xs">Checkout, seller fees, bank details and payouts all use this.</CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => refetch()} disabled={isFetching} aria-label="Check again">
          <RefreshCw className={isFetching ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : error ? (
          <p className="text-destructive">{(error as Error).message}</p>
        ) : data ? (
          <>
            {data.connected ? (
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  Payments are on. Available for payouts: <strong>{formatNaira(data.transfer_balance ?? 0)}</strong>
                </span>
              </div>
            ) : (
              <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium">{data.problem}</p>
                  <p>
                    Add <code>PAYSTACK_SECRET_KEY</code> in Supabase → Edge Functions → Secrets. Everything switches on by itself
                    within a minute; nothing needs redeploying.
                  </p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="rounded-xl bg-muted p-2">
                <p className="text-lg font-semibold">{data.pending_payouts}</p>
                <p className="text-[11px] text-muted-foreground">Payouts ready to send</p>
              </div>
              <div className="rounded-xl bg-muted p-2">
                <p className="text-lg font-semibold">{data.payouts_waiting_for_bank_account}</p>
                <p className="text-[11px] text-muted-foreground">Waiting for seller's bank</p>
              </div>
              <div className="rounded-xl bg-muted p-2">
                <p className="text-lg font-semibold">{data.sellers_with_bank_account}</p>
                <p className="text-[11px] text-muted-foreground">Sellers with bank added</p>
              </div>
            </div>

            <div>
              <p className="mb-1 text-xs text-muted-foreground">Webhook URL (paste into Paystack → Settings → API Keys & Webhooks)</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-muted px-2 py-1.5 text-xs">{data.webhook_url}</code>
                <Button variant="outline" size="icon" className="h-8 w-8 shrink-0" onClick={copyWebhook} aria-label="Copy webhook URL">
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
