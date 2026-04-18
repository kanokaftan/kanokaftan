import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Send, ArrowLeft } from "lucide-react";
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
  customer_id: string;
  profiles: { full_name: string | null; email: string; phone: string | null } | null;
  last_message?: string;
}

export default function AdminChats() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingChats, setLoadingChats] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, isLoading]);

  useEffect(() => {
    if (isAdmin) {
      loadChats();
      subscribeToNewChats();
    }
  }, [isAdmin]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      const unsub = subscribeToMessages(selectedChat.id);
      return () => { unsub(); };
    }
  }, [selectedChat]);

  const loadChats = async () => {
    setLoadingChats(true);
    const { data } = await supabase
      .from("chats")
      .select(`*, profiles(full_name, email, phone)`)
      .order("updated_at", { ascending: false });

    if (data) {
      // Get last message for each chat
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
    supabase
      .channel("new-chats")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chats" }, () => {
        loadChats();
      })
      .subscribe();
  };

  const loadMessages = async (chatId: string) => {
    const { data } = await supabase
      .from("messages")
      .select("*")
      .eq("chat_id", chatId)
      .order("created_at", { ascending: true });
    if (data) setMessages(data);
  };

  const subscribeToMessages = (chatId: string) => {
    const channel = supabase
      .channel(`admin-chat-${chatId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedChat || sending) return;
    setSending(true);
    try {
      await supabase.from("messages").insert({
        chat_id: selectedChat.id,
        sender_id: user!.id,
        content: newMessage.trim(),
        is_admin: true,
      });

      await supabase.from("notifications").insert({
        user_id: selectedChat.customer_id,
        title: "New message from Kano Kaftan",
        message: newMessage.trim(),
      });

      setNewMessage("");
      loadChats();
    } finally {
      setSending(false);
    }
  };

  const closeChat = async (chatId: string) => {
    await supabase.from("chats").update({ status: "closed" }).eq("id", chatId);
    loadChats();
    setSelectedChat(null);
  };

  const formatTime = (date: string) =>
    new Date(date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString([], { day: "numeric", month: "short" });

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Chat List */}
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
            <p className="text-center text-gray-400 text-sm mt-16">No chats yet</p>
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
                  <div className="w-8 h-8 rounded-full bg-gray-900 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
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
                  <p className="text-xs text-gray-400">{formatDate(chat.created_at)}</p>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                    chat.status === "open"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {chat.status}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 truncate ml-10">{chat.last_message}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="bg-white border-b px-4 py-3 flex items-center gap-3 flex-shrink-0">
            <button onClick={() => setSelectedChat(null)} className="md:hidden p-1">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center font-bold flex-shrink-0">
              {(selectedChat.profiles?.full_name || selectedChat.profiles?.email || "?")[0].toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">
                {selectedChat.profiles?.full_name || "Customer"}
              </p>
              <p className="text-xs text-gray-500 truncate">
                {selectedChat.profiles?.phone || selectedChat.profiles?.email}
              </p>
            </div>
            {selectedChat.status === "open" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => closeChat(selectedChat.id)}
                className="text-xs flex-shrink-0"
              >
                Close
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.length === 0 && (
              <p className="text-center text-gray-400 text-sm mt-10">No messages yet</p>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.is_admin ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  msg.is_admin
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-800 shadow-sm border"
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

          {/* Input */}
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
            <p className="text-lg font-medium mb-1">Select a conversation</p>
            <p className="text-sm">Choose a chat from the left to start replying</p>
          </div>
        </div>
      )}
    </div>
  );
}
