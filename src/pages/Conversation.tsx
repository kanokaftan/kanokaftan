import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { format, isSameDay } from "date-fns";
import {
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ImageOff,
  ImagePlus,
  Loader2,
  Mic,
  Ban,
  Flag,
  MoreVertical,
  Phone,
  Reply,
  Send,
  Video,
  ShieldAlert,
  ShoppingBag,
  PhoneMissed,
  PhoneOff,
  Square,
  Trash2,
  X,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import {
  CHAT_AUDIO_TYPES,
  CHAT_IMAGE_TYPES,
  CHAT_MEDIA_MAX_BYTES,
  MEDIA_LABELS,
  baseMimeType,
  uploadChatMedia,
  useChatMediaUrl,
  useConversation,
  useTypingIndicator,
  type ChatMessage,
  type ConversationSummary,
  type MessageReaction,
} from "@/hooks/useChat";
import { ChatWithUsButton } from "@/components/chat/ChatWithUsButton";
import { ReactionChips, ReactionPicker } from "@/components/chat/MessageReactions";
import { VoicePlayer } from "@/components/chat/VoicePlayer";
import { LiveWaveform } from "@/components/chat/LiveWaveform";
import { playSound } from "@/lib/callTones";
import { ImageLightbox } from "@/components/chat/ImageLightbox";
import { useLongPress } from "@/hooks/useLongPress";
import { useSwipeToReply } from "@/hooks/useSwipeToReply";
import { useConversationBlock, type ReportTarget } from "@/hooks/useModeration";
import { ReportDialog } from "@/components/moderation/ReportDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { CreateOrderDialog } from "@/components/chat/CreateOrderDialog";
import { ProductCard } from "@/components/chat/ProductCard";
import { OrderCard } from "@/components/chat/OrderCard";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useCall } from "@/contexts/CallContext";
import { formatLastSeen, useConversationPresence } from "@/hooks/usePresence";
import { withoutLeadingEmoji } from "@/lib/text";
import { callLogLabel as callLabelFor, parseCallLog, type CallLogNote } from "@/lib/callLog";
import type { CallKind } from "@/lib/voiceCall";

const MAX_RECORDING_SECONDS = 5 * 60;
/** How long a replied-to message glows after tapping its quote. */
const REPLY_FLASH_MS = 1400;
const QUOTE_MAX_CHARS = 90;

/** Recorder formats in order of preference: webm/opus (Chrome, Firefox, Android), mp4/aac (Safari, iOS). */
const RECORDER_MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickRecorderMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") return undefined;
  return RECORDER_MIME_CANDIDATES.find((type) => MediaRecorder.isTypeSupported(type));
}

const formatDuration = (secs: number) => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

/**
 * One chat. With `admin`, it renders inside the admin dashboard; with `seller`,
 * it is full screen like the shopper's chat but goes back to the seller inbox.
 */
