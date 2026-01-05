import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PageLoaderProps {
  message?: string;
  className?: string;
}

export function PageLoader({ message = "Loading...", className }: PageLoaderProps) {
  return (
    <div className={cn(
      "flex flex-col items-center justify-center min-h-[50vh] gap-4",
      className
    )}>
      <div className="relative">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
      <p className="text-sm text-muted-foreground animate-pulse">{message}</p>
    </div>
  );
}

interface SpinnerProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-6 w-6",
    lg: "h-8 w-8",
  };

  return (
    <Loader2 className={cn("animate-spin text-primary", sizeClasses[size], className)} />
  );
}

interface SkeletonCardProps {
  className?: string;
  aspectRatio?: string;
}

export function SkeletonCard({ className, aspectRatio = "3/4" }: SkeletonCardProps) {
  return (
    <div className={cn("overflow-hidden rounded-lg", className)}>
      <div 
        className="w-full bg-muted skeleton-shimmer"
        style={{ aspectRatio }}
      />
      <div className="p-3 space-y-2">
        <div className="h-3 w-16 bg-muted rounded skeleton-shimmer" />
        <div className="h-4 w-full bg-muted rounded skeleton-shimmer" />
        <div className="h-5 w-20 bg-muted rounded skeleton-shimmer" />
      </div>
    </div>
  );
}

interface SkeletonListProps {
  count?: number;
  className?: string;
}

export function SkeletonList({ count = 3, className }: SkeletonListProps) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-3 rounded-lg">
          <div className="h-12 w-12 rounded-lg bg-muted skeleton-shimmer" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-muted rounded skeleton-shimmer" />
            <div className="h-3 w-1/2 bg-muted rounded skeleton-shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
