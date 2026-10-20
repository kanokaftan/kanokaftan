import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { BadgeCheck, Landmark, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useBanks, useBuyerBank, useVerifyBuyerBank } from "@/hooks/useBuyerTrust";
import { cn } from "@/lib/utils";

const ACCOUNT_NUMBER_LENGTH = 10;

/**
 * Link a bank account in your own name (checked with Paystack). It isn't used to pay you:
 * it proves one person = one account, which unlocks first-buyer prices and invite rewards.
 */
export function BuyerBankCard({ className, compact = false }: { className?: string; compact?: boolean }) {
  const { data: bank, isLoading } = useBuyerBank();
  const [open, setOpen] = useState(false);
  const { data: banks, isLoading: banksLoading, error: banksError } = useBanks(open);
  const verify = useVerifyBuyerBank();
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [problem, setProblem] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [params, setParams] = useSearchParams();
  const askedToConfirm = params.get("confirm_bank") === "1";

  // Opened from the "please confirm your account number" notification: go straight to the form.
  useEffect(() => {
    if (!askedToConfirm || !bank) return;
    if (bank.number_saved === false) {
      setConfirming(true);
      setOpen(true);
    }
    const next = new URLSearchParams(params);
    next.delete("confirm_bank");
    setParams(next, { replace: true });
  }, [askedToConfirm, bank, params, setParams]);

  if (isLoading) return <Skeleton className={cn("h-24 rounded-2xl", className)} />;

  if (bank && !confirming) {
    return (
      <div className={cn("rounded-2xl border border-green-600/30 bg-green-50 p-3 text-sm dark:bg-green-950/30", className)}>
        <div className="flex items-center gap-3">
          <BadgeCheck className="h-5 w-5 shrink-0 text-green-700 dark:text-green-400" />
          <div className="min-w-0">
            <p className="font-medium">Verified buyer</p>
            <p className="truncate text-xs text-muted-foreground">{bank.account_name} · {bank.bank_name} ••••{bank.last4}</p>
          </div>
        </div>
        {bank.number_saved === false && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-xl bg-background/70 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Please confirm your full account number once.</span>
            <button
              type="button"
              onClick={() => { setConfirming(true); setOpen(true); }}
              className="shrink-0 rounded-full bg-primary px-3 py-1 font-semibold text-primary-foreground"
            >
              Confirm
            </button>
          </div>
        )}
      </div>
    );
  }

  const submit = () => {
    setProblem(null);
    if (!bankCode || accountNumber.length !== ACCOUNT_NUMBER_LENGTH) {
      setProblem("Choose your bank and enter your 10-digit account number.");
      return;
    }
    verify.mutate(
      { bank_code: bankCode, account_number: accountNumber },
      {
        onSuccess: (result) => {
          toast.success("You're a verified buyer", { description: `${result.account_name} · ${result.bank_name}` });
          setAccountNumber("");
          setOpen(false);
          setConfirming(false);
        },
        onError: (error) => setProblem(error.message),
      },
    );
  };

  return (
    <div className={cn("rounded-2xl border bg-card p-4", className)}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ShieldCheck className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1 text-sm">
          <p className="font-semibold">Verify your account</p>
          <p className="text-muted-foreground">
            {compact
              ? "Link a bank account in your own name to unlock first-buyer prices."
              : "Link a bank account in your own name. It unlocks first-buyer prices, and it's how invites are counted. We never take money from it."}
          </p>
        </div>
      </div>

      {!open ? (
        <Button className="mt-3 w-full" variant="outline" onClick={() => setOpen(true)}><Landmark className="mr-2 h-4 w-4" />Verify with my bank account</Button>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="space-y-1.5">
            <Label>Bank</Label>
            {banksLoading ? (
              <Skeleton className="h-10" />
            ) : banksError ? (
              <p className="text-sm text-destructive">{(banksError as Error).message}</p>
            ) : (
              <Select value={bankCode} onValueChange={setBankCode}>
                <SelectTrigger><SelectValue placeholder="Choose your bank" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  {(banks ?? []).map((b) => <SelectItem key={b.code} value={b.code}>{b.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="buyer-acct">Account number</Label>
            <Input
              id="buyer-acct"
              inputMode="numeric"
              autoComplete="off"
              maxLength={ACCOUNT_NUMBER_LENGTH}
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, ACCOUNT_NUMBER_LENGTH))}
              placeholder="0123456789"
            />
          </div>
          {problem && (
            <p className="rounded-xl bg-destructive/10 p-2.5 text-sm text-destructive">
              {problem}
              {/profile first|Kano Kaftan name/i.test(problem) && (
                <> <Link to="/account" className="font-medium underline">Edit my name</Link></>
              )}
            </p>
          )}
          <p className="text-xs text-muted-foreground">The name on the account must match your Kano Kaftan name. One bank account can only be linked to one Kano Kaftan account.</p>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={verify.isPending}>Cancel</Button>
            <Button className="flex-1" onClick={submit} disabled={verify.isPending}>
              {verify.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Check and verify
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
