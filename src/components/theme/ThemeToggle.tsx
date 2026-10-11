import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";

type Choice = "system" | "light" | "dark";

const CHOICES: { value: Choice; label: string; icon: LucideIcon }[] = [
  { value: "system", label: "System", icon: Monitor },
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
];

/** iOS-style segmented control: System (follows the phone) / Light / Dark. */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  // The saved choice is only known after mount; avoid showing the wrong one first.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const current = (mounted ? theme : "system") as Choice;

  return (
    <div role="radiogroup" aria-label="Appearance" className={cn("inline-flex rounded-full bg-muted p-1", className)}>
      {CHOICES.map(({ value, label, icon: Icon }) => {
        const selected = current === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-all",
              selected ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
