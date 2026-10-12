import { Star, ThumbsUp } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { StarRating } from "./StarRating";

interface ReviewSummaryProps {
  averageRating: number;
  totalReviews: number;
  recommendedPercent: number;
  distribution: Record<number, number>;
}

export function ReviewSummary({
  averageRating,
  totalReviews,
  recommendedPercent,
  distribution,
}: ReviewSummaryProps) {
  if (totalReviews === 0) {
    return (
      <div className="rounded-xl bg-card p-4 text-center shadow-sm">
        <Star className="mx-auto h-8 w-8 text-muted-foreground" />
        <p className="mt-2 font-medium">No reviews yet</p>
        <p className="text-sm text-muted-foreground">Be the first to review this product</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card p-4 shadow-sm">
      <div className="flex gap-6">
        {/* Average Rating */}
        <div className="text-center">
          <p className="font-display text-4xl font-bold">{averageRating.toFixed(1)}</p>
          <StarRating rating={averageRating} size="sm" />
          <p className="mt-1 text-xs text-muted-foreground">{totalReviews} reviews</p>
        </div>

        {/* Rating Distribution */}
        <div className="flex-1 space-y-1.5">
          {[5, 4, 3, 2, 1].map((stars) => {
            const count = distribution[stars] || 0;
            const percentage = totalReviews > 0 ? (count / totalReviews) * 100 : 0;

            return (
              <div key={stars} className="flex items-center gap-2 text-xs">
                <span className="w-3 text-muted-foreground">{stars}</span>
                <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                <Progress value={percentage} className="h-1.5 flex-1" />
                <span className="w-6 text-right text-muted-foreground">{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recommendation */}
      {recommendedPercent > 0 && (
        <div className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-green-50 p-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-400">
          <ThumbsUp className="h-4 w-4" />
          <span>{recommendedPercent}% of buyers recommend this product</span>
        </div>
      )}
    </div>
  );
}
