import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { REPORT_DETAILS_MAX, REPORT_REASONS, useReport, type ReportReason, type ReportTarget } from "@/hooks/useModeration";

const TITLES: Record<ReportTarget, string> = {
  user: "Report this person",
  message: "Report this message",
  story: "Report this story",
};

/** Asks why, then sends a report to the Kano Kaftan team. */
export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  onReported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportTarget;
  targetId: string | null;
  /** Called after a successful report (e.g. to offer blocking). */
  onReported?: () => void;
}) {
  const report = useReport();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (open) {
      setReason(null);
      setDetails("");
    }
  }, [open]);

  const submit = () => {
    if (!targetId || !reason) return;
    report.mutate(
      { targetType, targetId, reason, details },
      {
        onSuccess: () => {
          toast.success("Thanks. Our team will review this.");
          onOpenChange(false);
          onReported?.();
        },
        onError: (error) => {
          console.error("[moderation] report failed", { targetType, targetId, error });
          toast.error(error instanceof Error ? error.message : "Could not send the report");
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="z-[160] max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle>{TITLES[targetType]}</DialogTitle>
          <DialogDescription>Reports are private. The other person won't know who reported them.</DialogDescription>
        </DialogHeader>
        <RadioGroup value={reason ?? ""} onValueChange={(v) => setReason(v as ReportReason)} className="gap-1">
          {REPORT_REASONS.map((r) => (
            <Label
              key={r.value}
              htmlFor={`reason-${r.value}`}
              className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 font-normal has-[:checked]:border-primary has-[:checked]:bg-primary/5"
            >
              <RadioGroupItem id={`reason-${r.value}`} value={r.value} />
              {r.label}
            </Label>
          ))}
        </RadioGroup>
        <Textarea
          value={details}
          onChange={(e) => setDetails(e.target.value.slice(0, REPORT_DETAILS_MAX))}
          placeholder="Anything else we should know? (optional)"
          rows={3}
          maxLength={REPORT_DETAILS_MAX}
        />
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={report.isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!reason || report.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {report.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
