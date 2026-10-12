import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { Camera, Eye, Heart, ImagePlus, Loader2, PlayCircle, CircleFadingPlus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { STORY_CAPTION_MAX, useMyStories, useStoryViewers, type MyStory } from "@/hooks/useStories";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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

function NewStoryCard() {
  const { post } = useMyStories();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

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
    setFile(picked);
    setPreview(URL.createObjectURL(picked));
  };

  const reset = () => {
    setFile(null);
    setPreview(null);
    setCaption("");
  };

  const share = () => {
    if (!file) return;
    post.mutate(
      { file, caption },
      {
        onSuccess: () => {
          toast.success("Your story is live for 24 hours");
          reset();
        },
        onError: (error) => {
          console.error("[stories] post failed", error);
          toast.error(error instanceof Error ? error.message : "Could not post your story");
        },
      },
    );
  };

  return (
    <Card className="overflow-hidden border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <CircleFadingPlus className="h-5 w-5 text-primary" /> New story
        </CardTitle>
        <CardDescription>
          Share a new design, fabric or behind-the-scenes photo. Shoppers see it on the home page and on your shop for 24 hours.
          Gold sellers get a gold ring and are shown first.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={pick} />
        {preview ? (
          <div className="relative mx-auto aspect-[9/16] max-h-[420px] w-full max-w-[240px] overflow-hidden rounded-2xl bg-black">
            <img src={preview} alt="Story preview" className="h-full w-full object-contain" />
            {caption.trim() && (
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-3 pt-8 text-sm text-white">{caption}</p>
            )}
            <button
              type="button"
              onClick={reset}
              disabled={post.isPending}
              aria-label="Remove photo"
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 text-primary transition-colors hover:bg-primary/10"
          >
            <ImagePlus className="h-8 w-8" />
            <span className="text-sm font-semibold">Choose a photo</span>
            <span className="text-xs text-muted-foreground">Tall (portrait) photos look best</span>
          </button>
        )}
        {preview && (
          <>
            <div>
              <Textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value.slice(0, STORY_CAPTION_MAX))}
                placeholder="Add a caption (optional)"
                rows={2}
                maxLength={STORY_CAPTION_MAX}
              />
              <p className="mt-1 text-right text-[11px] text-muted-foreground">
                {caption.length}/{STORY_CAPTION_MAX}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => inputRef.current?.click()} disabled={post.isPending}>
                <Camera className="mr-2 h-4 w-4" /> Change
              </Button>
              <Button className="flex-1" onClick={share} disabled={post.isPending}>
                {post.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CircleFadingPlus className="mr-2 h-4 w-4" />}
                Share story
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

const STATUS_BADGE: Record<StoryStatus, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-green-600 text-white hover:bg-green-600" },
  expired: { label: "Ended", className: "" },
  removed: { label: "Removed", className: "" },
};

function StoryRow({ story, onRemove, onShowViewers }: { story: MyStory; onRemove: () => void; onShowViewers: () => void }) {
  const status = storyStatus(story);
  const badge = STATUS_BADGE[status];
  const live = status === "live";
  return (
    <li className={cn("flex items-center gap-3 rounded-2xl border bg-card p-2.5", !live && "opacity-70")}>
      <img src={story.image_url} alt="" loading="lazy" className="h-20 w-14 shrink-0 rounded-xl bg-muted object-cover" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Badge variant={live ? "default" : "secondary"} className={cn("text-[10px]", badge.className)}>
            {badge.label}
          </Badge>
          <span className="truncate text-xs text-muted-foreground">
            {live
              ? `ends ${formatDistanceToNowStrict(new Date(story.expires_at), { addSuffix: true })}`
              : formatDistanceToNowStrict(new Date(story.created_at), { addSuffix: true })}
          </span>
        </div>
        {story.caption && <p className="mt-1 line-clamp-1 text-sm">{story.caption}</p>}
        <div className="mt-1.5 flex items-center gap-4 text-sm text-muted-foreground">
          <button
            type="button"
            onClick={onShowViewers}
            disabled={story.view_count === 0}
            className="flex items-center gap-1 rounded-full px-1 -mx-1 hover:bg-muted disabled:hover:bg-transparent"
            aria-label={`${story.view_count} views. See who viewed`}
          >
            <Eye className="h-4 w-4" /> <span className="font-semibold tabular-nums text-foreground">{story.view_count}</span>
            {story.view_count > 0 && <span className="text-xs text-primary underline-offset-2 hover:underline">See who</span>}
          </button>
          <span className="flex items-center gap-1" title="Likes">
            <Heart className="h-4 w-4" /> <span className="font-semibold tabular-nums text-foreground">{story.like_count}</span>
          </span>
        </div>
      </div>
      {live && (
        <Button variant="ghost" size="icon" className="shrink-0 text-destructive hover:bg-destructive/10" onClick={onRemove} aria-label="Remove story">
          <Trash2 className="h-4 w-4" />
        </Button>
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
        <NewStoryCard />

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
            <div>
              <CardTitle className="text-lg">Your stories</CardTitle>
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
              <p className="py-6 text-center text-sm text-muted-foreground">You haven't posted a story yet.</p>
            ) : (
              <ul className="space-y-2">
                {list.map((story) => (
                  <StoryRow key={story.id} story={story} onRemove={() => setConfirmId(story.id)} onShowViewers={() => setViewersOf(story.id)} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

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
