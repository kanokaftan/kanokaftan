import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { Camera, Eye, Heart, ImagePlus, Loader2, PlayCircle, Plus, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { STORY_CAPTION_MAX, useMyStories, useStoryViewers, type MyStory } from "@/hooks/useStories";
import { useMyShop } from "@/hooks/useMyShop";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

/** Phone photos can be big; they are shrunk before upload, but refuse anything absurd. */
const MAX_PICK_BYTES = 25 * 1024 * 1024;

type StoryStatus = "live" | "expired" | "removed";

function storyStatus(story: MyStory): StoryStatus {
  if (story.removed_at) return "removed";
  return new Date(story.expires_at) > new Date() ? "live" : "expired";
}

/** Full-screen "status" composer: the photo fills the screen, caption on top, one Share button. */
function StoryComposer({ file, onClose, onChange }: { file: File; onClose: () => void; onChange: () => void }) {
  const { post } = useMyStories();
  const { userId } = useVendorAuth();
  const { shop, name } = useMyShop(userId);
  const [caption, setCaption] = useState("");
  const preview = useMemo(() => URL.createObjectURL(file), [file]);

  useEffect(() => () => URL.revokeObjectURL(preview), [preview]);
  // Lock the page behind the composer, like a camera screen.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  const share = () => {
    post.mutate(
      { file, caption },
      {
        onSuccess: () => {
          toast.success("Shared to your story", { description: "Shoppers can see it for 24 hours." });
          onClose();
        },
        onError: (error) => {
          console.error("[stories] post failed", error);
          toast.error(error instanceof Error ? error.message : "Could not post your story");
        },
      },
    );
  };

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black text-white" role="dialog" aria-label="New story">
      <img src={preview} alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover opacity-40 blur-2xl" />
      <div className="relative flex items-center justify-between px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <button type="button" onClick={onClose} disabled={post.isPending} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 backdrop-blur">
          <X className="h-5 w-5" />
        </button>
        <button type="button" onClick={onChange} disabled={post.isPending} className="flex items-center gap-1.5 rounded-full bg-black/40 px-3 py-2 text-sm font-medium backdrop-blur">
          <ImagePlus className="h-4 w-4" />Change photo
        </button>
      </div>

      <div className="relative min-h-0 flex-1 px-2 py-3">
        <img src={preview} alt="Your story" className="mx-auto h-full w-full max-w-md rounded-3xl object-contain" />
      </div>

      <div className="relative space-y-3 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]">
        <div className="mx-auto max-w-md">
          <input
            value={caption}
            onChange={(e) => setCaption(e.target.value.slice(0, STORY_CAPTION_MAX))}
            placeholder="Add a caption…"
            maxLength={STORY_CAPTION_MAX}
            className="h-12 w-full rounded-full border border-white/20 bg-white/10 px-5 text-base text-white placeholder:text-white/60 backdrop-blur focus:outline-none focus:ring-2 focus:ring-white/40"
          />
        </div>
        <div className="mx-auto flex max-w-md items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2 text-sm">
            <Avatar className="h-8 w-8 ring-2 ring-white/70">
              <AvatarImage src={shop?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="bg-white/20 text-xs text-white">{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="truncate">Your story · 24 hours</span>
          </span>
          <button type="button" onClick={share} disabled={post.isPending}
            className="flex h-12 shrink-0 items-center gap-2 rounded-full bg-white px-6 font-semibold text-black active:scale-95 disabled:opacity-70">
            {post.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
            {post.isPending ? "Sharing…" : "Share"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** "Add to your story" bubble plus the live stories, like a status bar. */
function StoryBar({ onPick, liveStories }: { onPick: () => void; liveStories: MyStory[] }) {
  const { userId } = useVendorAuth();
  const { shop, name } = useMyShop(userId);
  return (
    <div className="rounded-3xl border bg-card p-4">
      <div className="flex gap-4 overflow-x-auto pb-1">
        <button type="button" onClick={onPick} className="flex w-20 shrink-0 flex-col items-center gap-1.5" aria-label="Add to your story">
          <span className="relative">
            <Avatar className="h-[72px] w-[72px] border-2 border-background ring-2 ring-muted">
              <AvatarImage src={shop?.avatar_url ?? undefined} alt="" />
              <AvatarFallback className="text-lg">{name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground">
              <Plus className="h-4 w-4" />
            </span>
          </span>
          <span className="text-xs font-medium">Add story</span>
        </button>
        {liveStories.map((story) => (
          <Link key={story.id} to={`/stories/${userId}`} className="flex w-20 shrink-0 flex-col items-center gap-1.5">
            <span className="rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-fuchsia-600 p-[2.5px]">
              <img src={story.image_url} alt="" className="h-[70px] w-[70px] rounded-full border-2 border-background object-cover" />
            </span>
            <span className="text-xs text-muted-foreground">{formatDistanceToNowStrict(new Date(story.created_at))}</span>
          </Link>
        ))}
      </div>
      <Button onClick={onPick} className="mt-3 h-12 w-full rounded-full text-base">
        <Camera className="mr-2 h-5 w-5" />Post a story
      </Button>
      <p className="mt-2 text-center text-xs text-muted-foreground">Show a new design, fabric or what's happening in your shop. It stays up for 24 hours.</p>
    </div>
  );
}

const STATUS_BADGE: Record<StoryStatus, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-green-600 text-white hover:bg-green-600" },
  expired: { label: "Ended", className: "" },
  removed: { label: "Removed", className: "" },
};

function StoryTile({ story, onRemove, onShowViewers }: { story: MyStory; onRemove: () => void; onShowViewers: () => void }) {
  const status = storyStatus(story);
  const badge = STATUS_BADGE[status];
  const live = status === "live";
  return (
    <li className="relative">
      <button type="button" onClick={onShowViewers} disabled={story.view_count === 0}
        className={cn("relative block aspect-[9/16] w-full overflow-hidden rounded-2xl bg-muted text-left", !live && "opacity-60")}
        aria-label={`${story.view_count} views, ${story.like_count} likes${story.view_count ? ". See who viewed" : ""}`}>
        <img src={story.image_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 pt-8 text-white">
          <span className="flex items-center gap-2 text-xs font-semibold">
            <span className="flex items-center gap-0.5"><Eye className="h-3.5 w-3.5" />{story.view_count}</span>
            <span className="flex items-center gap-0.5"><Heart className="h-3.5 w-3.5" />{story.like_count}</span>
          </span>
          <span className="block truncate text-[10px] opacity-80">
            {live ? `${formatDistanceToNowStrict(new Date(story.expires_at))} left` : badge.label}
          </span>
        </span>
        {live && <span className="absolute left-2 top-2 rounded-full bg-green-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">Live</span>}
      </button>
      {live && (
        <button type="button" onClick={onRemove} aria-label="Remove story"
          className="absolute right-1.5 top-1.5 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white backdrop-blur">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}

function ViewersSheet({ storyId, onClose }: { storyId: string | null; onClose: () => void }) {
  const { data: viewers = [], isLoading, isError } = useStoryViewers(storyId);
  return (
    <Sheet open={!!storyId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle>Viewed by {viewers.length || ""}</SheetTitle>
          <SheetDescription>People who liked your story are shown first.</SheetDescription>
        </SheetHeader>
        <div className="mt-4">
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          ) : isError ? (
            <p className="text-sm text-destructive">Could not load viewers.</p>
          ) : (
            <ul className="divide-y">
              {viewers.map((viewer) => (
                <li key={viewer.user_id} className="flex items-center gap-3 py-2.5">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={viewer.avatar_url ?? undefined} alt="" />
                    <AvatarFallback>{viewer.name.charAt(0).toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{viewer.name}</p>
                    <p className="text-xs text-muted-foreground">{formatDistanceToNowStrict(new Date(viewer.viewed_at), { addSuffix: true })}</p>
                  </div>
                  {viewer.liked && <Heart className="h-5 w-5 fill-red-500 text-red-500" aria-label="Liked" />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default function VendorStories() {
  const { userId } = useVendorAuth();
  const { stories, remove } = useMyStories();
  const pickerRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<File | null>(null);

  const openPicker = () => pickerRef.current?.click();
  const pick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    e.target.value = "";
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      toast.error("Please choose a photo");
      return;
    }
    if (picked.size > MAX_PICK_BYTES) {
      toast.error("That photo is too large (max 25 MB)");
      return;
    }
    setDraft(picked);
  };
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [viewersOf, setViewersOf] = useState<string | null>(null);
  const list = stories.data ?? [];
  const liveCount = list.filter((s) => storyStatus(s) === "live").length;
  const totals = list.reduce((acc, s) => ({ views: acc.views + s.view_count, likes: acc.likes + s.like_count }), { views: 0, likes: 0 });

  const confirmRemove = () => {
    if (!confirmId) return;
    remove.mutate(confirmId, {
      onSuccess: () => toast.success("Story removed"),
      onError: (error) => toast.error(error instanceof Error ? error.message : "Could not remove the story"),
      onSettled: () => setConfirmId(null),
    });
  };

  return (
    <VendorLayout title="Stories">
      <div className="mx-auto max-w-2xl space-y-5">
        <input ref={pickerRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        <StoryBar onPick={openPicker} liveStories={list.filter((st) => storyStatus(st) === "live")} />

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-base">Your stories</CardTitle>
              <CardDescription>Last 30 days · {totals.views} views · {totals.likes} likes</CardDescription>
            </div>
            {liveCount > 0 && userId && (
              <Button asChild variant="outline" size="sm">
                <Link to={`/stories/${userId}`}>
                  <PlayCircle className="mr-1.5 h-4 w-4" /> Preview
                </Link>
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {stories.isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-24 w-full rounded-2xl" />
                <Skeleton className="h-24 w-full rounded-2xl" />
              </div>
            ) : stories.isError ? (
              <p className="text-sm text-destructive">Could not load your stories. Pull down to try again.</p>
            ) : list.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">Your stories will appear here with their views and likes.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {list.map((story) => (
                  <StoryTile key={story.id} story={story} onRemove={() => setConfirmId(story.id)} onShowViewers={() => setViewersOf(story.id)} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {draft && <StoryComposer file={draft} onClose={() => setDraft(null)} onChange={openPicker} />}

      <ViewersSheet storyId={viewersOf} onClose={() => setViewersOf(null)} />

      <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this story?</AlertDialogTitle>
            <AlertDialogDescription>Shoppers won't see it any more. Its views and likes stay in your list.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={remove.isPending}>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove} disabled={remove.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {remove.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </VendorLayout>
  );
}
