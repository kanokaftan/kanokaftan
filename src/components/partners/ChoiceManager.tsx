import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Award, Loader2, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAwardChoice, usePartnerChoices, usePartnerFindShops, useWithdrawChoice, type ChoiceShop } from "@/hooks/usePartners";

const SEARCH_DELAY_MS = 300;
const NOTE_MAX = 200;

function ShopAvatar({ shop }: { shop: Pick<ChoiceShop, "avatar_url" | "store_name"> }) {
  return (
    <Avatar className="h-11 w-11 shrink-0">
      <AvatarImage src={shop.avatar_url || undefined} alt="" loading="lazy" />
      <AvatarFallback className="bg-primary font-bold text-primary-foreground">{shop.store_name.charAt(0)}</AvatarFallback>
    </Avatar>
  );
}

/** Search shops and give one the partner's label, with an optional note. */
function AwardSheet({ open, onOpenChange, partnerId, label, alreadyPicked }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId?: string | null;
  label: string;
  alreadyPicked: Set<string>;
}) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<ChoiceShop | null>(null);
  const [note, setNote] = useState("");
  const { data: shops, isFetching } = usePartnerFindShops(search, open);
  const award = useAwardChoice(partnerId);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input]);

  const close = () => {
    onOpenChange(false);
    setChosen(null);
    setNote("");
    setInput("");
  };

  const submit = () => {
    if (!chosen) return;
    award.mutate(
      { vendorId: chosen.vendor_id, note: note.trim() },
      {
        onSuccess: () => {
          toast.success(`${chosen.store_name} is now ${label}`);
          close();
        },
        onError: (error) => toast.error(error.message),
      },
    );
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <SheetContent side="bottom" className="flex max-h-[88dvh] flex-col rounded-t-3xl p-0">
        <SheetHeader className="border-b px-5 pb-3 pt-5 text-left">
          <SheetTitle>Give "{label}"</SheetTitle>
          <SheetDescription>Pick a tailor or seller you trust. The label shows on their shop and in the shop list.</SheetDescription>
        </SheetHeader>

        {chosen ? (
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex items-center gap-3 rounded-2xl border p-3">
              <ShopAvatar shop={chosen} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{chosen.store_name}</p>
                {chosen.city && <p className="text-xs text-muted-foreground">{chosen.city}</p>}
              </div>
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setChosen(null)}>Change</Button>
            </div>
            <div>
              <label htmlFor="choice-note" className="text-sm font-medium">Why you picked them (optional)</label>
              <Input
                id="choice-note"
                value={note}
                maxLength={NOTE_MAX}
                onChange={(e) => setNote(e.target.value)}
                placeholder="e.g. Neat embroidery, always on time"
                className="mt-1.5 h-11 rounded-xl"
              />
            </div>
            <Button className="h-12 w-full rounded-full" onClick={submit} disabled={award.isPending}>
              {award.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Award className="mr-2 h-4 w-4" />}
              Give the label
            </Button>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="relative px-5 pt-4">
              <Search className="absolute left-8 top-1/2 mt-2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="search"
                autoFocus
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Search shop name or town"
                className="h-11 rounded-full pl-9"
                aria-label="Search shops"
              />
            </div>
            <ul className="mt-2 flex-1 overflow-y-auto px-3 pb-6">
              {(shops ?? []).map((shop) => {
                const picked = alreadyPicked.has(shop.vendor_id);
                return (
                  <li key={shop.vendor_id}>
                    <button
                      type="button"
                      disabled={picked}
                      onClick={() => setChosen(shop)}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-2 text-left active:bg-muted disabled:opacity-50"
                    >
                      <ShopAvatar shop={shop} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold">{shop.store_name}</p>
                        <p className="text-xs text-muted-foreground">{picked ? `Already ${label}` : shop.city || "Shop"}</p>
                      </div>
                    </button>
                  </li>
                );
              })}
              {!isFetching && shops?.length === 0 && (
                <li className="py-10 text-center text-sm text-muted-foreground">No shops match "{search}".</li>
              )}
              {isFetching && !shops && <li className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></li>}
            </ul>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** The shops carrying a partner's label, with add and withdraw. Used by the partner and by admins. */
export function ChoiceManager({ partnerId, label }: { partnerId?: string | null; label: string }) {
  const { data: picks, isLoading, isError, refetch } = usePartnerChoices(partnerId);
  const withdraw = useWithdrawChoice(partnerId);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<ChoiceShop | null>(null);
  const pickedIds = new Set((picks ?? []).map((p) => p.vendor_id));

  const confirmRemove = () => {
    if (!removing) return;
    withdraw.mutate(removing.vendor_id, {
      onSuccess: () => toast.success(`Removed "${label}" from ${removing.store_name}`),
      onError: (error) => toast.error(error.message),
      onSettled: () => setRemoving(null),
    });
  };

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex items-center justify-between gap-3 border-b p-3.5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-1.5 font-semibold"><Award className="h-4 w-4 text-[#9A7400]" />{label}</h2>
          <p className="text-xs text-muted-foreground">{picks?.length ?? 0} shop{picks?.length === 1 ? "" : "s"} picked</p>
        </div>
        <Button size="sm" className="shrink-0 rounded-full" onClick={() => setAdding(true)}>
          <Plus className="mr-1 h-4 w-4" />Add shop
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2 p-3.5">{[0, 1].map((i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
      ) : isError ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          Couldn't load your picks. <button type="button" className="font-medium underline" onClick={() => refetch()}>Try again</button>
        </div>
      ) : !picks?.length ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          No shops yet. Tap <span className="font-medium text-foreground">Add shop</span> to recommend a tailor or seller.
        </p>
      ) : (
        <ul className="divide-y">
          {picks.map((shop) => (
            <li key={shop.vendor_id} className="flex items-center gap-3 p-3">
              <ShopAvatar shop={shop} />
              <div className="min-w-0 flex-1">
                {shop.store_slug ? (
                  <Link to={`/shop/${shop.store_slug}`} className="block truncate text-sm font-semibold hover:underline">{shop.store_name}</Link>
                ) : (
                  <p className="truncate text-sm font-semibold">{shop.store_name}</p>
                )}
                <p className="truncate text-xs text-muted-foreground">{shop.note || shop.city || "Picked"}</p>
              </div>
              <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0 rounded-full text-muted-foreground" onClick={() => setRemoving(shop)} aria-label={`Remove label from ${shop.store_name}`}>
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}

      <AwardSheet open={adding} onOpenChange={setAdding} partnerId={partnerId} label={label} alreadyPicked={pickedIds} />

      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-2xl md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{label}"?</AlertDialogTitle>
            <AlertDialogDescription>{removing?.store_name} will no longer show your label. You can give it again later.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
