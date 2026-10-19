import { Gift } from "lucide-react";
import { cn } from "@/lib/utils";
import { firstBuyerPrice, useFirstBuyerStatus } from "@/hooks/useBuyerTrust";
import { naira } from "@/lib/naira";

interface Props {
  price: number;
  percent: number | null | undefined;
  size?: "xs" | "sm" | "md";
  className?: string;
}

const SIZE_CLASSES = {
  xs: "text-[10px] gap-1",
  sm: "text-xs gap-1",
  md: "text-sm gap-1.5 rounded-xl bg-primary/10 px-3 py-2",
} as const;

/** "First order ₦X (−N%)": shown only to shoppers who have never paid for an order. */
export function FirstBuyerPrice({ price, percent, size = "sm", className }: Props) {
  const { data: status } = useFirstBuyerStatus();
  const p = Number(percent) || 0;
  if (!status?.first_buyer || p <= 0) return null;

  return (
    <p className={cn("flex items-center font-medium text-primary", SIZE_CLASSES[size], className)}>
      <Gift className={size === "md" ? "h-4 w-4 shrink-0" : "h-3 w-3 shrink-0"} />
      <span>
        First order <span className="font-bold">{naira(firstBuyerPrice(price, p))}</span> (−{p}%)
        {size === "md" && !status.bank_verified && (
          <span className="block text-[11px] font-normal text-muted-foreground">
            Applied at checkout once you link your bank account.
          </span>
        )}
      </span>
    </p>
  );
}