export default function Conversation({ admin = false, seller = false }: { admin?: boolean; seller?: boolean }) {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const basePath = admin ? "/admin/messages" : seller ? "/vendor/messages" : "/messages";
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { conversation, messages, isLoading, sendMessage, userId, reactions, react, otherLastReadAt } = useConversation(id);
  const [reactingTo, setReactingTo] = useState<string | null>(null);
  const reactionsByMessage = new Map<string, MessageReaction[]>();
  for (const reaction of reactions) {
    const list = reactionsByMessage.get(reaction.message_id) ?? [];
    list.push(reaction);
    reactionsByMessage.set(reaction.message_id, list);
  }
  const setReaction = (messageId: string, emoji: string | null) => {
    setReactingTo(null);
    if (emoji) playSound("reaction");
    react.mutate({ messageId, emoji }, { onError: (e) => toast.error(e instanceof Error ? e.message : "Could not react") });
  };
  const { data: presence } = useConversationPresence(conversation?.id);
  const { startCall, inCall } = useCall();
  const presenceLabel = presence?.online ? "online" : presence?.lastSeenAt ? formatLastSeen(presence.lastSeenAt) : null;
  const { otherTyping, notifyTyping, notifyStopped } = useTypingIndicator(conversation?.id, userId);
  const [draft, setDraft] = useState("");
  const [orderOpen, setOrderOpen] = useState(false);
  /** Product picked from a product card in the chat (else the chat's own product). */
  const [orderProductId, setOrderProductId] = useState<string | null>(null);
  const isSupportTeam = conversation?.role === "support_team";
  const openOrderFor = (productId: string) => {
    setOrderProductId(productId);
    setOrderOpen(true);
  };
  const [uploading, setUploading] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  // Block / report (seller chats only; support chats are handled by the team).
  const canModerate = conversation?.kind === "vendor";
  const { iBlocked, blockedMe, setBlocked } = useConversationBlock(canModerate ? conversation?.id : undefined);
  const chatBlocked = canModerate && (iBlocked || blockedMe);
  const [reportTarget, setReportTarget] = useState<{ type: ReportTarget; id: string } | null>(null);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const toggleBlock = (block: boolean) => {
    setBlocked.mutate(block, {
      onSuccess: () => {
        setConfirmBlock(false);
        toast.success(block ? `You blocked ${conversation?.other_party_name ?? "this person"}` : "Unblocked");
      },
      onError: (error) => toast.error(error instanceof Error ? error.message : "Something went wrong"),
    });
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const messagesById = new Map(messages.map((m) => [m.id, m]));

  /** Who wrote a message, as shown in a quote. */
  const authorName = (message: ChatMessage) =>
    message.sender_id === userId
      ? t("chat.you")
      : conversation?.role === "support_team" && message.sender_id !== conversation.other_party_id
        ? t("chat.support")
        : conversation?.other_party_name || t("chat.support");

  const startReply = (message: ChatMessage) => {
    setReactingTo(null);
    setReplyTo(message);
    textareaRef.current?.focus();
  };

  /** Tapping a quote scrolls to the original and flashes it. */
  const jumpToMessage = (messageId: string) => {
    const el = document.getElementById(`msg-${messageId}`);
    if (!el) {
      toast(t("chat.originalUnavailable"));
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.add("animate-reply-flash");
    window.setTimeout(() => el.classList.remove("animate-reply-flash"), REPLY_FLASH_MS);
  };

  // Image attachment
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [voiceNote, setVoiceNote] = useState<{ blob: Blob; url: string } | null>(null);
  const [recordStream, setRecordStream] = useState<MediaStream | null>(null);
  /** "Send" pressed while recording: send as soon as the recording is finalised. */
  const sendAfterStopRef = useRef(false);
  const [autoSendVoice, setAutoSendVoice] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const discardOnStopRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const showJumpRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) navigate(`/auth?redirect=${basePath}/${id}`);
  }, [authLoading, user, navigate, id, basePath]);

  // Support chats opened from a notification or old link: answer them from the dashboard.
  useEffect(() => {
    if (!admin && conversation?.role === "support_team") navigate(`/admin/messages/${conversation.id}`, { replace: true });
  }, [admin, conversation?.role, conversation?.id, navigate]);

  // Follow new messages / the typing bubble unless the reader scrolled up.
  useEffect(() => {
    if (!showJumpRef.current) bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, otherTyping]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const away = el.scrollHeight - el.scrollTop - el.clientHeight > 160;
    showJumpRef.current = away;
    setShowJump(away);
  };

  const jumpToLatest = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    showJumpRef.current = false;
    setShowJump(false);
  };

  // Object URLs are revoked when replaced and on unmount.
  useEffect(
    () => () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview.url);
    },
    [imagePreview],
  );
  useEffect(
    () => () => {
      if (voiceNote) URL.revokeObjectURL(voiceNote.url);
    },
    [voiceNote],
  );

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const releaseMic = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setRecordStream(null);
  };

  // Leaving the page mid-recording must release the microphone.
  useEffect(
    () => () => {
      discardOnStopRef.current = true;
      stopTimer();
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
      releaseMic();
    },
    [],
  );

  const failSend = (error: unknown) => {
    toast.error(error instanceof Error && error.message ? error.message : t("chat.sendFailed"));
  };

  // ── Images ───────────────────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!(CHAT_IMAGE_TYPES as readonly string[]).includes(baseMimeType(file.type))) {
      toast.error(t("chat.unsupportedImage"));
      return;
    }
    if (file.size > CHAT_MEDIA_MAX_BYTES) {
      toast.error(t("chat.fileTooLarge"));
      return;
    }
    setImagePreview({ file, url: URL.createObjectURL(file) });
  };

  const sendImage = async () => {
    if (!imagePreview || !conversation) return;
    setUploading(true);
    try {
      const mediaPath = await uploadChatMedia(conversation.id, imagePreview.file);
      await sendMessage.mutateAsync({
        body: draft.trim() || MEDIA_LABELS.image,
        messageType: "image",
        mediaPath,
        replyToId: replyTo?.id ?? null,
      });
      setImagePreview(null);
      setReplyTo(null);
      setDraft("");
      notifyStopped();
      playSound("send");
    } catch (error: unknown) {
      failSend(error);
    } finally {
      setUploading(false);
    }
  };

  const handleSend = async () => {
    if (imagePreview) return sendImage();
    const body = draft.trim();
    if (!body) return;
    try {
      await sendMessage.mutateAsync({ body, messageType: "text", replyToId: replyTo?.id ?? null });
      setDraft("");
      setReplyTo(null);
      notifyStopped();
      playSound("send");
    } catch (error: unknown) {
      failSend(error);
    }
  };

  // ── Voice notes ──────────────────────────────────────────────────
  const startRecording = async () => {
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      toast.error(t("chat.recordingUnsupported"));
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      toast.error(t("chat.micDenied"));
      return;
    }
    try {
      const mimeType = pickRecorderMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      discardOnStopRef.current = false;
      streamRef.current = stream;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        releaseMic();
        recorderRef.current = null;
        if (discardOnStopRef.current) {
          chunksRef.current = [];
          return;
        }
        // Strip codec params ("audio/webm;codecs=opus" -> "audio/webm") so storage accepts the type.
        const type = baseMimeType(recorder.mimeType || mimeType || "audio/webm");
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (blob.size === 0) return;
        setVoiceNote({ blob, url: URL.createObjectURL(blob) });
        if (sendAfterStopRef.current) {
          sendAfterStopRef.current = false;
          setAutoSendVoice(true);
        }
      };

      recorder.start(250);
      recorderRef.current = recorder;
      setRecordStream(stream);
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime((s) => s + 1), 1000);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
      toast.error(t("chat.recordingUnsupported"));
    }
  };

  const stopRecording = useCallback((discard: boolean, sendNow = false) => {
    discardOnStopRef.current = discard;
    sendAfterStopRef.current = !discard && sendNow;
    stopTimer();
    setIsRecording(false);
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    else releaseMic();
  }, []);

  // Cap recordings so files stay well under the 10 MB limit.
  useEffect(() => {
    if (isRecording && recordingTime >= MAX_RECORDING_SECONDS) stopRecording(false);
  }, [isRecording, recordingTime, stopRecording]);

  const discardVoiceNote = () => {
    setVoiceNote(null);
    setRecordingTime(0);
  };

  const sendVoiceNote = async () => {
    if (!voiceNote || !conversation) return;
    if (!(CHAT_AUDIO_TYPES as readonly string[]).includes(baseMimeType(voiceNote.blob.type))) {
      toast.error(t("chat.recordingUnsupported"));
      return;
    }
    setUploading(true);
    try {
      const mediaPath = await uploadChatMedia(conversation.id, voiceNote.blob);
      await sendMessage.mutateAsync({ body: MEDIA_LABELS.voice, messageType: "voice", mediaPath, replyToId: replyTo?.id ?? null });
      discardVoiceNote();
      setReplyTo(null);
      playSound("send");
    } catch (error: unknown) {
      failSend(error);
    } finally {
      setUploading(false);
    }
  };

  // "Send" tapped while recording: send once the recorder has produced the file.
  useEffect(() => {
    if (autoSendVoice && voiceNote) {
      setAutoSendVoice(false);
      sendVoiceNote();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendVoiceNote is recreated each render
  }, [autoSendVoice, voiceNote]);

  const otherLink = conversation?.role === "customer" && conversation.shop_slug ? `/shop/${conversation.shop_slug}` : null;
  const busy = uploading || sendMessage.isPending;
  const canRecord = !draft.trim() && !imagePreview;

  const chat = (
    <>
      <div
        className={cn(
          "relative flex flex-col overflow-hidden",
          // Soft warm backdrop that shows through the glass header and composer.
          "bg-[radial-gradient(120%_60%_at_100%_0%,hsl(var(--primary)/0.10),transparent_60%),radial-gradient(90%_50%_at_0%_100%,rgba(212,160,23,0.10),transparent_60%)] bg-background",
          // In the dashboard: fit between the admin header/title and the bottom bar.
          admin ? "h-[calc(100dvh-11.5rem)] rounded-xl border md:h-[calc(100dvh-7.5rem)]" : "h-[100dvh]",
        )}
      >
        {/* Header */}
        <div
          className={cn(
            // No bar: floating glass pieces over the chat, like WhatsApp; the messages fade out behind them.
            "absolute inset-x-0 top-0 z-30 flex items-center gap-2 bg-gradient-to-b from-background via-background/85 to-transparent px-3 pb-5 pt-2",
            !admin && "pt-[calc(env(safe-area-inset-top)+0.5rem)]",
          )}
        >
          <Button variant="ghost" size="icon" className="liquid-glass liquid-glass-press h-12 w-12 shrink-0 rounded-full" onClick={() => navigate(basePath)} aria-label={t("chat.backToMessages")}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {conversation ? (
            <div className="liquid-glass flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full py-1 pl-1 pr-4">
              <div className="relative shrink-0">
                {conversation.role === "support_user" ? (
                  // Chatting with the Kano Kaftan team: show the brand, not a letter.
                  <BrandLogo tile className="h-10 w-10 rounded-full ring-2 ring-white/70 dark:ring-white/10" alt="Kano Kaftan" />
                ) : (
                  <Avatar className="h-10 w-10 ring-2 ring-white/70 shadow-sm dark:ring-white/10">
                    <AvatarImage src={conversation.other_party_avatar || undefined} alt="" />
                    <AvatarFallback className="bg-gradient-to-br from-primary/80 to-primary text-primary-foreground">{conversation.other_party_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
                {presence?.online && (
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" aria-label="Online" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                {otherLink ? (
                  <Link to={otherLink} className="block truncate text-[15px] font-semibold leading-tight hover:underline">
                    {conversation.other_party_name}
                  </Link>
                ) : (
                  <p className="truncate text-[15px] font-semibold leading-tight">{conversation.other_party_name}</p>
                )}
                {otherTyping ? (
                  <p className="truncate text-xs font-medium text-green-600">{t("chat.typing")}</p>
                ) : presenceLabel ? (
                  <p className={cn("truncate text-xs", presence?.online ? "font-medium text-green-600" : "text-muted-foreground")}>
                    {presenceLabel}
                  </p>
                ) : (
                  conversation.product_name &&
                  conversation.product_slug && (
                    <Link
                      to={`/products/${conversation.product_slug}`}
                      className="block truncate text-xs text-muted-foreground hover:underline"
                    >
                      {t("chat.about")}: {conversation.product_name}
                    </Link>
                  )
                )}
              </div>
            </div>
          ) : (
            <Skeleton className="h-12 flex-1 rounded-full" />
          )}
          {conversation && (
            <div className="liquid-glass flex h-12 shrink-0 items-center rounded-full px-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-10 shrink-0 rounded-full hover:bg-foreground/5"
              aria-label={`Video call ${conversation.other_party_name}`}
              disabled={inCall || chatBlocked}
              onClick={() => startCall(conversation.id, { name: conversation.other_party_name, avatar: conversation.role === "support_user" ? "/logo.svg" : conversation.other_party_avatar }, "video")}
            >
              <Video className="h-[22px] w-[22px]" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-10 shrink-0 rounded-full hover:bg-foreground/5"
              aria-label={`Voice call ${conversation.other_party_name}`}
              disabled={inCall || chatBlocked}
              onClick={() => startCall(conversation.id, { name: conversation.other_party_name, avatar: conversation.role === "support_user" ? "/logo.svg" : conversation.other_party_avatar })}
            >
              <Phone className="h-[21px] w-[21px]" />
            </Button>
            </div>
          )}
          {conversation && canModerate && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="liquid-glass liquid-glass-press h-12 w-9 shrink-0 rounded-full"
                  aria-label="More options"
                >
                  <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 rounded-xl">
                <DropdownMenuItem onSelect={() => setReportTarget({ type: "user", id: conversation.id })}>
                  <Flag className="mr-2 h-4 w-4" /> Report {conversation.other_party_name}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {iBlocked ? (
                  <DropdownMenuItem onSelect={() => toggleBlock(false)}>
                    <Ban className="mr-2 h-4 w-4" /> Unblock
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setConfirmBlock(true)}>
                    <Ban className="mr-2 h-4 w-4" /> Block
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {conversation?.role === "support_team" && conversation.other_party_id && (
            <Button size="sm" className="h-12 shrink-0 rounded-full" onClick={() => setOrderOpen(true)}>
              <ShoppingBag className="mr-1 h-4 w-4" />
              {t("chat.createOrder")}
            </Button>
          )}
        </div>

        {/* Messages */}
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          data-no-pull-refresh
          className={cn(
            "flex-1 space-y-1.5 overflow-y-auto px-3",
            admin ? "pt-20" : "pt-[calc(env(safe-area-inset-top)+5rem)]",
            imagePreview && replyTo ? "pb-64" : imagePreview ? "pb-48" : replyTo ? "pb-44" : "pb-28",
          )}
        >
          <ChatNotice conversation={conversation} />

          {isLoading ? (
            <Loader2 className="mx-auto h-5 w-5 animate-spin" />
          ) : !conversation ? (
            <p className="text-center text-sm text-muted-foreground">{t("chat.notFound")}</p>
          ) : messages.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground">{t("chat.sayHello")}</p>
          ) : (
            messages.map((message, index) => {
              const mine = message.sender_id === userId;
              const created = new Date(message.created_at);
              const showDate = index === 0 || !isSameDay(created, new Date(messages[index - 1].created_at));
              return (
                <div key={message.id} className="animate-in fade-in-0 slide-in-from-bottom-1 duration-200">
                  {showDate && (
                    <p className="my-3 flex justify-center">
                      <span className="rounded-full border border-white/40 bg-background/70 px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur dark:border-white/10">
                        {format(created, "EEE, MMM d")}
                      </span>
                    </p>
                  )}
                  <ReactableMessage
                    message={message}
                    mine={mine}
                    userId={userId}
                    reactions={reactionsByMessage.get(message.id) ?? []}
                    pickerOpen={reactingTo === message.id}
                    onOpenPicker={() => setReactingTo(message.id)}
                    onClosePicker={() => setReactingTo(null)}
                    onReact={(emoji) => setReaction(message.id, emoji)}
                    onOpenImage={setLightboxSrc}
                    onReply={chatBlocked ? undefined : () => startReply(message)}
                    onReport={
                      mine
                        ? undefined
                        : () => {
                            setReactingTo(null);
                            setReportTarget({ type: "message", id: message.id });
                          }
                    }
                    quoted={message.reply_to_id ? { message: messagesById.get(message.reply_to_id) ?? null, author: (m) => authorName(m) } : null}
                    onJumpToQuote={() => message.reply_to_id && jumpToMessage(message.reply_to_id)}
                    read={mine && !!otherLastReadAt && new Date(otherLastReadAt) >= created}
                    onCreateOrder={isSupportTeam && !mine ? openOrderFor : undefined}
                    onCallBack={conversation && !chatBlocked && !inCall ? (kind) => startCall(conversation.id, { name: conversation.other_party_name, avatar: conversation.role === "support_user" ? "/logo.svg" : conversation.other_party_avatar }, kind) : undefined}
                  />
                </div>
              );
            })
          )}

          {otherTyping && (
            <div className="flex justify-start animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
              <div className="rounded-3xl rounded-bl-md border border-white/50 bg-background/80 shadow-sm backdrop-blur dark:border-white/10" role="status" aria-label={t("chat.typing")}>
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {showJump && (
          <button
            type="button"
            onClick={jumpToLatest}
            aria-label={t("chat.jumpToLatest")}
            className="liquid-glass absolute bottom-28 right-4 z-20 rounded-full p-2 text-foreground transition-colors animate-in zoom-in-75 duration-200 hover:bg-background"
          >
            <ChevronDown className="h-5 w-5" />
          </button>
        )}

        {conversation?.role === "support_team" && conversation.other_party_id && (
          <CreateOrderDialog
            open={orderOpen}
            onOpenChange={(open) => {
              setOrderOpen(open);
              if (!open) setOrderProductId(null);
            }}
            customerId={conversation.other_party_id}
            conversationId={conversation.id}
            suggestedProductId={orderProductId ?? conversation.product_id}
          />
        )}

        {/* Composer */}
        {conversation && (
          <div className="absolute inset-x-0 bottom-0 z-30 px-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2">
            {/* Image preview (the text box below becomes its caption) */}
            {imagePreview && (
              <div className="liquid-glass mb-2 flex items-center gap-2 rounded-3xl p-2 animate-in slide-in-from-bottom-2 duration-200">
                <img src={imagePreview.url} alt="" className="h-14 w-14 flex-shrink-0 rounded-2xl object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{imagePreview.file.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {(imagePreview.file.size / 1024).toFixed(0)} KB · {t("chat.captionHint")}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setImagePreview(null)}
                  disabled={uploading}
                  aria-label={t("chat.removeImage")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {chatBlocked ? (
              <div className="liquid-glass rounded-3xl p-4 text-center">
                <p className="text-sm font-medium">
                  {iBlocked ? `You blocked ${conversation.other_party_name}.` : "You can't reply to this conversation."}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {iBlocked ? "They can't message or call you." : "This person isn't accepting messages from you."}
                </p>
                {iBlocked && (
                  <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => toggleBlock(false)} disabled={setBlocked.isPending}>
                    Unblock
                  </Button>
                )}
              </div>
            ) : (
            <>
            {replyTo && (
              <div className="liquid-glass mb-2 flex items-center gap-2 rounded-3xl py-2 pl-3 pr-1.5 animate-in slide-in-from-bottom-2 duration-200">
                <Reply className="h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1 border-l-[3px] border-primary pl-2">
                  <p className="truncate text-xs font-semibold text-primary">{t("chat.replyingTo", { name: authorName(replyTo) })}</p>
                  <p className="truncate text-xs text-muted-foreground">{quoteSnippet(replyTo)}</p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 rounded-full"
                  onClick={() => setReplyTo(null)}
                  aria-label={t("chat.cancelReply")}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}

            {isRecording ? (
              /* Recording in progress: live waveform, timer, cancel / stop / send */
              <div className="liquid-glass flex items-center gap-2 rounded-full p-1.5 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={() => stopRecording(true)}
                  aria-label={t("chat.cancelRecording")}
                  title={t("chat.cancelRecording")}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
                <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold tabular-nums text-red-600">
                  <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.2)]" />
                  {formatDuration(recordingTime)}
                </span>
                <LiveWaveform stream={recordStream} className="min-w-0 flex-1 px-1" />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0 rounded-full"
                  onClick={() => stopRecording(false)}
                  aria-label={`${t("chat.stop")} (listen before sending)`}
                  title={t("chat.stop")}
                >
                  <Square className="h-4 w-4 fill-current" />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-md"
                  onClick={() => stopRecording(false, true)}
                  aria-label={t("chat.send")}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            ) : voiceNote ? (
              /* Recorded, ready to listen and send */
              <div className="liquid-glass flex items-center gap-2 rounded-full p-1.5 pl-3 animate-in slide-in-from-bottom-2 duration-200">
                <VoicePlayer src={voiceNote.url} className="min-w-0 flex-1" />
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0 rounded-full text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
                  onClick={discardVoiceNote}
                  disabled={uploading}
                  aria-label={t("chat.discardVoice")}
                  title={t("chat.discardVoice")}
                >
                  <Trash2 className="h-5 w-5" />
                </Button>
                <Button
                  size="icon"
                  className="h-11 w-11 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-md"
                  onClick={sendVoiceNote}
                  disabled={busy}
                  aria-label={t("chat.send")}
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                </Button>
              </div>
            ) : (
              /* Text / image composer: floating glass pill */
              <div className="flex items-end gap-2">
                <div className="liquid-glass flex min-w-0 flex-1 items-end gap-1 rounded-[26px] p-1">
                <input
                  ref={imageInputRef}
                  type="file"
                  accept={CHAT_IMAGE_TYPES.join(",")}
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-10 w-10 shrink-0 rounded-full"
                  onClick={() => imageInputRef.current?.click()}
                  disabled={busy}
                  aria-label={t("chat.sendImage")}
                  title={t("chat.sendImage")}
                >
                  <ImagePlus className="h-5 w-5 text-muted-foreground" />
                </Button>
                <Textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    if (e.target.value.trim()) notifyTyping();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                    if (e.key === "Escape" && replyTo) setReplyTo(null);
                  }}
                  placeholder={imagePreview ? t("chat.addCaption") : t("chat.placeholder")}
                  rows={1}
                  maxLength={2000}
                  className="max-h-32 min-h-[40px] resize-none border-0 bg-transparent px-1 py-2.5 text-[15px] shadow-none focus-visible:ring-0 focus-visible:ring-offset-0"
                />
                </div>
                {canRecord ? (
                  <Button
                    type="button"
                    size="icon"
                    className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg transition-transform active:scale-90"
                    onClick={startRecording}
                    disabled={busy}
                    aria-label={t("chat.recordVoice")}
                    title={t("chat.recordVoice")}
                  >
                    <Mic className="h-5 w-5" />
                  </Button>
                ) : (
                  <Button
                    size="icon"
                    className="h-12 w-12 shrink-0 rounded-full bg-gradient-to-br from-primary to-primary/80 shadow-lg transition-transform animate-in zoom-in-75 duration-150 active:scale-90"
                    onClick={handleSend}
                    disabled={busy || (!draft.trim() && !imagePreview)}
                    aria-label={t("chat.send")}
                  >
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </Button>
                )}
              </div>
            )}
            </>
            )}
          </div>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <ReportDialog
        open={!!reportTarget}
        onOpenChange={(open) => !open && setReportTarget(null)}
        targetType={reportTarget?.type ?? "user"}
        targetId={reportTarget?.id ?? null}
        onReported={() => {
          if (canModerate && !iBlocked) setConfirmBlock(true);
        }}
      />
      <AlertDialog open={confirmBlock} onOpenChange={setConfirmBlock}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Block {conversation?.other_party_name ?? "this person"}?</AlertDialogTitle>
            <AlertDialogDescription>
              They won't be able to message or call you, and you won't be able to message or call them. You can unblock any time from this chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={setBlocked.isPending}>Not now</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                toggleBlock(true);
              }}
              disabled={setBlocked.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {setBlocked.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Block
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  return admin ? (
    <AdminLayout title="Messages">{chat}</AdminLayout>
  ) : (
    <MobileLayout hideHeader hideBottomNav>{chat}</MobileLayout>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-muted-foreground/50 animate-typing-dot"
          style={{ animationDelay: `${i * 0.18}s` }}
        />
      ))}
    </div>
  );
}

/** Short text for a quoted message: its words, or what kind of attachment it was. */
function quoteSnippet(message: ChatMessage): string {
  if (message.message_type === "voice") return MEDIA_LABELS.voice;
  if (message.message_type === "image") return message.body !== MEDIA_LABELS.image ? `Photo: ${message.body}` : MEDIA_LABELS.image;
  return message.body.length > QUOTE_MAX_CHARS ? `${message.body.slice(0, QUOTE_MAX_CHARS - 1)}…` : message.body;
}

interface QuotedMessage {
  /** null when the original isn't loaded (very old) or was removed. */
  message: ChatMessage | null;
  author: (message: ChatMessage) => string;
}

/** A message with long-press reactions, swipe-to-reply, and the reaction chips under it. */
function ReactableMessage({
  message,
  mine,
  userId,
  reactions,
  pickerOpen,
  onOpenPicker,
  onClosePicker,
  onReact,
  onOpenImage,
  onReply,
  onReport,
  quoted,
  onJumpToQuote,
  read,
  onCreateOrder,
  onCallBack,
}: {
  message: ChatMessage;
  mine: boolean;
  userId: string | null;
  reactions: MessageReaction[];
  pickerOpen: boolean;
  onOpenPicker: () => void;
  onClosePicker: () => void;
  onReact: (emoji: string | null) => void;
  onOpenImage: (src: string) => void;
  onReply?: () => void;
  onReport?: () => void;
  quoted: QuotedMessage | null;
  onJumpToQuote: () => void;
  read: boolean;
  onCreateOrder?: (productId: string) => void;
  onCallBack?: (kind: CallKind) => void;
}) {
  const longPress = useLongPress(onOpenPicker);
  const swipe = useSwipeToReply(() => onReply?.());
  const myReaction = reactions.find((r) => r.user_id === userId)?.emoji ?? null;
  const copyable = message.message_type === "text";

  // Both gestures listen to the same finger.
  const gestureHandlers = {
    onPointerDown: (e: React.PointerEvent) => {
      longPress.onPointerDown(e);
      swipe.handlers.onPointerDown(e);
    },
    onPointerMove: (e: React.PointerEvent) => {
      longPress.onPointerMove(e);
      swipe.handlers.onPointerMove(e);
    },
    onPointerUp: () => {
      longPress.onPointerUp();
      swipe.handlers.onPointerUp();
    },
    onPointerCancel: () => {
      longPress.onPointerCancel();
      swipe.handlers.onPointerCancel();
    },
    onContextMenu: longPress.onContextMenu,
    onDoubleClick: longPress.onDoubleClick,
  };

  const copy = async () => {
    onClosePicker();
    try {
      await navigator.clipboard.writeText(message.body);
      toast.success("Copied");
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div id={`msg-${message.id}`} className={cn("flex flex-col rounded-2xl transition-colors", mine ? "items-end" : "items-start", reactions.length > 0 && "mb-1")}>
      <div
        {...gestureHandlers}
        className={cn(
          "relative flex max-w-[80%] touch-pan-y select-none [-webkit-touch-callout:none]",
          mine ? "justify-end" : "justify-start",
          pickerOpen && "z-50",
        )}
      >
        {/* Reply arrow that appears as the message is swiped */}
        {swipe.offset > 0 && (
          <span
            aria-hidden
            className="absolute left-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-background/80 text-primary shadow backdrop-blur"
            style={{ opacity: swipe.progress, transform: `translate(${swipe.offset / 2 - 36}px, -50%) scale(${0.6 + swipe.progress * 0.4})` }}
          >
            <Reply className="h-4 w-4" />
          </span>
        )}
        {pickerOpen && (
          <ReactionPicker
            mine={mine}
            current={myReaction}
            onPick={onReact}
            onReply={onReply}
            onReport={onReport}
            onCopy={copyable ? copy : undefined}
            onClose={onClosePicker}
          />
        )}
        <div
          className={cn("relative", swipe.offset === 0 && "transition-transform", pickerOpen && "z-50 scale-[1.02]")}
          style={swipe.offset ? { transform: `translateX(${swipe.offset}px)` } : undefined}
        >
          <MessageBubble message={message} mine={mine} onOpenImage={onOpenImage} quoted={quoted} onJumpToQuote={onJumpToQuote} read={read} onCreateOrder={onCreateOrder} onCallBack={onCallBack} />
        </div>
      </div>
      <ReactionChips
        reactions={reactions}
        userId={userId}
        mine={mine}
        onToggle={(emoji) => onReact(emoji === myReaction ? null : emoji)}
      />
    </div>
  );
}

/** The quoted message shown at the top of a reply bubble; tap to jump to it. */
function QuoteBlock({ quoted, mine, onJump }: { quoted: QuotedMessage; mine: boolean; onJump: () => void }) {
  const { t } = useTranslation();
  const original = quoted.message;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onJump();
      }}
      className={cn(
        "mb-1 block w-full min-w-[8rem] rounded-2xl border-l-[3px] px-2.5 py-1.5 text-left",
        mine ? "border-white/80 bg-white/15" : "border-primary bg-primary/10",
      )}
    >
      {original ? (
        <>
          <span className={cn("block truncate text-xs font-semibold", mine ? "text-primary-foreground" : "text-primary")}>{quoted.author(original)}</span>
          <span className={cn("line-clamp-2 text-xs", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>{quoteSnippet(original)}</span>
        </>
      ) : (
        <span className={cn("text-xs italic", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>{t("chat.originalUnavailable")}</span>
      )}
    </button>
  );
}

function MessageBubble({
  message,
  mine,
  onOpenImage,
  quoted,
  onJumpToQuote,
  read,
  onCreateOrder,
  onCallBack,
}: {
  message: ChatMessage;
  mine: boolean;
  onOpenImage: (src: string) => void;
  quoted: QuotedMessage | null;
  onJumpToQuote: () => void;
  read: boolean;
  onCreateOrder?: (productId: string) => void;
  onCallBack?: (kind: CallKind) => void;
}) {
  const { t } = useTranslation();
  const created = new Date(message.created_at);
  const callLog = message.message_type === "text" ? parseCallLog(message.body) : null;
  if (callLog) return <CallLogBubble note={callLog} mine={mine} time={format(created, "h:mm a")} onCallBack={onCallBack} />;
  const isImage = message.message_type === "image" && !!message.media_path;
  const isVoice = message.message_type === "voice" && !!message.media_path;
  // Media messages carry a default label body; any other body on an image is its caption.
  const cleanBody = withoutLeadingEmoji(message.body);
  const caption = isImage && cleanBody && cleanBody !== MEDIA_LABELS.image ? cleanBody : null;

  return (
    <div
      className={cn(
        "max-w-full whitespace-pre-wrap break-words rounded-3xl text-[15px] leading-snug",
        isImage ? "overflow-hidden p-1" : isVoice ? "px-2.5 py-2" : "px-3.5 py-2",
        quoted && !isImage && "pt-1.5",
        mine
          ? "chat-bubble-out rounded-br-md text-primary-foreground shadow-[0_6px_20px_-8px_hsl(var(--chat-out)/0.6)]"
          : "rounded-bl-md border border-white/50 bg-background/80 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.2)] backdrop-blur dark:border-white/10",
      )}
    >
      {quoted && <QuoteBlock quoted={quoted} mine={mine} onJump={onJumpToQuote} />}
      {message.product_id && <ProductCard productId={message.product_id} mine={mine} onCreateOrder={onCreateOrder} />}
      {isImage ? (
        <ImageAttachment path={message.media_path!} onOpen={onOpenImage} />
      ) : isVoice ? (
        <VoiceAttachment path={message.media_path!} mine={mine} />
      ) : (
        <MessageBody body={withoutLeadingEmoji(message.body)} mine={mine} />
      )}
      {caption && (
        <p className="px-2 pt-1">
          <MessageBody body={caption} mine={mine} />
        </p>
      )}
      <span
        className={cn(
          "mt-1 flex items-center justify-end gap-1 text-[10px]",
          isImage && "px-2 pb-0.5",
          mine ? "text-primary-foreground/70" : "text-muted-foreground",
        )}
      >
        {format(created, "h:mm a")}
        {mine &&
          (read ? (
            <CheckCheck className="h-3.5 w-3.5 text-sky-300" aria-label={t("chat.read")} />
          ) : (
            <Check className="h-3.5 w-3.5" aria-label={t("chat.sent")} />
          ))}
      </span>
    </div>
  );
}

/** Missed or declined call note, with a one-tap call back. */
function CallLogBubble({ note, mine, time, onCallBack }: { note: CallLogNote; mine: boolean; time: string; onCallBack?: (kind: CallKind) => void }) {
  const Icon = note.kind === "video" ? Video : note.status === "missed" && !mine ? PhoneMissed : PhoneOff;
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-white/50 bg-background/80 py-2 pl-2.5 pr-2 shadow-[0_4px_16px_-8px_rgba(0,0,0,0.2)] backdrop-blur dark:border-white/10">
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", !mine ? "bg-red-500/10 text-red-600" : "bg-muted text-muted-foreground")}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{callLabelFor(note, mine)}</span>
        <span className="block text-[11px] text-muted-foreground">{time}</span>
      </span>
      {onCallBack && (
        <button
          type="button"
          onClick={() => onCallBack(note.kind)}
          className="ml-1 flex shrink-0 items-center gap-1.5 rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white active:scale-95"
        >
          {note.kind === "video" ? <Video className="h-3.5 w-3.5" /> : <Phone className="h-3.5 w-3.5" />}
          {mine ? "Call again" : "Call back"}
        </button>
      )}
    </div>
  );
}

function ImageAttachment({ path, onOpen }: { path: string; onOpen: (src: string) => void }) {
  const { t } = useTranslation();
  const { data: src, isLoading, isError } = useChatMediaUrl(path);
  const [failed, setFailed] = useState(false);

  if (isLoading) return <Skeleton className="h-[180px] w-[220px] max-w-full rounded-xl" />;
  if (isError || failed || !src) {
    return (
      <div className="flex h-24 w-[220px] max-w-full flex-col items-center justify-center gap-1 rounded-xl bg-background/30 text-xs opacity-80">
        <ImageOff className="h-5 w-5" />
        {t("chat.mediaUnavailable")}
      </div>
    );
  }
  return (
    <button type="button" onClick={() => onOpen(src)} className="block" aria-label={t("chat.viewImage")}>
      <img
        src={src}
        alt={t("chat.image")}
        loading="lazy"
        onError={() => setFailed(true)}
        className="max-h-[260px] w-[220px] max-w-full cursor-zoom-in rounded-xl object-cover transition-opacity hover:opacity-90"
      />
    </button>
  );
}

function VoiceAttachment({ path, mine }: { path: string; mine: boolean }) {
  const { t } = useTranslation();
  const { data: src, isLoading, isError } = useChatMediaUrl(path);

  if (isLoading) return <Skeleton className="h-11 w-[230px] max-w-full rounded-full" />;
  if (isError || !src) {
    return (
      <span className="flex items-center gap-2 py-1 text-xs opacity-80">
        <Mic className="h-4 w-4" /> {t("chat.mediaUnavailable")}
      </span>
    );
  }
  return <VoicePlayer src={src} cacheKey={path} tone={mine ? "dark" : "light"} />;
}

/** Context banner at the top of a thread. */
function ChatNotice({ conversation }: { conversation: ConversationSummary | null }) {
  const { t } = useTranslation();
  if (!conversation) return null;

  if (conversation.role === "support_user") {
    return (
      <div className="mx-auto mb-3 flex max-w-md gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <BrandLogo tile className="h-5 w-5 flex-shrink-0 rounded-md" alt="" />
        <p>
          You're chatting with the Kano Kaftan team. Tell us what you'd like to buy: we get it from the seller, arrange
          delivery and send you a secure payment link here. The seller is only fully paid after you receive it.
        </p>
      </div>
    );
  }

  if (conversation.role === "support_team") {
    return (
      <div className="mx-auto mb-3 flex max-w-md gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
        <BrandLogo tile className="h-5 w-5 flex-shrink-0 rounded-md" alt="" />
        <p>
          Support chat with {conversation.other_party_is_vendor ? "a vendor" : "a customer"}. Replies are sent as Kano
          Kaftan and every admin can see this thread.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto mb-3 max-w-md space-y-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100">
      <div className="flex gap-2">
        <ShieldAlert className="h-4 w-4 flex-shrink-0" />
        <p>
          {conversation.role === "customer"
            ? "Deals you agree directly with the seller, and payments made outside Kano Kaftan, are at your own risk."
            : "Deals agreed directly with customers are outside Kano Kaftan's protection."}
        </p>
      </div>
      {conversation.role === "customer" && (
        <ChatWithUsButton
          size="sm"
          variant="outline"
          className="w-full bg-background"
          productId={conversation.product_id ?? undefined}
          label={t("chat.buyProtected")}
        />
      )}
    </div>
  );
}

/** Turns "/orders/<id>" in a message into an order card with "Pay now". */
function MessageBody({ body, mine }: { body: string; mine: boolean }) {
  const parts = body.split(/(\/orders\/[0-9a-f-]{36})/g);
  return (
    <>
      {parts.map((part, i) =>
        /^\/orders\/[0-9a-f-]{36}$/.test(part) ? (
          <OrderCard key={i} orderId={part.slice("/orders/".length)} mine={mine} />
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}
