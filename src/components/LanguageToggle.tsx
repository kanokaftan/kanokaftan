import { useTranslation } from "react-i18next";
import { setLanguage, type AppLanguage } from "@/i18n/language";
import { cn } from "@/lib/utils";

const OPTIONS: { value: AppLanguage; label: string }[] = [
  { value: "en", label: "English" },
  { value: "ha", label: "Hausa" },
];

/** English / Hausa switch for pages people read before they reach Settings. */
export function LanguageToggle({ className }: { className?: string }) {
  const { i18n, t } = useTranslation();
  const active: AppLanguage = i18n.language?.startsWith("ha") ? "ha" : "en";
  return (
    <div role="radiogroup" aria-label={t("seller.language")} className={cn("inline-flex rounded-full bg-muted p-0.5", className)}>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={active === o.value}
          lang={o.value}
          onClick={() => setLanguage(o.value)}
          className={cn(
            "h-7 rounded-full px-3 text-xs font-medium transition-colors",
            active === o.value ? "bg-background text-foreground shadow-sm" : "text-muted-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
