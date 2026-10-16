import { Loader2, Scissors, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyShopType, useSetMyShopType, type ShopType } from "@/hooks/useShops";
import { cn } from "@/lib/utils";

const OPTIONS: { value: ShopType; label: string; hint: string; icon: typeof Scissors }[] = [
  { value: "tailor", label: "Tailor", hint: "I sew and make to measure", icon: Scissors },
  { value: "seller", label: "Seller", hint: "I sell ready-made items", icon: ShoppingBag },
];

/** Tailor or seller: decides which filter the shop appears under in the Shops directory. Saves on tap. */
export function ShopTypePicker() {
  const { data: current, isLoading } = useMyShopType(true);
  const save = useSetMyShopType();

  const choose = async (type: ShopType) => {
    if (type === current || save.isPending) return;
    try {
      await save.mutateAsync(type);
      toast.success(type === "tailor" ? "Your shop now shows under Tailors" : "Your shop now shows under Sellers");
    } catch (error) {
      console.error("[ShopTypePicker] save failed", { type, error });
      toast.error(error instanceof Error ? error.message : "Couldn't save. Please try again.");
    }
  };

  return (
    <div className="space-y-2">
      <Label className="text-sm">What kind of shop is this?</Label>
      {isLoading ? (
        <Skeleton className="h-16 rounded-xl" />
      ) : (
        <div role="radiogroup" aria-label="Shop type" className="grid grid-cols-2 gap-2">
          {OPTIONS.map((o) => {
            const selected = current === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => choose(o.value)}
                className={cn(
                  "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                  selected ? "border-primary bg-primary/5" : "bg-background",
                )}
              >
                {save.isPending && save.variables === o.value ? (
                  <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <o.icon className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                <span>
                  <span className="block text-sm font-medium">{o.label}</span>
                  <span className="block text-xs text-muted-foreground">{o.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
