import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { Loader2, MessageSquareReply, Package, Pencil, Star, ThumbsUp } from "lucide-react";
import { toast } from "sonner";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { friendlyError, useMyFanSummary, useMyShopReviews, useReplyToReview, type MyShopReview } from "@/hooks/useShopFans";
import { cn } from "@/lib/utils";

/** Same limit as the database keeps (review_text_limit). */
const MAX_REPLY_LENGTH = 2000;
const FIT_LABELS: Record<string, string> = {
  true_to_size: "True to size",
  runs_small: "Runs small",
  runs_large: "Runs large",
};

type Filter = "all" | "unanswered" | "low";
const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unanswered", label: "Needs reply" },
  { value: "low", label: "1–3 stars" },
];
const LOW_RATING = 3;

function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <span className={cn("flex gap-0.5", className)} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className={cn("h-3.5 w-3.5", n <= rating ? "fill-foreground text-foreground" : "text-muted-foreground/30")} />
      ))}
    </span>
  );
}

function ReviewItem({ review }: { review: MyShopReview }) {
  const reply = useReplyToReview();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(review.seller_reply ?? "");

  const send = async () => {
    const text = draft.trim();
    if (!text) return;
    try {
      await reply.mutateAsync({ reviewId: review.id, reply: text });
      toast.success(review.seller_reply ? "Reply updated" : "Reply posted. The customer has been told.");
      setEditing(false);
    } catch (error) {
      console.error("[VendorReviews] reply failed", { reviewId: review.id, error });
      toast.error(friendlyError(error, "Couldn't post your reply. Please try again."));
    }
  };

  const showBox = editing || !review.seller_reply;

  return (
    <li className="rounded-2xl border bg-card p-3.5">
      <Link to={`/products/${review.product_slug}`} className="flex items-center gap-2.5">
        <span className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-muted">
          {review.product_image ? <img src={review.product_image} alt="" className="h-full w-full object-cover" /> : <Package className="m-2.5 h-5 w-5 text-muted-foreground" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium">{review.product_name}</span>
      </Link>

      <div className="mt-3 flex items-start gap-2.5">
        <Avatar className="h-8 w-8">
          <AvatarImage src={review.reviewer_avatar || undefined} alt="" />
          <AvatarFallback className="text-xs">{review.reviewer_name.charAt(0).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-sm font-semibold">{review.reviewer_name}</p>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatDistanceToNowStrict(new Date(review.created_at), { addSuffix: true })}
            </span>
          </div>
          <Stars rating={review.rating} className="mt-0.5" />
          {review.review_text && <p className="mt-1.5 whitespace-pre-line text-[15px]">{review.review_text}</p>}
          {(review.fit_feedback || review.would_recommend) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {review.fit_feedback && FIT_LABELS[review.fit_feedback] && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px]">{FIT_LABELS[review.fit_feedback]}</span>
              )}
              {review.would_recommend && (
                <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] text-foreground">
                  <ThumbsUp className="h-3 w-3" />Recommends
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {review.seller_reply && !editing && (
        <div className="mt-3 rounded-xl bg-muted/70 p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold text-primary">Your reply</p>
            <button type="button" onClick={() => { setDraft(review.seller_reply ?? ""); setEditing(true); }} className="flex items-center gap-1 text-xs text-muted-foreground active:opacity-60">
              <Pencil className="h-3 w-3" />Edit
            </button>
          </div>
          <p className="mt-1 whitespace-pre-line text-sm">{review.seller_reply}</p>
        </div>
      )}

      {showBox && (
        <div className="mt-3 space-y-2">
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_REPLY_LENGTH))}
            placeholder={review.rating <= LOW_RATING ? "Say sorry and how you'll make it right…" : "Thank the customer…"}
            rows={2}
            className="rounded-xl text-[15px]"
            aria-label={`Reply to ${review.reviewer_name}`}
          />
          <div className="flex justify-end gap-2">
            {editing && (
              <Button variant="ghost" size="sm" className="rounded-full" onClick={() => setEditing(false)}>Cancel</Button>
            )}
            <Button size="sm" className="rounded-full" onClick={send} disabled={!draft.trim() || reply.isPending}>
              {reply.isPending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <MessageSquareReply className="mr-1.5 h-3.5 w-3.5" />}
              {review.seller_reply ? "Save reply" : "Reply"}
            </Button>
          </div>
        </div>
      )}
    </li>
  );
}

/** Seller: every review on their products, with a reply box. Unanswered ones first. */
export default function VendorReviews() {
  const { userId } = useVendorAuth();
  const { data: summary } = useMyFanSummary(!!userId);
  const { data: reviews, isLoading, isError, refetch } = useMyShopReviews();
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => (reviews ?? []).filter((r) =>
    filter === "unanswered" ? !r.seller_reply : filter === "low" ? r.rating <= LOW_RATING : true,
  ), [reviews, filter]);

  return (
    <VendorLayout title="Reviews">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
          <div className="text-center">
            <p className="text-3xl font-bold tabular-nums">{summary?.rating != null ? summary.rating.toFixed(1) : "–"}</p>
            <Stars rating={Math.round(summary?.rating ?? 0)} className="justify-center" />
          </div>
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">{summary?.reviews ?? 0} review{summary?.reviews === 1 ? "" : "s"}</p>
            <p className="text-muted-foreground">
              {summary?.awaiting_reply ? `${summary.awaiting_reply} waiting for your reply` : "You've replied to everyone"}
            </p>
          </div>
        </div>

        <div role="tablist" aria-label="Filter reviews" className="grid grid-cols-3 rounded-full bg-muted p-1">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn("h-9 rounded-full text-xs font-medium transition-all", filter === f.value ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {f.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Couldn't load your reviews.</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : !visible.length ? (
          <div className="rounded-2xl border bg-card px-6 py-8 text-center">
            <Star className="mx-auto h-8 w-8 text-muted-foreground/50" />
            <p className="mt-3 font-medium">{reviews?.length ? "Nothing here" : "No reviews yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {reviews?.length
                ? "No reviews match this filter."
                : "Customers are asked to review items once they're delivered. Their reviews show up here."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {visible.map((review) => <ReviewItem key={review.id} review={review} />)}
          </ul>
        )}
      </div>
    </VendorLayout>
  );
}
