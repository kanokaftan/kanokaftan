import { useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Eye, Flag, Heart, Loader2, MessageCircle, RotateCcw, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { REPORT_REASONS } from "@/hooks/useModeration";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

type Report = Database["public"]["Functions"]["admin_list_reports"]["Returns"][number];
type LiveStory = Database["public"]["Functions"]["admin_live_stories"]["Returns"][number];
type ReportStatus = "open" | "action_taken" | "dismissed";

const REPORTS_KEY = ["admin-reports"] as const;
const STORIES_KEY = ["admin-live-stories"] as const;
const REASON_LABELS: Record<string, string> = Object.fromEntries(REPORT_REASONS.map((r) => [r.value, r.label]));
const TARGET_LABELS: Record<string, string> = { user: "Person", message: "Message", story: "Story" };
/** Reporting the same person this many times flags them as a repeat problem. */
const REPEAT_OFFENDER_REPORTS = 3;

function useReports(status: ReportStatus) {
  return useQuery({
    queryKey: [...REPORTS_KEY, status],
    queryFn: async (): Promise<Report[]> => {
      const { data, error } = await supabase.rpc("admin_list_reports", { p_status: status, p_limit: 200 });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useLiveStories() {
  return useQuery({
    queryKey: STORIES_KEY,
    queryFn: async (): Promise<LiveStory[]> => {
      const { data, error } = await supabase.rpc("admin_live_stories", {});
      if (error) throw error;
      return data ?? [];
    },
  });
}

function useModerationActions() {
  const queryClient = useQueryClient();
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: REPORTS_KEY });
    queryClient.invalidateQueries({ queryKey: STORIES_KEY });
    queryClient.invalidateQueries({ queryKey: ["story-rings"] });
  };
  const resolve = useMutation({
    mutationFn: async ({ id, status, note }: { id: string; status: ReportStatus; note?: string }) => {
      const { error } = await supabase.rpc("admin_resolve_report", { p_report_id: id, p_status: status, p_note: note || undefined });
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
  const removeStory = useMutation({
    mutationFn: async (storyId: string) => {
      const { error } = await supabase.rpc("remove_story", { p_story_id: storyId });
      if (error) throw new Error(error.message);
    },
    onSuccess: refresh,
  });
  return { resolve, removeStory };
}

function ReportCard({ report, onRemoveStory }: { report: Report; onRemoveStory: (id: string) => void }) {
  const { resolve } = useModerationActions();
  const [note, setNote] = useState(report.admin_note ?? "");
  const open = report.status === "open";

  const setStatus = (status: ReportStatus) =>
    resolve.mutate(
      { id: report.id, status, note },
      {
        onSuccess: () => toast.success(status === "open" ? "Report reopened" : "Report closed"),
        onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update the report"),
      },
    );

  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{TARGET_LABELS[report.target_type] ?? report.target_type}</Badge>
          <Badge className="bg-destructive/10 text-destructive hover:bg-destructive/10">{REASON_LABELS[report.reason] ?? report.reason}</Badge>
          {report.reports_against_user >= REPEAT_OFFENDER_REPORTS && (
            <Badge className="bg-primary text-primary-foreground hover:bg-primary/90">{report.reports_against_user} reports about this person</Badge>
          )}
          <span className="ml-auto text-xs text-muted-foreground">
            {formatDistanceToNowStrict(new Date(report.created_at), { addSuffix: true })}
          </span>
        </div>

        <p className="text-sm">
          <span className="font-semibold">{report.reporter_name}</span> reported{" "}
          <span className="font-semibold">{report.reported_name}</span>
        </p>
        {report.details && <p className="rounded-xl bg-muted p-3 text-sm italic">"{report.details}"</p>}

        {report.target_type === "message" && report.message_body && (
          <div className="rounded-xl border-l-4 border-destructive/60 bg-muted/50 p-3 text-sm">
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Reported message</p>
            <p className="whitespace-pre-wrap break-words">{report.message_body}</p>
          </div>
        )}
        {report.target_type === "story" && report.story_image_url && (
          <div className="flex items-center gap-3">
            <img src={report.story_image_url} alt="Reported story" className="h-28 w-20 rounded-xl bg-muted object-cover" />
            <div className="min-w-0 flex-1 space-y-2">
              {report.story_caption && <p className="line-clamp-3 text-sm">{report.story_caption}</p>}
              {report.story_live ? (
                <Button variant="destructive" size="sm" onClick={() => onRemoveStory(report.target_id)}>
                  <Trash2 className="mr-1.5 h-4 w-4" /> Take story down
                </Button>
              ) : (
                <Badge variant="secondary">No longer live</Badge>
              )}
            </div>
          </div>
        )}
        {report.conversation_id && (
          <p className="text-xs text-muted-foreground">
            <MessageCircle className="mr-1 inline h-3.5 w-3.5" />
            Chat {report.conversation_id.slice(0, 8)}. Open it from the seller's page under Sellers.
          </p>
        )}

        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the team (optional)" rows={2} disabled={!open} />
        <div className="flex flex-wrap gap-2">
          {open ? (
            <>
              <Button size="sm" onClick={() => setStatus("action_taken")} disabled={resolve.isPending}>
                {resolve.isPending ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1.5 h-4 w-4" />}
                Action taken
              </Button>
              <Button size="sm" variant="outline" onClick={() => setStatus("dismissed")} disabled={resolve.isPending}>
                <XCircle className="mr-1.5 h-4 w-4" /> Dismiss
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" onClick={() => setStatus("open")} disabled={resolve.isPending}>
              <RotateCcw className="mr-1.5 h-4 w-4" /> Reopen
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReportList({ status, onRemoveStory }: { status: ReportStatus; onRemoveStory: (id: string) => void }) {
  const { data = [], isLoading, isError, refetch } = useReports(status);
  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (isError)
    return (
      <p className="text-sm text-destructive">
        Could not load reports. <button className="underline" onClick={() => refetch()}>Try again</button>
      </p>
    );
  if (data.length === 0)
    return <p className="py-10 text-center text-sm text-muted-foreground">{status === "open" ? "No open reports. All clear." : "Nothing here yet."}</p>;
  return (
    <div className="space-y-3">
      {data.map((report) => (
        <ReportCard key={report.id} report={report} onRemoveStory={onRemoveStory} />
      ))}
    </div>
  );
}

function LiveStories({ onRemoveStory }: { onRemoveStory: (id: string) => void }) {
  const { data = [], isLoading, isError } = useLiveStories();
  if (isLoading) return <Skeleton className="h-40 w-full rounded-2xl" />;
  if (isError) return <p className="text-sm text-destructive">Could not load stories.</p>;
  if (data.length === 0) return <p className="py-10 text-center text-sm text-muted-foreground">No live stories right now.</p>;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {data.map((story) => (
        <div key={story.id} className={cn("overflow-hidden rounded-2xl border bg-card", story.open_reports > 0 && "border-destructive ring-1 ring-destructive")}>
          <Link to={`/stories/${story.vendor_id}`} className="relative block aspect-[9/14] bg-muted">
            <img src={story.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
            {story.open_reports > 0 && (
              <span className="absolute left-2 top-2 flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-white">
                <Flag className="h-3 w-3" /> {story.open_reports}
              </span>
            )}
          </Link>
          <div className="space-y-1.5 p-2.5">
            <p className="truncate text-sm font-semibold">{story.store_name ?? "Seller"}</p>
            {story.caption && <p className="line-clamp-2 text-xs text-muted-foreground">{story.caption}</p>}
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{story.view_count}</span>
              <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{story.like_count}</span>
              <span className="ml-auto">{formatDistanceToNowStrict(new Date(story.created_at))}</span>
            </div>
            <Button variant="outline" size="sm" className="w-full text-destructive hover:bg-destructive/10" onClick={() => onRemoveStory(story.id)}>
              <Trash2 className="mr-1.5 h-4 w-4" /> Remove
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

/** Admin: reports from users, and every live story with a take-down button. */
export default function AdminModeration() {
  const { removeStory } = useModerationActions();
  const [confirmStory, setConfirmStory] = useState<string | null>(null);
  const { data: openReports = [] } = useReports("open");

  const confirmRemove = () => {
    if (!confirmStory) return;
    removeStory.mutate(confirmStory, {
      onSuccess: () => toast.success("Story taken down"),
      onError: (e) => toast.error(e instanceof Error ? e.message : "Could not remove the story"),
      onSettled: () => setConfirmStory(null),
    });
  };

  return (
    <AdminLayout title="Moderation">
      <Tabs defaultValue="open" className="space-y-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="open">
            Open reports{openReports.length > 0 && <Badge className="ml-1.5 h-5 bg-destructive px-1.5 hover:bg-destructive">{openReports.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="stories">Live stories</TabsTrigger>
          <TabsTrigger value="closed">Closed</TabsTrigger>
        </TabsList>
        <TabsContent value="open">
          <ReportList status="open" onRemoveStory={setConfirmStory} />
        </TabsContent>
        <TabsContent value="stories">
          <LiveStories onRemoveStory={setConfirmStory} />
        </TabsContent>
        <TabsContent value="closed" className="space-y-6">
          <ReportList status="action_taken" onRemoveStory={setConfirmStory} />
          <ReportList status="dismissed" onRemoveStory={setConfirmStory} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!confirmStory} onOpenChange={(open) => !open && setConfirmStory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take this story down?</AlertDialogTitle>
            <AlertDialogDescription>It disappears for everyone straight away. The seller still sees it in their list as removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeStory.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={removeStory.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {removeStory.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Take down
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
