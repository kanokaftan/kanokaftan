import { useCallback, useMemo, useState } from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useReviewableItems } from "@/hooks/useReviews";
import { WriteReviewSheet } from "./WriteReviewSheet";
import { cn } from "@/lib/utils";

/**
 * "Rate what you bought" card. Shows only when the signed-in buyer has
 * delivered items (from this shop / product / order) they haven't reviewed.
 */
export function ReviewPrompt({
  vendorId, productId, orderId, className,
}: { vendorId?: string; productId?: string; orderId?: string; className?: string }) {
  const { data = [] } = useReviewableItems({ vendorId, productId });
  const items = useMemo(() => (orderId ? data.filter((i) => i.order_id === orderId) : data), [data, orderId]);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);

  if (!items.length && !open) return null;

  const first = items[0];
  const title = items.length === 1 ? `How was your ${first.product_name}?` : `Rate your ${items.length} delivered items`;

  return (
    <>
      {items.length > 0 && (
        <div className={cn("flex items-center gap-3 rounded-2xl border border-border bg-muted p-3", className)}>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            <Star className="h-5 w-5 fill-current" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{title}</p>
            <p className="text-xs text-muted-foreground">Your review helps other shoppers and the seller.</p>
          </div>
          <Button size="sm" className="shrink-0 rounded-full" onClick={() => setOpen(true)}>
            Review
          </Button>
        </div>
      )}
      <WriteReviewSheet items={items} open={open} onClose={close} />
    </>
  );
}
