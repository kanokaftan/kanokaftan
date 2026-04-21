import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, ArrowLeft, ShoppingBag, ChevronDown, Mic, Square, ImagePlus, X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyRole } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Message {
  id: string;
  content: string;
  is_admin: boolean;
  sender_id: string;
  created_at: string;
  message_type?: string;
  media_url?: string | null;
}

interface Chat {
  id: string;
  status: string;
  product_id: string | null;
  products?: { name: string; price: number; images: string[] } | null;
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 px-4 py-2">
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

function VoicePlayer({ src, isAdmin }: { src: string; isAdmin: boolean }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Mic className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <audio
        controls
        src={src}
        className="h-8"
        style={{ maxWidth: 180 }}
      />
    </div>
  );
}

const formatDuration = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

export default function Chat() {
  const { user, isLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const productId = searchParams.get("product");

  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [adminTyping, setAdminTyping] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  // Image state
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) initChat();
    return () => {
      channelRef.current && supabase.removeChannel(channelRef.current);
      typingChannelRef.current && supabase.removeChannel(typingChannelRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      if (imagePreview) URL.revokeObjectURL(imagePreview.url);
    };
  }, [user]);

  useEffect(() => {
    if (!showScrollBtn) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, adminTyping]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  };

  const loadMessages = useCallback(async (chatId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  }, []);

  const subscribeToMessages = useCallback((chatId: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    channelRef.current = supabase
      .channel(`messages:${chatId}`)
      .on("postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new as Message];
          });
        }
      )
      .subscribe();
  }, []);

  const subscribeToTyping = useCallback((chatId: string) => {
    if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
    typingChannelRef.current = supabase
      .channel(`typing:${chatId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        if (payload.payload?.is_admin) {
          setAdminTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setAdminTyping(false), 3000);
        }
      })
      .subscribe();
  }, []);

  const initChat = async () => {
    try {
      const { data: existingChat } = await supabase
        .from("chats")
        .select("*, products(name, price, images)")
        .eq("customer_id", user!.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingChat) {
        setChat(existingChat);
        await loadMessages(existingChat.id);
        subscribeToMessages(existingChat.id);
        subscribeToTyping(existingChat.id);
      } else {
        const { data: newChat } = await supabase
          .from("chats")
          .insert({ customer_id: user!.id, product_id: productId || null, status: "open" })
          .select("*, products(name, price, images)")
          .single();

        if (newChat) {
          setChat(newChat);
          await supabase.from("messages").insert({
            chat_id: newChat.id,
            sender_id: user!.id,
            content: productId ? "Hi! I'm interested in ordering this product." : "Hi! I'd like to place an order.",
            is_admin: false,
          });
          await loadMessages(newChat.id);
          subscribeToMessages(newChat.id);
          subscribeToTyping(newChat.id);
        }
      }
    } catch (error) {
      console.error("Error initializing chat:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chat || sending) return;
    const content = newMessage.trim();
    setNewMessage("");
    setSending(true);
    try {
      await supabase.from("messages").insert({
        chat_id: chat.id,
        sender_id: user!.id,
        content,
        is_admin: false,
        message_type: "text",
      });
      notifyRole("admin", {
        title: "New customer message",
        message: content,
        type: "info",
        category: "general",
        actionUrl: `/admin/chats`,
        metadata: { chat_id: chat.id },
      }).catch(() => {});
    } catch (error) {
      console.error("Error sending message:", error);
      setNewMessage(content);
    } finally {
      setSending(false);
    }
  };

  // ── Voice recording ───────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        setAudioBlob(blob);
        setAudioPreviewUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => setRecordingTime((t) => t + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  };

  const discardRecording = () => {
    setAudioBlob(null);
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setRecordingTime(0);
  };

  const sendVoiceNote = async () => {
    if (!audioBlob || !chat) return;
    setUploading(true);
    try {
      const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
      const fileName = `voice/${chat.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("chat-media").upload(fileName, audioBlob);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(fileName);

      await supabase.from("messages").insert({
        chat_id: chat.id,
        sender_id: user!.id,
        content: "",
        is_admin: false,
        message_type: "voice",
        media_url: publicUrl,
      });
      notifyRole("admin", { title: "New voice message", message: "Customer sent a voice note", type: "info", category: "general", actionUrl: "/admin/chats", metadata: { chat_id: chat.id } }).catch(() => {});
      discardRecording();
    } catch {
      toast.error("Failed to send voice note");
    } finally {
      setUploading(false);
    }
  };

  // ── Image upload ──────────────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); return; }
    if (imagePreview) URL.revokeObjectURL(imagePreview.url);
    setImagePreview({ file, url: URL.createObjectURL(file) });
    e.target.value = "";
  };

  const discardImage = () => {
    if (imagePreview) URL.revokeObjectURL(imagePreview.url);
    setImagePreview(null);
  };

  const sendImage = async () => {
    if (!imagePreview || !chat) return;
    setUploading(true);
    try {
      const ext = imagePreview.file.name.split(".").pop() || "jpg";
      const fileName = `images/${chat.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("chat-media").upload(fileName, imagePreview.file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(fileName);

      await supabase.from("messages").insert({
        chat_id: chat.id,
        sender_id: user!.id,
        content: "",
        is_admin: false,
        message_type: "image",
        media_url: publicUrl,
      });
      notifyRole("admin", { title: "New image message", message: "Customer sent an image", type: "info", category: "general", actionUrl: "/admin/chats", metadata: { chat_id: chat.id } }).catch(() => {});
      discardImage();
    } catch {
      toast.error("Failed to send image");
    } finally {
      setUploading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Connecting...</p>
        </div>
      </div>
    );
  }

  const grouped = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const isGrouped =
      prev &&
      prev.is_admin === msg.is_admin &&
      (msg.message_type || "text") === (prev.message_type || "text") &&
      new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 60000;
    return { ...msg, isGrouped };
  });

  const isClosed = chat?.status === "closed";
  const canSend = !isClosed && !uploading;

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-card border-b px-4 py-3 flex items-center gap-3 shadow-sm shrink-0">
        <button onClick={() => navigate(-1)} className="p-1.5 rounded-full hover:bg-muted transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center shrink-0">
          <span className="text-primary-foreground text-sm font-bold">K</span>
        </div>
        <div className="flex-1">
          <h1 className="font-semibold text-foreground text-sm">Kano Kaftan</h1>
          <p className="text-xs text-green-500 flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Online
          </p>
        </div>
        <ShoppingBag className="w-5 h-5 text-muted-foreground" />
      </div>

      {/* Product banner */}
      {chat?.products && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-3 shrink-0 animate-in slide-in-from-top-2 duration-300">
          {chat.products.images?.[0] && (
            <img src={chat.products.images[0]} className="w-10 h-10 rounded-lg object-cover" alt="" />
          )}
          <div>
            <p className="text-xs text-amber-800 font-medium">{chat.products.name}</p>
            <p className="text-xs text-amber-600">₦{chat.products.price?.toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 animate-in fade-in-0 duration-500">
            <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center mb-4">
              <span className="text-primary-foreground text-2xl font-display font-bold">K</span>
            </div>
            <h2 className="font-semibold text-foreground mb-1">Welcome to Kano Kaftan</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              Send us a message and we'll get back to you shortly.
            </p>
          </div>
        )}

        {grouped.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex animate-in fade-in-0 duration-300",
              msg.isGrouped ? "slide-in-from-bottom-1" : "slide-in-from-bottom-3",
              msg.is_admin ? "justify-start" : "justify-end",
              msg.isGrouped ? "mt-0.5" : "mt-3"
            )}
          >
            {msg.is_admin && !msg.isGrouped && (
              <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mr-2 shrink-0 self-end mb-1">
                K
              </div>
            )}
            {msg.is_admin && msg.isGrouped && <div className="w-7 mr-2 shrink-0" />}

            <div
              className={cn(
                "max-w-[78%] text-sm leading-relaxed",
                msg.message_type === "image" ? "p-1 rounded-2xl overflow-hidden" : "px-3.5 py-2",
                msg.is_admin
                  ? "bg-card text-foreground shadow-sm border"
                  : "bg-primary text-primary-foreground",
                msg.is_admin
                  ? msg.isGrouped ? "rounded-2xl rounded-tl-sm" : "rounded-2xl rounded-bl-sm"
                  : msg.isGrouped ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-br-sm"
              )}
            >
              {msg.message_type === "voice" && msg.media_url ? (
                <VoicePlayer src={msg.media_url} isAdmin={msg.is_admin} />
              ) : msg.message_type === "image" && msg.media_url ? (
                <img
                  src={msg.media_url}
                  alt="Shared image"
                  onClick={() => setLightboxSrc(msg.media_url!)}
                  className="max-w-[220px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity rounded-xl"
                />
              ) : (
                msg.content
              )}
              {!msg.isGrouped && msg.message_type !== "image" && (
                <p className={cn("text-[10px] mt-1", msg.is_admin ? "text-muted-foreground" : "text-primary-foreground/60")}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
        ))}

        {adminTyping && (
          <div className="flex justify-start mt-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
            <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold mr-2 shrink-0 self-end">
              K
            </div>
            <div className="bg-card border rounded-2xl rounded-bl-sm shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Jump to latest */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-4 p-2 rounded-full bg-primary text-primary-foreground shadow-lg animate-in zoom-in-75 duration-200 hover:bg-primary/90 transition-colors"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Input area */}
      <div className="bg-card border-t px-4 py-3 shrink-0">

        {/* Image preview strip */}
        {imagePreview && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-muted/50 rounded-xl border animate-in slide-in-from-bottom-2 duration-200">
            <img src={imagePreview.url} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{imagePreview.file.name}</p>
              <p className="text-[10px] text-muted-foreground">{(imagePreview.file.size / 1024).toFixed(0)} KB</p>
            </div>
            <button onClick={discardImage} className="p-1 rounded-full hover:bg-muted transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
            <Button size="sm" onClick={sendImage} disabled={uploading} className="h-8 rounded-xl text-xs shrink-0">
              {uploading ? <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full inline-block" /> : "Send"}
            </Button>
          </div>
        )}

        {/* Voice preview */}
        {audioPreviewUrl && !isRecording && (
          <div className="flex items-center gap-2 mb-2 p-2 bg-muted/50 rounded-xl border animate-in slide-in-from-bottom-2 duration-200">
            <Mic className="w-4 h-4 text-primary shrink-0" />
            <audio controls src={audioPreviewUrl} className="flex-1 h-8" />
            <button onClick={discardRecording} className="p-1 rounded-full hover:bg-muted transition-colors">
              <Trash2 className="w-4 h-4 text-muted-foreground" />
            </button>
            <Button size="sm" onClick={sendVoiceNote} disabled={uploading} className="h-8 rounded-xl text-xs shrink-0">
              {uploading ? <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full inline-block" /> : "Send"}
            </Button>
          </div>
        )}

        {/* Recording indicator */}
        {isRecording && (
          <div className="flex items-center gap-3 mb-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-2.5 animate-in fade-in-0 duration-200">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse shrink-0" />
            <span className="text-sm font-medium text-red-700 flex-1">Recording {formatDuration(recordingTime)}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={stopRecording}
              className="h-8 rounded-xl text-xs border-red-300 text-red-700 hover:bg-red-100"
            >
              <Square className="w-3 h-3 mr-1 fill-current" />Stop
            </Button>
          </div>
        )}

        {/* Main input row */}
        {!isRecording && !audioPreviewUrl && !imagePreview && (
          <div className="flex items-center gap-2 bg-muted/50 rounded-2xl px-3 py-1.5 border border-border/50">
            <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
            <button
              onClick={() => canSend && imageInputRef.current?.click()}
              disabled={!canSend}
              className="p-1 rounded-full hover:bg-muted transition-colors disabled:opacity-40"
              title="Send image"
            >
              <ImagePlus className="w-[18px] h-[18px] text-muted-foreground" />
            </button>

            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={isClosed ? "Chat is closed" : "Type a message..."}
              className="flex-1 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm px-0"
              disabled={sending || !canSend}
            />

            {!newMessage.trim() && canSend && (
              <button
                onClick={startRecording}
                className="p-1 rounded-full hover:bg-muted transition-colors"
                title="Record voice note"
              >
                <Mic className="w-[18px] h-[18px] text-muted-foreground" />
              </button>
            )}

            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || !canSend}
              size="icon"
              className={cn(
                "rounded-full h-8 w-8 shrink-0 transition-all duration-200",
                newMessage.trim() ? "bg-primary hover:bg-primary/90 scale-100" : "bg-muted scale-90 opacity-60"
              )}
            >
              <Send className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {!isRecording && !audioPreviewUrl && !imagePreview && (
          <p className="text-[10px] text-muted-foreground/50 text-center mt-1">Press Enter to send</p>
        )}
      </div>

      {/* Lightbox */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 animate-in fade-in-0 duration-200"
          onClick={() => setLightboxSrc(null)}
        >
          <button className="absolute top-4 right-4 p-2 rounded-full bg-white/20 hover:bg-white/30 transition-colors">
            <X className="w-5 h-5 text-white" />
          </button>
          <img
            src={lightboxSrc}
            alt=""
            className="max-w-full max-h-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
