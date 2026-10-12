import { useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Loader2, MessageCircle, Phone, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  useAdminVendorApplications,
  useReviewVendorApplication,
  whatsAppLink,
  type AdminVendorApplication,
} from "@/hooks/useVendorApplication";
import { toast } from "sonner";

const STATUS_STYLE: Record<string, { label: string; className: string }> = {
  pending: { label: "Waiting for review", className: "bg-amber-100 text-amber-800 border-amber-200" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200" },
  rejected: { label: "Needs changes", className: "bg-red-100 text-red-800 border-red-200" },
};

const READY_MESSAGE = (shop: string) =>
  `Hello! Your shop "${shop}" on Kano Kaftan is ready. Sign in at https://kanokaftan.shop/vendor/login with the email and password you applied with, then add your logo, bank account and first products. Welcome!`;

/** Seller applications: approve (creates the shop) or ask for changes, then message the seller. */
export function VendorApplications() {
  const { data: applications, isLoading, error } = useAdminVendorApplications();
  const review = useReviewVendorApplication();
  const [rejecting, setRejecting] = useState<AdminVendorApplication | null>(null);
  const [reason, setReason] = useState("");
  const [justApproved, setJustApproved] = useState<AdminVendorApplication | null>(null);

  const approve = async (app: AdminVendorApplication) => {
    try {
      await review.mutateAsync({ userId: app.user_id, approve: true });
      toast.success(`${app.shop_name} is approved`);
      setJustApproved(app);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not approve");
    }
  };

  const reject = async () => {
    if (!rejecting) return;
    if (!reason.trim()) return toast.error("Tell the applicant what to fix");
    try {
      await review.mutateAsync({ userId: rejecting.user_id, approve: false, note: reason });
      toast.success("Sent back for changes");
      setRejecting(null);
      setReason("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Could not update the application");
    }
  };

  if (isLoading) return <Skeleton className="h-48 w-full rounded-xl" />;
  if (error) return <p className="text-sm text-destructive">Could not load applications.</p>;
  if (!applications?.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No seller applications yet. Sellers apply at <span className="font-medium text-foreground">kanokaftan.shop/sell</span>.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {applications.map((app) => {
        const status = STATUS_STYLE[app.status] ?? STATUS_STYLE.pending;
        return (
          <Card key={app.user_id}>
            <CardContent className="space-y-3 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{app.shop_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {app.full_name} · {app.city}, {app.state}
                  </p>
                </div>
                <Badge variant="outline" className={status.className}>{status.label}</Badge>
              </div>

              <p className="whitespace-pre-line text-sm">{app.description}</p>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="select-all">{app.phone}</span>
                {app.email && <span className="select-all">{app.email}</span>}
                <span>Applied {format(new Date(app.created_at), "d MMM yyyy, HH:mm")}</span>
              </div>

              {app.status === "rejected" && app.admin_note && (
                <p className="rounded-md bg-muted p-2 text-xs">Reason sent: {app.admin_note}</p>
              )}

              <div className="flex flex-wrap gap-2">
                {app.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => approve(app)} disabled={review.isPending}>
                      {review.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => { setRejecting(app); setReason(""); }} disabled={review.isPending}>
                      <XCircle className="mr-1.5 h-4 w-4" />
                      Ask for changes
                    </Button>
                  </>
                )}
                <Button size="sm" variant="outline" asChild>
                  <a href={whatsAppLink(app.phone, app.status === "approved" ? READY_MESSAGE(app.shop_name) : `Hello ${app.full_name}, this is Kano Kaftan about your shop application "${app.shop_name}".`)} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1.5 h-4 w-4" />
                    WhatsApp
                  </a>
                </Button>
                <Button size="sm" variant="ghost" asChild>
                  <a href={`tel:${app.phone}`}>
                    <Phone className="mr-1.5 h-4 w-4" />
                    Call
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      <Dialog open={!!rejecting} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ask {rejecting?.shop_name} for changes</DialogTitle>
            <DialogDescription>The applicant sees this reason and can update their application.</DialogDescription>
          </DialogHeader>
          <Textarea rows={4} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Please describe what you sell in more detail and use your real shop name." />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejecting(null)}>Cancel</Button>
            <Button onClick={reject} disabled={review.isPending}>
              {review.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
              Send back
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!justApproved} onOpenChange={(open) => !open && setJustApproved(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tell {justApproved?.shop_name} their shop is ready</DialogTitle>
            <DialogDescription>
              Their seller account is active now. Send them a message so they know to sign in at kanokaftan.shop/vendor/login.
            </DialogDescription>
          </DialogHeader>
          {justApproved && (
            <p className="rounded-md bg-muted p-3 text-sm">{READY_MESSAGE(justApproved.shop_name)}</p>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setJustApproved(null)}>Later</Button>
            {justApproved && (
              <Button asChild>
                <a href={whatsAppLink(justApproved.phone, READY_MESSAGE(justApproved.shop_name))} target="_blank" rel="noreferrer"
                  onClick={() => setJustApproved(null)}>
                  <MessageCircle className="mr-1.5 h-4 w-4" />
                  Send on WhatsApp
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
