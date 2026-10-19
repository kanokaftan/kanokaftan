import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COPIED_RESET_MS = 1500;

/** An account number in large, easy-to-read digits with a one-tap copy (for paying someone by hand). */
export function CopyNumber({ value, label = "Account number", className }: { value: string; label?: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      window.setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch (error) {
      console.error("[CopyNumber] copy failed", error);
      toast.error("Couldn't copy. Select the number and copy it instead.");
    }
  };
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      <span className="select-all font-mono font-semibold tabular-nums tracking-wide text-foreground">{value}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        {copied ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  );
}
