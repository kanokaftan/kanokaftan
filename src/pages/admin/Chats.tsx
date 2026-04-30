import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Send, ArrowLeft, MessageCircle, Search, ChevronDown, X, Mic, Square, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  created_at: string;
  updated_at: string;
  customer_id: string;
  profiles: { full_name: string | null; email: string; phone: string | null } | null;
  last_message?: string;
  unread?: boolean;
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

function VoicePlayer({ src }: { src: string }) {
  return (
    <div className="flex items-center gap-2 py-0.5">
      <Mic className="h-3.5 w-3.5 shrink-0 opacity-60" />
      <audio controls src={src} className="h-8" style={{ maxWidth: 180 }} />
    </div>
  );
}

const formatDuration = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

export default function AdminChats() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [customerTyping, setCustomerTyping] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Voice recording
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);

  // Image upload
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingBroadcastRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, isLoading]);

  useEffect(() => {
    if (!isLoading && isAdmin) {
      loadChats();
      subscribeToNewChats();
    }
    return () => {
      chatChannelRef.current && supabase.removeChannel(chatChannelRef.current);
      messageChannelRef.current && supabase.removeChannel(messageChannelRef.current);
      typingChannelRef.current && supabase.removeChannel(typingChannelRef.current);
      typingBroadcastRef.current && supabase.removeChannel(typingBroadcastRef.current);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
      if (imagePreview) URL.revokeObjectURL(imagePreview.url);
    };
  }, [isAdmin, isLoading]);

  useEffect(() => {
    const preselectedId = (location.state as { chatId?: string } | null)?.chatId;
    if (preselectedId && chats.length > 0 && !selectedChat) {
      const chat = chats.find((c) => c.id === preselectedId);
      if (chat) setSelectedChat(chat);
    }
  }, [chats, location.state]);

  useEffect(() => {
    if (!showScrollBtn) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, customerTyping]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      subscribeToMessages(selectedChat.id);
      subscribeToTyping(selectedChat.id);
    }
    return () => {
      messageChannelRef.current && supabase.removeChannel(messageChannelRef.current);
      typingChannelRef.current && supabase.removeChannel(typingChannelRef.current);
      messageChannelRef.current = null;
      typingChannelRef.current = null;
    };
  }, [selectedChat?.id]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  };

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    setShowScrollBtn(false);
  };

  const formatLastMessage = (msg: { content: string; message_type?: string } | null) => {
    if (!msg) return "No messages yet";
    if (msg.message_type === "voice") return "🎤 Voice note";
    if (msg.message_type === "image") return "📷 Image";
    return msg.content;
  };

  const loadChats = async () => {
    setLoadingChats(true);
    try {
      const { data: chatsData, error } = await supabase
        .from("chats")
        .select(`*, profiles(full_name, email, phone)`)
        .order("updated_at", { ascending: false });

      if (error) throw error;
      if (!chatsData?.length) { setChats([]); return; }

      // Single batch query for last messages — eliminates N+1
      const chatIds = chatsData.map((c) => c.id);
      const { data: messagesData } = await supabase
        .from("messages")
        .select("chat_id, content, message_type, created_at")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: false });

      const lastMsgMap = new Map<string, { content: string; message_type?: string }>();
      for (const msg of messagesData || []) {
        if (!lastMsgMap.has(msg.chat_id)) lastMsgMap.set(msg.chat_id, msg);
      }

      setChats(
        chatsData.map((chat) => ({
          ...chat,
          last_message: formatLastMessage(lastMsgMap.get(chat.id) ?? null),
        })) as Chat[]
      );
    } catch (err) {
      console.error("Error loading chats:", err);
    } finally {
      setLoadingChats(false);
    }
  };

  const subscribeToNewChats = () => {
    if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
    chatChannelRef.current = supabase
      .channel("admin-new-chats")
      // Only full-reload on chat create/delete — not on every message
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chats" }, () => loadChats())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "chats" }, () => loadChats())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const newMsg = payload.new as any;
        const lastText = formatLastMessage(newMsg);
        // Update only the affected chat in-place — no re-fetch
        setChats((prev) =>
          [...prev.map((chat) =>
            chat.id === newMsg.chat_id
              ? { ...chat, last_message: lastText, updated_at: newMsg.created_at }
              : chat
          )].sort(
            (a, b) =>
              new Date(b.updated_at || b.created_at).getTime() -
              new Date(a.updated_at || a.created_at).getTime()
          )
        );
      })
      .subscribe();
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
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current);
      messageChannelRef.current = null;
    }
    messageChannelRef.current = supabase
      .channel(`admin-messages-${chatId}`)
      .on("postgres_changes", {
        event: "INSERT", schema: "public", table: "messages", filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as Message];
        });
      })
      .subscribe();
  }, []);

  const subscribeToTyping = useCallback((chatId: string) => {
    if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
    typingChannelRef.current = supabase
      .channel(`typing:${chatId}`)
      .on("broadcast", { event: "typing" }, (payload) => {
        if (!payload.payload?.is_admin) {
          setCustomerTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setCustomerTyping(false), 3000);
        }
      })
      .subscribe();
  }, []);

  const broadcastTyping = useCallback(() => {
    if (!typingBroadcastRef.current) return;
    typingBroadcastRef.current.send({ type: "broadcast", event: "typing", payload: { is_admin: true } });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    broadcastTyping();
  };

  useEffect(() => {
    if (!selectedChat) return;
    if (typingBroadcastRef.current) supabase.removeChannel(typingBroadcastRef.current);
    typingBroadcastRef.current = supabase.channel(`typing:${selectedChat.id}`).subscribe();
    return () => {
      typingBroadcastRef.current && supabase.removeChannel(typingBroadcastRef.current);
    };
  }, [selectedChat?.id]);

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || sending) return;
    const content = newMessage.trim();
    setNewMessage("");
    setSending(true);
    try {
      await supabase.from("messages").insert({
        chat_id: selectedChat.id,
        sender_id: user!.id,
        content,
        is_admin: true,
        message_type: "text",
      });
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", selectedChat.id);
      await supabase.from("notifications").insert({
        user_id: selectedChat.customer_id,
        title: "New message from Kano Kaftan",
        message: content,
        type: "info",
        category: "general",
        action_url: "/chat",
      });
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
    if (!audioBlob || !selectedChat) return;
    setUploading(true);
    try {
      const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm";
      const fileName = `voice/${selectedChat.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("chat-media").upload(fileName, audioBlob);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(fileName);

      await supabase.from("messages").insert({
        chat_id: selectedChat.id,
        sender_id: user!.id,
        content: "",
        is_admin: true,
        message_type: "voice",
        media_url: publicUrl,
      });
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", selectedChat.id);
      await supabase.from("notifications").insert({
        user_id: selectedChat.customer_id,
        title: "New voice message from Kano Kaftan",
        message: "You received a voice note",
        type: "info",
        category: "general",
        action_url: "/chat",
      });
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
    if (!imagePreview || !selectedChat) return;
    setUploading(true);
    try {
      const ext = imagePreview.file.name.split(".").pop() || "jpg";
      const fileName = `images/${selectedChat.id}/${Date.now()}.${ext}`;
      const { error: uploadErr } = await supabase.storage.from("chat-media").upload(fileName, imagePreview.file);
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from("chat-media").getPublicUrl(fileName);

      await supabase.from("messages").insert({
        chat_id: selectedChat.id,
        sender_id: user!.id,
        content: "",
        is_admin: true,
        message_type: "image",
        media_url: publicUrl,
      });
      await supabase.from("chats").update({ updated_at: new Date().toISOString() }).eq("id", selectedChat.id);
      await supabase.from("notifications").insert({
        user_id: selectedChat.customer_id,
        title: "New image from Kano Kaftan",
        message: "You received an image",
        type: "info",
        category: "general",
        action_url: "/chat",
      });
      discardImage();
    } catch {
      toast.error("Failed to send image");
    } finally {
      setUploading(false);
    }
  };

  const closeChat = async (chatId: string) => {
    await supabase.from("chats").update({ status: "closed" }).eq("id", chatId);
    loadChats();
    setSelectedChat(null);
    setMessages([]);
  };

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const days = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 0) return formatTime(date);
    if (days === 1) return "Yesterday";
    return d.toLocaleDateString([], { day: "numeric", month: "short" });
  };

  const filteredChats = chats.filter((chat) => {
    const q = searchQuery.toLowerCase();
    return (
      !q ||
      chat.profiles?.full_name?.toLowerCase().includes(q) ||
      chat.profiles?.email?.toLowerCase().includes(q) ||
      chat.last_message?.toLowerCase().includes(q)
    );
  });

  const grouped = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const isGrouped =
      prev &&
      prev.is_admin === msg.is_admin &&
      new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 60000;
    return { ...msg, isGrouped };
  });

  const customerInitial = (selectedChat?.profiles?.full_name || selectedChat?.profiles?.email || "C")[0].toUpperCase();
  const canSend = !uploading && selectedChat?.status !== "closed";

  return (
    <div className="flex h-screen bg-muted/30 overflow-hidden">
      {/* Sidebar */}
      <div className={cn(
        "w-full md:w-80 bg-card border-r flex flex-col",
        selectedChat ? "hidden md:flex" : "flex"
      )}>
        {/* Sidebar header */}
        <div className="p-4 border-b bg-card shrink-0">
          <div className="flex items-center gap-2 mb-3">
            <button
              onClick={() => navigate("/admin/dashboard")}
              className="p-1.5 rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <h1 className="font-bold text-base text-foreground">Customer Chats</h1>
            {chats.filter((c) => c.status === "open").length > 0 && (
              <span className="ml-auto text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full font-medium">
                {chats.filter((c) => c.status === "open").length} open
              </span>
            )}
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="pl-8 h-8 text-xs bg-muted/50 border-border/50 focus-visible:ring-0"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
            )}
          </div>
        </div>

        {/* Chat list */}
        <div className="flex-1 overflow-y-auto">
          {loadingChats && (
            <div className="space-y-2 p-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-3 p-2 animate-pulse">
                  <div className="w-9 h-9 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2 py-1">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-2.5 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {!loadingChats && filteredChats.length === 0 && (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4 animate-in fade-in-0 duration-300">
              <MessageCircle className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">
                {searchQuery ? "No results found" : "No chats yet"}
              </p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">
                {searchQuery ? "Try a different search" : "Customer conversations appear here"}
              </p>
            </div>
          )}

          {filteredChats.map((chat, idx) => (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={cn(
                "p-3.5 border-b cursor-pointer transition-all duration-150 animate-in fade-in-0",
                "hover:bg-muted/50",
                selectedChat?.id === chat.id
                  ? "bg-primary/5 border-l-4 border-l-primary"
                  : chat.status === "open" ? "border-l-4 border-l-transparent" : ""
              )}
              style={{ animationDelay: `${idx * 30}ms`, animationFillMode: "both" }}
            >
              <div className="flex items-start gap-2.5">
                <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0">
                  {(chat.profiles?.full_name || chat.profiles?.email || "?")[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="font-semibold text-sm text-foreground truncate">
                      {chat.profiles?.full_name || "Customer"}
                    </p>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                      {formatDate(chat.updated_at || chat.created_at)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{chat.last_message}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-muted-foreground/60">{chat.profiles?.phone || chat.profiles?.email}</p>
                    <span className={cn(
                      "text-[10px] px-1.5 py-0.5 rounded-full",
                      chat.status === "open" ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"
                    )}>
                      {chat.status}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col min-h-0 relative">
          {/* Chat header */}
          <div className="bg-card border-b px-4 py-3 flex items-center gap-3 shrink-0 shadow-sm">
            <button
              onClick={() => { setSelectedChat(null); setMessages([]); }}
              className="md:hidden p-1.5 rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-foreground" />
            </button>
            <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold shrink-0 text-sm">
              {customerInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-foreground">
                {selectedChat.profiles?.full_name || "Customer"}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {selectedChat.profiles?.phone || selectedChat.profiles?.email}
              </p>
            </div>
            {selectedChat.status === "open" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => closeChat(selectedChat.id)}
                className="text-xs shrink-0 h-7"
              >
                Close chat
              </Button>
            )}
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
          >
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center py-16 animate-in fade-in-0 duration-500">
                <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-3">
                  <MessageCircle className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">No messages yet</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Start the conversation below</p>
              </div>
            )}

            {grouped.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex animate-in fade-in-0 duration-300",
                  msg.isGrouped ? "slide-in-from-bottom-1" : "slide-in-from-bottom-3",
                  msg.is_admin ? "justify-end" : "justify-start",
                  msg.isGrouped ? "mt-0.5" : "mt-3"
                )}
              >
                {!msg.is_admin && !msg.isGrouped && (
                  <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold mr-2 shrink-0 self-end mb-1">
                    {customerInitial}
                  </div>
                )}
                {!msg.is_admin && msg.isGrouped && <div className="w-7 mr-2 shrink-0" />}

                <div
                  className={cn(
                    "max-w-[78%] text-sm leading-relaxed",
                    msg.message_type === "image" ? "p-1 rounded-2xl overflow-hidden" : "px-3.5 py-2",
                    msg.is_admin
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground shadow-sm border",
                    msg.is_admin
                      ? msg.isGrouped ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-br-sm"
                      : msg.isGrouped ? "rounded-2xl rounded-tl-sm" : "rounded-2xl rounded-bl-sm"
                  )}
                >
                  {msg.message_type === "voice" && msg.media_url ? (
                    <VoicePlayer src={msg.media_url} />
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
                    <p className={cn(
                      "text-[10px] mt-1",
                      msg.is_admin ? "text-primary-foreground/60" : "text-muted-foreground"
                    )}>
                      {formatTime(msg.created_at)}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* Customer typing indicator */}
            {customerTyping && (
              <div className="flex justify-start mt-3 animate-in fade-in-0 slide-in-from-bottom-2 duration-200">
                <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-bold mr-2 shrink-0 self-end">
                  {customerInitial}
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
                  onChange={handleInputChange}
                  onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                  placeholder={selectedChat.status === "closed" ? "Chat is closed" : "Reply to customer..."}
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
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center bg-muted/20">
          <div className="text-center animate-in fade-in-0 duration-500">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
              <MessageCircle className="w-8 h-8 text-primary" />
            </div>
            <p className="text-base font-semibold text-foreground mb-1">Select a conversation</p>
            <p className="text-sm text-muted-foreground">Choose a chat from the left to start replying</p>
          </div>
        </div>
      )}

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
