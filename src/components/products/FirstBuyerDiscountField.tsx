import { Gift } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { firstBuyerPrice, useFirstBuyerMinPercent } from "@/hooks/useBuyerTrust";
import { naira } from "@/lib/naira";

/** Highest first-buyer discount the database accepts. */
const MAX_FIRST_BUYER_PERCENT = 90;

interface Props {
  value: string;
  onChange: (value: string) => void;
  price: string;
}

/** Whether a typed first-buyer discount is allowed, given the platform minimum. */
function validFirstBuyerPercent(value: string, min: number): boolean {
  if (value.trim() === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= MAX_FIRST_BUYER_PERCENT;
}

/** Required "first-buyer discount" input for the product forms, with a live price preview. */
export function FirstBuyerDiscountField({ value, onChange, price }: Props) {
  const { data: min = 0 } = useFirstBuyerMinPercent();
  const priceNumber = Number(price);
  const percent = Number(value);
  const showPreview = priceNumber > 0 && validFirstBuyerPercent(value, min);

  return (
    <div className="space-y-2 rounded-2xl border border-primary/20 bg-primary/5 p-3">
      <Label htmlFor="first_buyer_discount" className="flex items-center gap-1.5 text-sm">
        <Gift className="h-4 w-4 text-primary" />
        First-buyer discount (%) *
      </Label>
      <div className="relative">
        <Input
          id="first_buyer_discount"
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={String(min)}
          min={min}
          max={MAX_FIRST_BUYER_PERCENT}
          step="1"
          required
          className="h-11 pr-8"
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
      </div>
      <p className="text-[11px] leading-snug text-muted-foreground">
        Only shoppers placing their very first order on Kano Kaftan see this price. Minimum {min}%.
        {showPreview && (
          <>
            {" "}They pay <span className="font-semibold text-foreground">{naira(firstBuyerPrice(priceNumber, percent))}</span>{" "}
            instead of {naira(priceNumber)}.
          </>
        )}
      </p>
    </div>
  );
}
