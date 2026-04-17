import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { Send, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Chat {
  id: string;
  status: string;
  created_at: string;
  customer_id: string;
  profiles: { full_name: string | null; email: string } | null;
  messages: { content: string; created_at: string }[];
}

interface Message {
  id: string;
  content: string;
  is_admin: boolean;
  sender_id: string;
  created_at: string;
}

export default function AdminChats() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [chats, setChats] = useState<Chat[]>([]);
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate("/");
  }, [user, isAdmin, isLoading]);

  useEffect(() => {
    if (isAdmin) loadChats();
  }, [isAdmin]);

  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
      subscribeToMessages(selectedChat.id);
    }
  }, [selectedChat]);

  const loadChats = async () => {
    const { data } = await supabase
      .from("chats")
      .select(`
        *,
        profiles(full_name, email),
        messages(content, created_at)
      `)
      .order("updated_at", { ascending: false });
    if (data) setChats(data as any);
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
    supabase
      .channel(`admin-messages:${chatId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `chat_id=eq.${chatId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as Message]);
      })
      .subscribe();
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

      // Notify customer
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

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Chat List */}
      <div className={`w-full md:w-80 bg-white border-r flex flex-col ${selectedChat ? "hidden md:flex" : "flex"}`}>
        <div className="p-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => navigate("/admin/dashboard")}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="font-bold text-lg">Customer Chats</h1>
          </div>
          <p className="text-sm text-gray-500">{chats.length} conversations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          {chats.length === 0 && (
            <p className="text-center text-gray-400 text-sm mt-10">No chats yet</p>
          )}
          {chats.map((chat) => (
            <div
              key={chat.id}
              onClick={() => setSelectedChat(chat)}
              className={`p-4 border-b cursor-pointer hover:bg-gray-50 transition-colors ${
                selectedChat?.id === chat.id ? "bg-gray-100" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="font-medium text-sm">
                  {chat.profiles?.full_name || chat.profiles?.email || "Customer"}
                </p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  chat.status === "open" 
                    ? "bg-green-100 text-green-700" 
                    : "bg-gray-100 text-gray-500"
                }`}>
                  {chat.status}
                </span>
              </div>
              <p className="text-xs text-gray-500 truncate">
                {chat.messages?.[chat.messages.length - 1]?.content || "No messages yet"}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(chat.created_at).toLocaleDateString()}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Chat Window */}
      {selectedChat ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="bg-white border-b px-4 py-3 flex items-center gap-3">
            <button onClick={() => setSelectedChat(null)} className="md:hidden">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <p className="font-semibold">
                {selectedChat.profiles?.full_name || selectedChat.profiles?.email}
              </p>
              <p className="text-xs text-gray-500">{selectedChat.profiles?.email}</p>
            </div>
            {selectedChat.status === "open" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => closeChat(selectedChat.id)}
                className="text-xs"
              >
                Close Chat
              </Button>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.is_admin ? "justify-end" : "justify-start"}`}
              >
                <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                  msg.is_admin
                    ? "bg-gray-900 text-white"
                    : "bg-white text-gray-800 shadow-sm border"
                }`}>
                  {msg.content}
                  <p className={`text-xs mt-1 ${msg.is_admin ? "text-gray-300" : "text-gray-400"}`}>
                    {new Date(msg.created_at).toLocaleTimeString([], {
                      hour: "2-digit", minute: "2-digit"
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="bg-white border-t px-4 py-3 flex gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && sendMessage()}
              placeholder="Reply to customer..."
              className="flex-1 rounded-full"
              disabled={selectedChat.status === "closed"}
            />
            <Button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || selectedChat.status === "closed"}
              size="icon"
              className="rounded-full bg-gray-900"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-gray-400">
          Select a chat to start replying
        </div>
      )}
    </div>
  );
}
