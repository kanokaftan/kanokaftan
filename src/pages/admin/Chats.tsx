import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate, useLocation } from "react-router-dom";
import { Send, ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
  const bottomRef = useRef<HTMLDivElement>(null);
  const messageChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const chatChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, isLoading]);

  useEffect(() => {
    if (!isLoading && isAdmin) {
      loadChats();
      subscribeToNewChats();
    }
    return () => {
      if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
      if (messageChannelRef.current) supabase.removeChannel(messageChannelRef.current);
    };
  }, [isAdmin, isLoading]);

  // Pre-select a chat when navigating from the dashboard
  useEffect(() => {
    const preselectedId = (location.state as { chatId?: string } | null)?.chatId;
    if (preselectedId && chats.length > 0 && !selectedChat) {
      const chat = chats.find((c) => c.id === preselectedId);
      if (chat) setSelectedChat(chat);
    }
  }, [chats, location.state]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      subscribeToMessages(selectedChat.id);
    }
    return () => {
      if (messageChannelRef.current) {
        supabase.removeChannel(messageChannelRef.current);
        messageChannelRef.current = null;
      }
    };
  }, [selectedChat?.id]);

  const loadChats = async () => {
    setLoadingChats(true);
    try {
      // Step 1: get chats
      const { data: chatsData, error } = await supabase
        .from("chats")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        console.error("Error loading chats:", error);
        setLoadingChats(false);
        return;
      }

      if (!chatsData || chatsData.length === 0) {
        setChats([]);
        setLoadingChats(false);
        return;
      }

      // Step 2: fetch profiles for all customer_ids
      const customerIds = [...new Set(chatsData.map((c: any) => c.customer_id).filter(Boolean))];
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .in("id", customerIds);

      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));

      // Step 3: fetch last message for each chat
      const chatsWithDetails = await Promise.all(
        chatsData.map(async (chat: any) => {
          const { data: msgs } = await supabase
            .from("messages")
            .select("content")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1);
          const profile = profileMap.get(chat.customer_id) || null;
          return {
            ...chat,
            profiles: profile,
            last_message: msgs?.[0]?.content || "No messages yet",
          };
        })
      );
      setChats(chatsWithDetails as Chat[]);
    } finally {
      setLoadingChats(false);
    }
  };

  const subscribeToNewChats = () => {
    if (chatChannelRef.current) supabase.removeChannel(chatChannelRef.current);
    const channel = supabase
      .channel("admin-new-chats")
      .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => {
        loadChats();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, () => {
        loadChats();
      })
      .subscribe();
    chatChannelRef.current = channel;
  };

  const loadMessages = useCallback(async (chatId: string) => {
    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (error) console.error("Error loading messages:", error);
    if (data) setMessages(data);
  }, []);

  const subscribeToMessages = useCallback((chatId: string) => {
    if (messageChannelRef.current) {
      supabase.removeChannel(messageChannelRef.current);
      messageChannelRef.current = null;
    }
    const channel = supabase
      .channel(`admin-messages-${chatId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages((prev) => {
          if (prev.find((m) => m.id === payload.new.id)) return prev;
          return [...prev, payload.new as Message];
        });
      })
      .subscribe();
    messageChannelRef.current = channel;
  }, []);

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
      await supabase
        .from("chats")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", selectedChat.id);
      await supabase.from("notifications").insert({
        user_id: selectedChat.customer_id,
        title: "New message from Kano Kaftan",
        message: content,
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

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <div className={`w-full md:w-80 bg-white border-r flex flex-col ${selectedChat ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b bg-white">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate("/admin/dashboard")} className="p-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg">Customer Chats</h1>
          </div>
          <p className="text-sm text-gray-500 ml-8">{chats.length} conversations</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingChats && (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-900" />
            </div>
          )}
          {!loadingChats && chats.length === 0 && (
            <div className="text-center mt-16 px-4">
              <MessageCircle className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm font-medium">No chats yet</p>
              <p className="text-gray-300 text-xs mt-1">Customer chats will appear here</p>
            </div>
          )}
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedChat?.id === chat.id ? "bg-gray-100 border-l-4 border-l-gray-900" : ""
              }`}
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {(chat.profiles?.full_name || chat.profiles?.email || "?")[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-medium text-sm leading-tight">
                      {chat.profiles?.full_name || "Customer"}
                    </p>
                    <p className="text-xs text-gray-400">{chat.profiles?.phone || chat.profiles?.email}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs text-gray-400">{formatDate(chat.updated_at || chat.created_at)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                    chat.status === "open" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                  }`}>
                    {chat.status}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 truncate ml-11">{chat.last_message}</p>
            </div>
          ))}
        </div>
      </div>

      {selectedChat ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-white border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => { setSelectedChat(null); setMessages([]); }} className="md:hidden p-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold flex-shrink-0">
              {(selectedChat.profiles?.full_name || selectedChat.profiles?.email || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">{selectedChat.profiles?.full_name || "Customer"}</p>
              <p className="text-xs text-gray-500 truncate">{selectedChat.profiles?.phone || selectedChat.profiles?.email}</p>
            </div>
            {selectedChat.status === "open" && (
              <Button size="sm" variant="outline" onClick={() => closeChat(selectedChat.id)} className="text-xs flex-shrink-0">
                Close chat
              </Button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-10">No messages yet</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.is_admin ? "justify-end" : "justify-start"}`}>
                {!msg.is_admin && (
                  <div className="w-7 h-7 rounded-full bg-gray-200 text-gray-600 flex items-center justify-center text-xs font-bold mr-2 flex-shrink-0 self-end">
                    {(selectedChat.profiles?.full_name || "C")[0].toUpperCase()}
                  </div>
                )}
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  msg.is_admin
                    ? "bg-gray-900 text-white rounded-br-sm"
                    : "bg-white text-gray-800 shadow-sm border rounded-bl-sm"
                }`}>
                  {msg.content}
                  <p className={`text-xs mt-1 ${msg.is_admin ? "text-gray-300" : "text-gray-400"}`}>
                    {formatTime(msg.created_at)}
                  </p>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="bg-white border-t px-4 py-3 flex gap-2 flex-shrink-0">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder={selectedChat.status === "closed" ? "Chat is closed" : "Reply to customer..."}
              className="flex-1 rounded-full border-gray-200"
              disabled={sending || selectedChat.status === "closed"}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || selectedChat.status === "closed"}
              size="icon"
              className="rounded-full bg-gray-900 hover:bg-gray-700 flex-shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center">
          <div className="text-center text-gray-400">
            <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-1">Select a conversation</p>
            <p className="text-sm">Choose a chat from the left to start replying</p>
          </div>
        </div>
      )}
    </div>
  );
}
