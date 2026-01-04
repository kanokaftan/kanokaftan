import { format } from "date-fns";
import { CheckCircle, ThumbsUp } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "./StarRating";
import { Review } from "@/hooks/useReviews";

interface ReviewCardProps {
  review: Review;
}

export function ReviewCard({ review }: ReviewCardProps) {
  const initials = review.user?.full_name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "U";

  return (
    <div className="rounded-xl bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10">
          <AvatarImage src={review.user?.avatar_url || undefined} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>

        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">{review.user?.full_name || "Anonymous"}</p>
              <div className="mt-0.5 flex items-center gap-2">
                <StarRating rating={review.rating} size="sm" />
                <span className="text-xs text-muted-foreground">
                  {format(new Date(review.created_at), "MMM d, yyyy")}
                </span>
              </div>
            </div>
            {review.order_item_id && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <CheckCircle className="h-3 w-3" />
                Verified
              </Badge>
            )}
          </div>

          {review.review_text && (
            <p className="mt-3 text-sm text-muted-foreground">{review.review_text}</p>
          )}

          {review.photos && review.photos.length > 0 && (
            <div className="mt-3 flex gap-2 overflow-x-auto">
              {review.photos.map((photo, index) => (
                <img
                  key={index}
                  src={photo}
                  alt={`Review photo ${index + 1}`}
                  className="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
                />
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            {review.fit_feedback && (
              <Badge variant="outline" className="text-xs">
                {review.fit_feedback === "true_to_size"
                  ? "True to Size"
                  : review.fit_feedback === "runs_small"
                  ? "Runs Small"
                  : "Runs Large"}
              </Badge>
            )}
            {review.would_recommend && (
              <Badge variant="outline" className="gap-1 text-xs text-green-600">
                <ThumbsUp className="h-3 w-3" />
                Recommends
              </Badge>
            )}
          </div>

          {review.seller_reply && (
            <div className="mt-3 rounded-lg bg-muted p-3">
              <p className="text-xs font-medium text-primary">Seller Response</p>
              <p className="mt-1 text-sm text-muted-foreground">{review.seller_reply}</p>
              {review.seller_replied_at && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(review.seller_replied_at), "MMM d, yyyy")}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
