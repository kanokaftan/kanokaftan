import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, ArrowLeft, ShoppingBag, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { notifyRole } from "@/lib/notifications";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  is_admin: boolean;
  sender_id: string;
  created_at: string;
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

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) initChat();
    return () => {
      channelRef.current && supabase.removeChannel(channelRef.current);
      typingChannelRef.current && supabase.removeChannel(typingChannelRef.current);
    };
  }, [user]);

  useEffect(() => {
    if (!showScrollBtn) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, adminTyping]);

  // Track scroll position for "jump to latest" button
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 120);
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
    if (typingChannelRef.current) {
      supabase.removeChannel(typingChannelRef.current);
    }
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
            content: productId
              ? "Hi! I'm interested in ordering this product."
              : "Hi! I'd like to place an order.",
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

  // Group messages: consecutive same-sender within 60s = same group
  const grouped = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const isGrouped =
      prev &&
      prev.is_admin === msg.is_admin &&
      new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 60000;
    return { ...msg, isGrouped };
  });

  return (
    <div className="flex flex-col h-screen bg-muted/30">
      {/* Header */}
      <div className="bg-card border-b px-4 py-3 flex items-center gap-3 shadow-sm shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="p-1.5 rounded-full hover:bg-muted transition-colors"
        >
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

        {grouped.map((msg, i) => (
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
                "max-w-[78%] px-3.5 py-2 text-sm leading-relaxed",
                msg.is_admin
                  ? "bg-card text-foreground shadow-sm border"
                  : "bg-primary text-primary-foreground",
                // Bubble shaping based on grouping
                msg.is_admin
                  ? msg.isGrouped ? "rounded-2xl rounded-tl-sm" : "rounded-2xl rounded-bl-sm"
                  : msg.isGrouped ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-br-sm"
              )}
            >
              {msg.content}
              {!msg.isGrouped && (
                <p className={cn("text-[10px] mt-1", msg.is_admin ? "text-muted-foreground" : "text-primary-foreground/60")}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
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

      {/* Jump to latest button */}
      {showScrollBtn && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-24 right-4 p-2 rounded-full bg-primary text-primary-foreground shadow-lg animate-in zoom-in-75 duration-200 hover:bg-primary/90 transition-colors"
        >
          <ChevronDown className="w-5 h-5" />
        </button>
      )}

      {/* Input */}
      <div className="bg-card border-t px-4 py-3 shrink-0">
        <div className="flex items-center gap-2 bg-muted/50 rounded-2xl px-3 py-1.5 border border-border/50">
          <Input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={chat?.status === "closed" ? "Chat is closed" : "Type a message..."}
            className="flex-1 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm px-0"
            disabled={sending || chat?.status === "closed"}
          />
          <Button
            onClick={sendMessage}
            disabled={!newMessage.trim() || sending || chat?.status === "closed"}
            size="icon"
            className={cn(
              "rounded-full h-8 w-8 shrink-0 transition-all duration-200",
              newMessage.trim() ? "bg-primary hover:bg-primary/90 scale-100" : "bg-muted scale-90 opacity-60"
            )}
          >
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground/50 text-center mt-1">Press Enter to send</p>
      </div>
    </div>
  );
}
