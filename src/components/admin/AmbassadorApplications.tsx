import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Check, Copy, Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAmbassadorApplications, useReviewAmbassadorApplication, type AmbassadorApplication } from "@/hooks/useAmbassadors";
import { whatsappNumber } from "@/hooks/useLogistics";

const JOIN_PATH = "/ambassadors/join";

/** Sign-ups from /ambassadors/join, waiting for an admin to approve or decline. */
export function AmbassadorApplications() {
  const { data: applications, isLoading, isError, refetch } = useAmbassadorApplications();
  const review = useReviewAmbassadorApplication();
  const [declining, setDeclining] = useState<AmbassadorApplication | null>(null);
  const [note, setNote] = useState("");
  const pending = (applications ?? []).filter((a) => a.status === "pending");
  const recent = (applications ?? []).filter((a) => a.status !== "pending").slice(0, 5);
  const joinLink = `${window.location.origin}${JOIN_PATH}`;

  const approve = (app: AmbassadorApplication) =>
    review.mutate(
      { id: app.id, approve: true },
      {
        onSuccess: () => toast.success(`${app.full_name} is now an ambassador. They've been notified and their link is ready.`),
        onError: (error) => toast.error(error.message),
      },
    );

  const decline = () => {
    if (!declining) return;
    review.mutate(
      { id: declining.id, approve: false, note: note.trim() },
      {
        onSuccess: () => toast.success("Application declined"),
        onError: (error) => toast.error(error.message),
        onSettled: () => {
          setDeclining(null);
          setNote("");
        },
      },
    );
  };

  const copyJoinLink = async () => {
    try {
      await navigator.clipboard.writeText(joinLink);
      toast.success("Sign-up link copied");
    } catch (error) {
      console.error("[AmbassadorApplications] copy failed", error);
      toast.error("Couldn't copy the link");
    }
  };

  return (
    <section className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b p-4">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            Applications {pending.length > 0 && <Badge>{pending.length} new</Badge>}
          </h2>
          <p className="text-xs text-muted-foreground">People who signed up at {JOIN_PATH}. Approving creates their link and dashboard.</p>
        </div>
        <Button variant="outline" size="sm" onClick={copyJoinLink}><Copy className="mr-1.5 h-3.5 w-3.5" />Copy sign-up link</Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : isError ? (
        <p className="p-6 text-center text-sm text-muted-foreground">
          Couldn't load applications. <button type="button" className="underline" onClick={() => refetch()}>Try again</button>
        </p>
      ) : pending.length === 0 ? (
        <p className="p-6 text-center text-sm text-muted-foreground">No applications waiting.</p>
      ) : (
        <ul className="divide-y">
          {pending.map((app) => {
            const wa = whatsappNumber(app.phone);
            return (
              <li key={app.id} className="space-y-2 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{app.full_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {app.phone}{app.email ? ` · ${app.email}` : ""}{app.city ? ` · ${app.city}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatDistanceToNow(new Date(app.created_at), { addSuffix: true })}</span>
                </div>
                {app.about && <p className="rounded-xl bg-muted/60 p-2.5 text-sm">{app.about}</p>}
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" onClick={() => approve(app)} disabled={review.isPending}><Check className="mr-1.5 h-4 w-4" />Approve</Button>
                  <Button size="sm" variant="outline" onClick={() => setDeclining(app)} disabled={review.isPending}><X className="mr-1.5 h-4 w-4" />Decline</Button>
                  {wa && (
                    <Button size="sm" variant="ghost" asChild>
                      <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-1.5 h-4 w-4" />WhatsApp</a>
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {recent.length > 0 && (
        <div className="border-t p-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recently handled</p>
          <ul className="space-y-1 text-sm">
            {recent.map((app) => (
              <li key={app.id} className="flex items-center justify-between gap-2">
                <span className="truncate">{app.full_name}</span>
                <Badge variant={app.status === "approved" ? "default" : "secondary"}>{app.status === "approved" ? "Approved" : "Declined"}</Badge>
              </li>
            ))}
          </ul>
        </div>
      )}

      <AlertDialog open={!!declining} onOpenChange={(open) => !open && setDeclining(null)}>
        <AlertDialogContent className="max-w-[90vw] rounded-2xl md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Decline {declining?.full_name}?</AlertDialogTitle>
            <AlertDialogDescription>They'll get a notification. Add a short reason if you like; they'll see it and can apply again.</AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason (optional)" className="h-11 rounded-xl" />
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={decline}>Decline</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
