import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { useSetVendorTier, type BadgeTier } from "@/hooks/useAdminVendors";
import { cn } from "@/lib/utils";

const TIER_OPTIONS: { value: BadgeTier; label: string }[] = [
  { value: "none", label: "Not verified" },
  { value: "blue", label: "Blue" },
  { value: "gold", label: "Gold" },
];

const SUCCESS_MESSAGE: Record<BadgeTier, string> = {
  none: "Badge removed",
  blue: "Seller is now blue verified",
  gold: "Seller is now gold",
};

/** Small status pill: Gold / Blue / Not verified. */
export function TierChip({ tier, className }: { tier: BadgeTier; className?: string }) {
  if (tier === "none") {
    return (
      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium text-muted-foreground", className)}>
        Not verified
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tier === "gold" ? "bg-[#9A7400]/10 text-[#7F5F00]" : "bg-[#1D9BF0]/10 text-[#1576B8]",
        className,
      )}
    >
      <VerifiedBadge tier={tier} className="h-3.5 w-3.5" />
      {tier === "gold" ? "Gold" : "Blue"}
    </span>
  );
}

/**
 * Admin switch between Not verified, Blue and Gold for one seller.
 * The change applies at once and the seller gets a notification.
 */
export function BadgeTierControl({
  vendorId,
  tier,
  onChanged,
  className,
}: {
  vendorId: string;
  tier: BadgeTier;
  onChanged?: (tier: BadgeTier) => void;
  className?: string;
}) {
  const setTier = useSetVendorTier();
  const pendingTier = setTier.isPending ? setTier.variables?.tier : undefined;

  const choose = async (next: BadgeTier) => {
    if (next === tier || setTier.isPending) return;
    try {
      await setTier.mutateAsync({ vendorId, tier: next });
      toast.success(SUCCESS_MESSAGE[next]);
      onChanged?.(next);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change the badge");
    }
  };

  return (
    <div
      role="radiogroup"
      aria-label="Verification badge"
      className={cn("inline-flex rounded-lg border bg-muted/40 p-0.5", className)}
      onClick={(e) => e.stopPropagation()}
    >
      {TIER_OPTIONS.map((option) => {
        const active = option.value === tier;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={setTier.isPending}
            onClick={() => choose(option.value)}
            className={cn(
              "flex flex-1 items-center justify-center gap-1 whitespace-nowrap rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-60",
              active
                ? option.value === "gold"
                  ? "bg-[#9A7400] text-white shadow-sm"
                  : option.value === "blue"
                    ? "bg-[#1D9BF0] text-white shadow-sm"
                    : "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {pendingTier === option.value && <Loader2 className="h-3 w-3 animate-spin" />}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
