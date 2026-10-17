import { Award, Gem } from "lucide-react";
import { useShopMark } from "@/hooks/usePartners";
import { cn } from "@/lib/utils";

type Size = "sm" | "md";

const SIZE: Record<Size, { pill: string; icon: string }> = {
  sm: { pill: "h-5 gap-1 px-1.5 text-[10px]", icon: "h-3 w-3" },
  md: { pill: "h-7 gap-1.5 px-2.5 text-xs", icon: "h-3.5 w-3.5" },
};

/** Black-and-gold badge on a partner's own store, e.g. "Founding Partner". */
export function PartnerBadge({ label, size = "md", className }: { label: string; size?: Size; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full bg-gradient-to-r from-[#1c1917] to-[#3b2f14] font-semibold text-[#F5D67A] ring-1 ring-[#9A7400]/60",
        SIZE[size].pill,
        className,
      )}
      title={`${label} of Kano Kaftan`}
    >
      <Gem className={SIZE[size].icon} aria-hidden="true" />
      {label}
    </span>
  );
}

/** Label a partner gave a shop, e.g. "Marmara's Choice". */
export function ChoiceLabel({ label, size = "md", className }: { label: string; size?: Size; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center whitespace-nowrap rounded-full border border-[#9A7400]/40 bg-[#9A7400]/10 font-semibold text-[#7A5C00] dark:text-[#F5D67A]",
        SIZE[size].pill,
        className,
      )}
      title={`Picked by ${label.replace(/'s Choice$/, "")}`}
    >
      <Award className={cn("shrink-0", SIZE[size].icon)} aria-hidden="true" />
      <span className="truncate">{label}</span>
    </span>
  );
}

/** Every mark a shop has (partner badge first), or nothing. */
export function ShopMarks({ vendorId, size = "md", className }: { vendorId: string | null | undefined; size?: Size; className?: string }) {
  const mark = useShopMark(vendorId);
  if (!mark || (!mark.partner && mark.choices.length === 0)) return null;
  return (
    <div className={cn("flex min-w-0 flex-wrap items-center gap-1", className)}>
      {mark.partner && <PartnerBadge label={mark.partner} size={size} />}
      {mark.choices.map((choice) => <ChoiceLabel key={choice} label={choice} size={size} />)}
    </div>
  );
}
