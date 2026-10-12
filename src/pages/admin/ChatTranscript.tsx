import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, isSameDay, isToday, isYesterday } from "date-fns";
import { ChevronLeft, Eye, Loader2, Store, User } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { ImageLightbox } from "@/components/chat/ImageLightbox";
import { ProductCard } from "@/components/chat/ProductCard";
import { VoicePlayer } from "@/components/chat/VoicePlayer";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useChatMediaUrl } from "@/hooks/useChat";
import { useAdminTranscript, type TranscriptMessage } from "@/hooks/useAdminOversight";
import { cn } from "@/lib/utils";
import { withoutLeadingEmoji } from "@/lib/text";

const ORDER_LINK = /(\/orders\/[0-9a-f-]{36})/g;

function dayLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return format(date, "EEEE d MMMM yyyy");
}

/** Order links in a message become links to the admin order list. */
function Body({ text, right }: { text: string; right: boolean }) {
  return (
    <>
      {text.split(ORDER_LINK).map((part, i) =>
        /^\/orders\/[0-9a-f-]{36}$/.test(part) ? (
          <Link key={i} to={`/admin/orders?search=${part.slice(8, 16)}`} className={cn("font-semibold underline", right ? "text-primary-foreground" : "text-primary")}>
            Order #{part.slice(8, 16)}
          </Link>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function ChatImage({ path, onOpen }: { path: string; onOpen: (url: string) => void }) {
  const { data: url, isLoading, isError } = useChatMediaUrl(path);
  if (isLoading) return <Skeleton className="mb-1 h-48 w-56 rounded-xl" />;
  if (isError || !url) return <p className="text-xs opacity-70">Photo unavailable</p>;
  return (
    <button type="button" onClick={() => onOpen(url)} className="mb-1 block overflow-hidden rounded-xl">
      <img src={url} alt="Photo sent in chat" className="max-h-72 w-56 max-w-full object-cover" loading="lazy" />
    </button>
  );
}

function ChatVoice({ path, right }: { path: string; right: boolean }) {
  const { data: url, isLoading, isError } = useChatMediaUrl(path);
  if (isLoading) return <Loader2 className="h-4 w-4 animate-spin" />;
  if (isError || !url) return <p className="text-xs opacity-70">Voice note unavailable</p>;
  return <VoicePlayer src={url} cacheKey={path} tone={right ? "dark" : "light"} />;
}

function Bubble({
  message, right, replied, onOpenImage,
}: {
  message: TranscriptMessage;
  right: boolean;
  replied: TranscriptMessage | undefined;
  onOpenImage: (url: string) => void;
}) {
  const media = message.media_path;
  return (
    <div className={cn("flex", right ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm shadow-sm",
          right ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted",
        )}
      >
        {replied && (
          <p className={cn("mb-1.5 line-clamp-2 border-l-2 pl-2 text-xs", right ? "border-primary-foreground/50 opacity-80" : "border-primary/50 text-muted-foreground")}>
            {replied.body}
          </p>
        )}
        {message.product_id && <ProductCard productId={message.product_id} mine={right} />}
        {message.message_type === "image" && media && <ChatImage path={media} onOpen={onOpenImage} />}
        {message.message_type === "voice" && media ? (
          <ChatVoice path={media} right={right} />
        ) : (
          message.body && !(message.message_type === "image" && (message.body.startsWith("📷") || message.body === "Photo")) && (
            <p className="whitespace-pre-wrap break-words"><Body text={withoutLeadingEmoji(message.body)} right={right} /></p>
          )
        )}
        <p className={cn("mt-0.5 text-right text-[10px]", right ? "text-primary-foreground/70" : "text-muted-foreground")}>
          {message.reactions.length > 0 && <span className="mr-1.5">{message.reactions.join(" ")}</span>}
          {format(new Date(message.created_at), "HH:mm")}
        </p>
      </div>
    </div>
  );
}

/** A customer <-> seller chat, read only. Nobody is told an admin looked, and nothing is marked as read. */
export default function AdminChatTranscript() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data, isLoading, error } = useAdminTranscript(id);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const customerName = data?.customer?.full_name || data?.customer?.email || "Customer";
  const isSupport = data?.conversation.kind === "support";
  const sellerName = isSupport ? "Kano Kaftan support" : data?.vendor?.store_name || data?.vendor?.full_name || "Seller";
  const byId = new Map((data?.messages ?? []).map((m) => [m.id, m]));

  return (
    <AdminLayout title="Chat">
      <div className="mx-auto max-w-2xl">
        <div className="mb-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" className="-ml-2 h-9 w-9 rounded-full" onClick={() => navigate(-1)} aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {data && (
            <div className="flex min-w-0 flex-1 items-center gap-2 text-sm">
              <Link to={`/admin/users/${data.conversation.customer_id}`} className="flex min-w-0 items-center gap-1.5 hover:underline">
                <Avatar className="h-7 w-7"><AvatarImage src={data.customer?.avatar_url || undefined} /><AvatarFallback><User className="h-3.5 w-3.5" /></AvatarFallback></Avatar>
                <span className="truncate font-medium">{customerName}</span>
              </Link>
              <span className="text-muted-foreground">↔</span>
              {isSupport || !data.conversation.vendor_id ? (
                <span className="truncate font-medium">{sellerName}</span>
              ) : (
                <Link to={`/admin/vendors/${data.conversation.vendor_id}`} className="flex min-w-0 items-center gap-1.5 hover:underline">
                  <Avatar className="h-7 w-7"><AvatarImage src={data.vendor?.avatar_url || undefined} /><AvatarFallback><Store className="h-3.5 w-3.5" /></AvatarFallback></Avatar>
                  <span className="truncate font-medium">{sellerName}</span>
                </Link>
              )}
            </div>
          )}
        </div>

        <p className="mb-4 flex items-center gap-2 rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" />
          Read only. The customer and seller aren't told you viewed this, and their unread messages stay unread.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className={cn("h-12 w-2/3 rounded-2xl", i % 2 === 0 && "ml-auto")} />)}
          </div>
        ) : error ? (
          <p className="py-10 text-center text-sm text-destructive">{(error as Error).message}</p>
        ) : !data ? (
          <p className="py-10 text-center text-sm text-muted-foreground">This chat no longer exists.</p>
        ) : data.messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-muted-foreground">No messages in this chat.</p>
        ) : (
          <div className="space-y-1.5 pb-24">
            <div className="mb-2 flex justify-between px-1 text-[11px] text-muted-foreground">
              <span>← {customerName}</span>
              <span>{sellerName} →</span>
            </div>
            {data.messages.map((message, i) => {
              const date = new Date(message.created_at);
              const previous = data.messages[i - 1];
              const newDay = !previous || !isSameDay(date, new Date(previous.created_at));
              const right = message.sender_id !== data.conversation.customer_id;
              return (
                <div key={message.id}>
                  {newDay && (
                    <p className="my-3 text-center">
                      <span className="rounded-full bg-muted px-3 py-1 text-[11px] text-muted-foreground">{dayLabel(date)}</span>
                    </p>
                  )}
                  <Bubble
                    message={message}
                    right={right}
                    replied={message.reply_to_id ? byId.get(message.reply_to_id) : undefined}
                    onOpenImage={setLightbox}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
      {lightbox && <ImageLightbox src={lightbox} alt="Photo sent in chat" onClose={() => setLightbox(null)} />}
    </AdminLayout>
  );
}
