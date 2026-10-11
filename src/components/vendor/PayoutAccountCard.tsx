import { useMemo, useState } from "react";
import { AlertTriangle, Check, CheckCircle2, ChevronsUpDown, CreditCard, Landmark, Loader2, Search, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { PayoutsNotConfiguredError, useBanks, useResolveAccount, useVendorPayoutAccount } from "@/hooks/usePayouts";
import { BANK_ALIASES, type Bank } from "@/lib/nigerianBanks";
import { cn } from "@/lib/utils";

const ACCOUNT_NUMBER_LENGTH = 10;

/** Matches the bank's name or a common short name ("gtb", "uba", "opay"...). */
function matchesBank(bank: Bank, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const haystack = `${bank.name} ${BANK_ALIASES[bank.code] ?? ""}`.toLowerCase();
  return q.split(/\s+/).every((word) => haystack.includes(word));
}

/** Searchable list of Nigerian banks. */
function BankPicker({ banks, value, onChange }: { banks: Bank[]; value: string; onChange: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = banks.find((b) => b.code === value);
  const results = useMemo(() => banks.filter((b) => matchesBank(b, search)), [banks, search]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSearch("");
      }}
    >
      <PopoverTrigger asChild>
        <Button type="button" variant="outline" role="combobox" aria-expanded={open} className="h-11 w-full justify-between rounded-xl font-normal">
          <span className={cn("flex min-w-0 items-center gap-2 truncate", !selected && "text-muted-foreground")}>
            <Landmark className="h-4 w-4 shrink-0" />
            <span className="truncate">{selected ? selected.name : "Search and select your bank"}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[280px] rounded-2xl p-0" align="start">
        <div className="flex items-center gap-2 border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type your bank, e.g. GTB, Opay, Zenith"
            className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            aria-label="Search banks"
          />
        </div>
        <ul role="listbox" className="max-h-72 overflow-y-auto overscroll-contain py-1" data-no-pull-refresh>
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-muted-foreground">No bank matches "{search}"</li>
          ) : (
            results.map((bank) => (
              <li key={bank.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={bank.code === value}
                  onClick={() => {
                    onChange(bank.code);
                    setOpen(false);
                    setSearch("");
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted active:bg-muted"
                >
                  <Check className={cn("h-4 w-4 shrink-0", bank.code === value ? "opacity-100" : "opacity-0")} />
                  {bank.name}
                </button>
              </li>
            ))
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** Bank account vendors are paid into. Verified with the bank through Paystack before saving. */
export function PayoutAccountCard({ vendorId }: { vendorId: string }) {
  const { account, isLoading, saveAccount } = useVendorPayoutAccount(vendorId);
  const [editing, setEditing] = useState(false);
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const showForm = editing || (!isLoading && !account);
  const { banks, notConfigured, notConfiguredMessage } = useBanks(showForm);
  const complete = !!bankCode && accountNumber.length === ACCOUNT_NUMBER_LENGTH;
  const lookup = useResolveAccount(bankCode, accountNumber, showForm && complete && !notConfigured);

  const handleSave = async () => {
    try {
      const result = await saveAccount.mutateAsync({ bank_code: bankCode, account_number: accountNumber });
      toast.success(`Saved: ${result.account_name}, ${result.bank_name}`);
      setEditing(false);
      setAccountNumber("");
      setBankCode("");
    } catch (error: unknown) {
      console.error("[PayoutAccountCard] save failed", error);
      toast.error(error instanceof Error ? error.message : "Could not save bank account");
    }
  };

  const lookupBlocked = lookup.error instanceof PayoutsNotConfiguredError;
  // Only once the bank has confirmed the account name (the seller sees whose account it is first).
  const canSave = complete && !!lookup.data && !lookup.isFetching && !saveAccount.isPending && !notConfigured && !lookupBlocked;

  return (
    <Card>
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="flex items-center gap-2 text-base md:text-lg">
          <CreditCard className="h-4 w-4 md:h-5 md:w-5" />
          Payout Account
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">
          You get half of each sale (after commission) when the customer pays, and the rest when they confirm delivery.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : !showForm && account ? (
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-600" />
              <div className="text-sm">
                <p className="font-medium">{account.account_name}</p>
                <p className="text-muted-foreground">
                  {account.bank_name} · ****{account.account_number.slice(-4)}
                </p>
              </div>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(true)}>
              Change
            </Button>
          </div>
        ) : (
          <>
            {(notConfigured || lookupBlocked) && (
              <div className="flex gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <p>{notConfiguredMessage ?? (lookup.error as Error)?.message}</p>
              </div>
            )}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-sm">Bank</Label>
                <BankPicker banks={banks} value={bankCode} onChange={setBankCode} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="payout_account_number" className="text-sm">
                  Account number
                </Label>
                <Input
                  id="payout_account_number"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={ACCOUNT_NUMBER_LENGTH}
                  value={accountNumber}
                  onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ""))}
                  placeholder="10-digit NUBAN"
                  className="h-11 rounded-xl text-base tracking-wider"
                />
              </div>
            </div>

            {/* The name the bank has for this account, so sellers can see it's right before saving */}
            {complete && !notConfigured && !lookupBlocked && (
              <div
                className={cn(
                  "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm animate-in fade-in-0 slide-in-from-top-1",
                  lookup.isError ? "bg-destructive/10 text-destructive" : "bg-muted",
                )}
                aria-live="polite"
              >
                {lookup.isFetching ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" /> Checking with the bank…
                  </>
                ) : lookup.isError ? (
                  <>
                    <XCircle className="h-4 w-4 shrink-0" /> {(lookup.error as Error).message}
                  </>
                ) : lookup.data ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
                    <span className="font-semibold uppercase tracking-wide">{lookup.data}</span>
                  </>
                ) : null}
              </div>
            )}

            <div className="flex gap-2">
              {account && (
                <Button type="button" variant="outline" onClick={() => setEditing(false)}>
                  Cancel
                </Button>
              )}
              <Button type="button" className="flex-1" onClick={handleSave} disabled={!canSave}>
                {saveAccount.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving…
                  </>
                ) : lookup.data ? (
                  `Save ${lookup.data.split(" ")[0]}'s account`
                ) : (
                  "Save bank account"
                )}
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
