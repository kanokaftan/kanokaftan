import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Send, ArrowLeft, MessageCircle, Search, ChevronDown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messageChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingBroadcastRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

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

  const loadChats = async () => {
    setLoadingChats(true);
    const { data, error } = await supabase
      .from("chats")
      .select(`*, profiles(full_name, email, phone)`)
      .order("updated_at", { ascending: false });

    if (error) { console.error("Error loading chats:", error); setLoadingChats(false); return; }

    if (data) {
      const chatsWithLastMessage = await Promise.all(
        data.map(async (chat) => {
          const { data: msgs } = await supabase
            .from("messages")
            .select("content")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1);
          return { ...chat, last_message: msgs?.[0]?.content || "No messages yet" };
        })
      );
      setChats(chatsWithLastMessage as Chat[]);
    }
    setLoadingChats(false);
  };

  const subscribeToNewChats = () => {
    if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
    chatChannelRef.current = supabase
      .channel("admin-new-chats")
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => loadChats())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => loadChats())
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

  const broadcastTyping = useCallback((chatId: string) => {
    if (!typingBroadcastRef.current) return;
    typingBroadcastRef.current.send({ type: "broadcast", event: "typing", payload: { is_admin: true } });
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setNewMessage(e.target.value);
    if (selectedChat) broadcastTyping(selectedChat.id);
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

  // Group messages: consecutive same-sender within 60s = same group
  const grouped = messages.map((msg, i) => {
    const prev = messages[i - 1];
    const isGrouped =
      prev &&
      prev.is_admin === msg.is_admin &&
      new Date(msg.created_at).getTime() - new Date(prev.created_at).getTime() < 60000;
    return { ...msg, isGrouped };
  });

  const customerInitial = (selectedChat?.profiles?.full_name || selectedChat?.profiles?.email || "C")[0].toUpperCase();

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
                    "max-w-[78%] px-3.5 py-2 text-sm leading-relaxed",
                    msg.is_admin
                      ? "bg-primary text-primary-foreground"
                      : "bg-card text-foreground shadow-sm border",
                    msg.is_admin
                      ? msg.isGrouped ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-br-sm"
                      : msg.isGrouped ? "rounded-2xl rounded-tl-sm" : "rounded-2xl rounded-bl-sm"
                  )}
                >
                  {msg.content}
                  {!msg.isGrouped && (
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

          {/* Input */}
          <div className="bg-card border-t px-4 py-3 shrink-0">
            <div className="flex items-center gap-2 bg-muted/50 rounded-2xl px-3 py-1.5 border border-border/50">
              <Input
                value={newMessage}
                onChange={handleInputChange}
                onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                placeholder={selectedChat.status === "closed" ? "Chat is closed" : "Reply to customer..."}
                className="flex-1 border-none bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-sm px-0"
                disabled={sending || selectedChat.status === "closed"}
              />
              <Button
                onClick={sendMessage}
                disabled={!newMessage.trim() || sending || selectedChat.status === "closed"}
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
    </div>
  );
}
