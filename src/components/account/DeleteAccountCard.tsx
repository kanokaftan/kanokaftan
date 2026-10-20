import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { invokeFunction } from "@/lib/invokeFunction";
import { k2 } from "@/lib/k2";
import { signOutThisDevice } from "@/lib/signOut";

const CONFIRM_WORD = "DELETE";

interface DeletionStatus {
  can_delete: boolean;
  blockers: { code: string; message: string }[];
  k2_balance: number;
  keeps_records: boolean;
  has_shop: boolean;
}

function useDeletionStatus(enabled: boolean) {
  return useQuery({
    queryKey: ["account-deletion-status"],
    enabled,
    staleTime: 0,
    queryFn: async () => {
      const result = await invokeFunction<{ status: DeletionStatus }>("delete-account", { action: "status" }, "Couldn't check your account.");
      return result.status;
    },
  });
}

function useDeleteAccount() {
  return useMutation({
    mutationFn: (confirm: string) =>
      invokeFunction<{ mode: "deleted" | "anonymised" }>("delete-account", { action: "delete", confirm }, "Couldn't delete your account. Please try again."),
  });
}

/** What happens when you delete, then a typed confirmation. */
function DeleteSheet({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: status, isLoading, error, refetch } = useDeletionStatus(open);
  const remove = useDeleteAccount();
  const [typed, setTyped] = useState("");
  const ready = typed.trim().toUpperCase() === CONFIRM_WORD;

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync(CONFIRM_WORD);
      toast.success("Your account has been deleted", { description: "Thank you for using Kano Kaftan." });
      await signOutThisDevice({ redirectTo: "/" });
    } catch (e) {
      console.error("[DeleteAccount] delete failed", e);
      toast.error(e instanceof Error ? e.message : "Couldn't delete your account.");
      refetch();
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!remove.isPending) { onOpenChange(next); setTyped(""); } }}>
      <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1.5rem)]">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-destructive" />Delete my account</SheetTitle>
          <SheetDescription>This can't be undone.</SheetDescription>
        </SheetHeader>

        {isLoading ? (
          <div className="mt-4 space-y-2"><Skeleton className="h-16 rounded-xl" /><Skeleton className="h-24 rounded-xl" /></div>
        ) : error ? (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            <p className="text-destructive">{error instanceof Error ? error.message : "Couldn't check your account."}</p>
            <Button size="sm" variant="outline" className="mt-2" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : status && !status.can_delete ? (
          <div className="mt-4 space-y-2">
            <p className="text-sm font-medium">You can't delete your account yet:</p>
            {status.blockers.map((b) => (
              <p key={b.code} className="flex items-start gap-2 rounded-xl bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-100">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />{b.message}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">Need help? Message Kano Kaftan from the chat and we'll sort it out with you.</p>
          </div>
        ) : status ? (
          <div className="mt-4 space-y-3 text-sm">
            <ul className="space-y-1.5 rounded-xl bg-muted/50 p-3">
              <li>• Your name, email, phone, addresses, bank details and photos are removed.</li>
              <li>• Your chats, favourites, follows and reviews are removed.</li>
              {status.has_shop && <li>• Your shop and its products are taken down.</li>}
              {status.k2_balance > 0 && <li className="font-medium text-destructive">• You lose your {k2(status.k2_balance)} balance.</li>}
              {status.keeps_records && (
                <li>• Past orders and payments stay in Kano Kaftan's records without your name, because we must keep them for accounting.</li>
              )}
              <li>• You'll be signed out and can't sign in to this account again.</li>
            </ul>
            <div className="space-y-1.5">
              <Label htmlFor="confirm-delete">Type {CONFIRM_WORD} to confirm</Label>
              <Input id="confirm-delete" value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" placeholder={CONFIRM_WORD} />
            </div>
            <Button variant="destructive" className="h-12 w-full rounded-full" disabled={!ready || remove.isPending} onClick={confirmDelete}>
              {remove.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete my account for good
            </Button>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

/** Small "Delete my account" entry for the bottom of Account settings. */
export function DeleteAccountButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? "mx-auto block py-2 text-sm text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"}>
        Delete my account
      </button>
      <DeleteSheet open={open} onOpenChange={setOpen} />
    </>
  );
}
