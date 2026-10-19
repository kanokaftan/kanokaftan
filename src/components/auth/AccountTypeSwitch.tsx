import { Megaphone, ShoppingBag, Store, type LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

export type AccountType = "shop" | "sell" | "ambassador";

export const ACCOUNT_TYPES: readonly AccountType[] = ["shop", "sell", "ambassador"];

const OPTIONS: { value: AccountType; icon: LucideIcon; titleKey: string; title: string; hintKey: string; hint: string }[] = [
  { value: "shop", icon: ShoppingBag, titleKey: "auth.typeShop", title: "Shop", hintKey: "auth.typeShopHint", hint: "Buy clothes" },
  { value: "sell", icon: Store, titleKey: "auth.typeSell", title: "Sell", hintKey: "auth.typeSellHint", hint: "Open a shop" },
  { value: "ambassador", icon: Megaphone, titleKey: "auth.typeAmbassador", title: "Ambassador", hintKey: "auth.typeAmbassadorHint", hint: "Earn by inviting" },
];

/** First thing on the sign-in / sign-up page: who is this account for? */
export function AccountTypeSwitch({ value, onChange }: { value: AccountType; onChange: (value: AccountType) => void }) {
  const { t } = useTranslation();
  return (
    <div role="radiogroup" aria-label={t("auth.typeQuestion", "I'm here to")} className="grid grid-cols-3 gap-2">
      {OPTIONS.map((o) => {
        const selected = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex flex-col items-center gap-1 rounded-2xl border px-2 py-3 text-center transition-all active:scale-[0.97]",
              selected ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-card text-foreground hover:bg-muted",
            )}
          >
            <o.icon className="h-5 w-5" />
            <span className="text-sm font-semibold leading-tight">{t(o.titleKey, o.title)}</span>
            <span className={cn("text-[11px] leading-tight", selected ? "text-primary-foreground/75" : "text-muted-foreground")}>
              {t(o.hintKey, o.hint)}
            </span>
          </button>
        );
      })}
    </div>
  );
}
