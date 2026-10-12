import { useState } from "react";
import { format } from "date-fns";
import { AlertTriangle, CheckCircle2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrders, Order } from "@/hooks/useOrders";
import { toast } from "sonner";

const SHIPPED_STATUSES = ["ready_for_pickup", "shipped", "out_for_delivery", "delivered"];

/** Lets the customer confirm receipt (releasing the vendor's second half) or report a problem. */
export function BuyerProtection({ order }: { order: Order }) {
  const { confirmDelivery, openDispute } = useOrders();
  const [disputeOpen, setDisputeOpen] = useState(false);
  const [reason, setReason] = useState("");

  if (order.payment_status !== "paid") return null;

  if (order.dispute_status === "open") {
    return (
      <div className="mt-4 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
        <AlertTriangle className="h-5 w-5 flex-shrink-0" />
        <div>
          <p className="font-medium">Problem reported</p>
          <p>We're holding the seller's remaining payment while our team reviews your report.</p>
        </div>
      </div>
    );
  }

  if (order.escrow_status !== "held") return null;

  const canConfirm = SHIPPED_STATUSES.includes(order.status);

  const handleConfirm = async () => {
    try {
      await confirmDelivery.mutateAsync(order.id);
      toast.success("Thanks! The seller has been paid the rest.");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not confirm delivery");
    }
  };

  const handleDispute = async () => {
    try {
      await openDispute.mutateAsync({ orderId: order.id, reason });
      toast.success("Problem reported. Our team will contact you.");
      setDisputeOpen(false);
      setReason("");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not report the problem");
    }
  };

  return (
    <div className="mt-4 space-y-3 border-t pt-4">
      <div className="flex gap-2 text-sm text-muted-foreground">
        <ShieldCheck className="h-4 w-4 flex-shrink-0 text-primary" />
        <p>
          Your payment is protected. Half has gone to the seller; the rest is released when you
          confirm you received your order
          {order.auto_release_at
            ? `, or automatically on ${format(new Date(order.auto_release_at), "MMM d")}.`
            : "."}
        </p>
      </div>

      {canConfirm && (
        <Button className="w-full" onClick={handleConfirm} disabled={confirmDelivery.isPending}>
          <CheckCircle2 className="mr-2 h-4 w-4" />
          {confirmDelivery.isPending ? "Confirming..." : "I received my order"}
        </Button>
      )}

      <Button variant="outline" className="w-full" onClick={() => setDisputeOpen(true)}>
        <AlertTriangle className="mr-2 h-4 w-4" />
        Report a problem
      </Button>

      <Dialog open={disputeOpen} onOpenChange={setDisputeOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report a problem</DialogTitle>
            <DialogDescription>
              We'll hold the seller's remaining payment until our team has looked into it.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="What went wrong? E.g. item not delivered, wrong size, damaged."
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleDispute}
              disabled={openDispute.isPending || reason.trim().length < 10}
            >
              {openDispute.isPending ? "Sending..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
