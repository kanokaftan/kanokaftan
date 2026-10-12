import { useEffect, useState } from "react";
import { ChevronLeft, Loader2, Package, Star, ThumbsDown, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useReviews, type CreateReviewData, type ReviewableItem } from "@/hooks/useReviews";
import { friendlyError } from "@/hooks/useShopFans";
import { cn } from "@/lib/utils";

/** Same limit as the database keeps (review_text_limit). */
const MAX_REVIEW_LENGTH = 2000;
const STAR_LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];
const FIT_OPTIONS: { value: NonNullable<CreateReviewData["fit_feedback"]>; label: string }[] = [
  { value: "runs_small", label: "Runs small" },
  { value: "true_to_size", label: "True to size" },
  { value: "runs_large", label: "Runs large" },
];

function ItemRow({ item, onClick }: { item: ReviewableItem; onClick?: () => void }) {
  const body = (
    <>
      <span className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted">
        {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <Package className="m-4 h-6 w-6 text-muted-foreground" />}
      </span>
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[15px] font-medium">{item.product_name}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {[item.variant, item.store_name].filter(Boolean).join(" · ") || "Delivered"}
        </span>
      </span>
    </>
  );
  return onClick ? (
    <button type="button" onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2.5 active:bg-muted/70">
      {body}
      <span className="flex shrink-0 gap-0.5 text-muted-foreground/40" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((i) => <Star key={i} className="h-3.5 w-3.5" />)}
      </span>
    </button>
  ) : (
    <div className="flex items-center gap-3">{body}</div>
  );
}

/**
 * Bottom sheet for reviewing delivered items. With several items it first asks
 * which one; after sending it moves on to the next unreviewed item.
 */
export function WriteReviewSheet({ items, open, onClose }: { items: ReviewableItem[]; open: boolean; onClose: () => void }) {
  const { createReview } = useReviews();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  const [fit, setFit] = useState<CreateReviewData["fit_feedback"]>();
  const [recommend, setRecommend] = useState(true);

  const selected = items.find((i) => i.order_item_id === selectedId) ?? (items.length === 1 ? items[0] : null);

  const resetForm = () => {
    setRating(0);
    setText("");
    setFit(undefined);
    setRecommend(true);
  };

  useEffect(() => {
    if (!open) {
      setSelectedId(null);
      resetForm();
    }
  }, [open]);

  // The item we just reviewed drops out of the list; close when nothing is left.
  useEffect(() => {
    if (open && items.length === 0) onClose();
  }, [open, items.length, onClose]);

  const submit = async () => {
    if (!selected || rating === 0) return;
    try {
      await createReview.mutateAsync({
        product_id: selected.product_id,
        order_item_id: selected.order_item_id,
        rating,
        review_text: text.trim() || undefined,
        fit_feedback: fit,
        would_recommend: recommend,
      });
      toast.success("Thank you! Your review is live.");
      setSelectedId(null);
      resetForm();
    } catch (error) {
      console.error("[WriteReviewSheet] review failed", { productId: selected.product_id, error });
      toast.error(friendlyError(error, "Couldn't send your review. Please try again."));
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent side="bottom" className="max-h-[92dvh] overflow-y-auto rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {!selected ? (
          <>
            <SheetHeader className="text-left">
              <SheetTitle>Write a review</SheetTitle>
              <SheetDescription>Which item would you like to review?</SheetDescription>
            </SheetHeader>
            <div className="mt-4 overflow-hidden rounded-2xl border bg-card">
              {items.map((item) => (
                <div key={item.order_item_id} className="border-b border-border/60 last:border-b-0">
                  <ItemRow item={item} onClick={() => setSelectedId(item.order_item_id)} />
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <SheetHeader className="text-left">
              <div className="flex items-center gap-2">
                {items.length > 1 && (
                  <button type="button" onClick={() => { setSelectedId(null); resetForm(); }} className="-ml-2 rounded-full p-1.5 active:bg-muted" aria-label="Choose another item">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                )}
                <SheetTitle>Rate your item</SheetTitle>
              </div>
              <SheetDescription className="sr-only">Give stars and tell other shoppers what you think.</SheetDescription>
            </SheetHeader>

            <div className="mt-3 rounded-2xl bg-muted/50 p-3">
              <ItemRow item={selected} />
            </div>

            <div className="mt-5 flex flex-col items-center">
              <div role="radiogroup" aria-label="Your rating" className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={rating === n}
                    aria-label={`${n} star${n === 1 ? "" : "s"}: ${STAR_LABELS[n - 1]}`}
                    onClick={() => setRating(n)}
                    className="rounded-full p-1 transition-transform active:scale-90"
                  >
                    <Star className={cn("h-10 w-10 transition-colors", n <= rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30")} />
                  </button>
                ))}
              </div>
              <p className="mt-1 h-5 text-sm font-medium text-muted-foreground">{rating ? STAR_LABELS[rating - 1] : "Tap the stars"}</p>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <Textarea
                  value={text}
                  onChange={(e) => setText(e.target.value.slice(0, MAX_REVIEW_LENGTH))}
                  placeholder="What did you like? How was the quality and delivery? (optional)"
                  rows={4}
                  className="rounded-2xl text-[15px]"
                  aria-label="Your review"
                />
                {text.length > MAX_REVIEW_LENGTH * 0.8 && (
                  <p className="mt-1 text-right text-xs text-muted-foreground">{text.length}/{MAX_REVIEW_LENGTH}</p>
                )}
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">How did it fit? (optional)</p>
                <div className="flex flex-wrap gap-2">
                  {FIT_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setFit(fit === o.value ? undefined : o.value)}
                      aria-pressed={fit === o.value}
                      className={cn("rounded-full border px-3 py-1.5 text-sm transition-colors", fit === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">Would you recommend it?</p>
                <div className="grid grid-cols-2 gap-2">
                  {[true, false].map((value) => (
                    <button
                      key={String(value)}
                      type="button"
                      onClick={() => setRecommend(value)}
                      aria-pressed={recommend === value}
                      className={cn("flex items-center justify-center gap-2 rounded-full border py-2 text-sm transition-colors", recommend === value ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
                    >
                      {value ? <ThumbsUp className="h-4 w-4" /> : <ThumbsDown className="h-4 w-4" />}
                      {value ? "Yes" : "No"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Button className="mt-6 h-12 w-full rounded-full text-base" onClick={submit} disabled={rating === 0 || createReview.isPending}>
              {createReview.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {rating === 0 ? "Choose a star rating" : "Post review"}
            </Button>
            <p className="mt-2 text-center text-xs text-muted-foreground">Your first name is shown with your review.</p>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
