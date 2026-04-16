import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Send, ArrowLeft, ShoppingBag } from "lucide-react";
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
  product_id: string | null;
  products?: { name: string; price: number; images: string[] } | null;
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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
  }, [user, isLoading, navigate]);

  useEffect(() => {
    if (user) initChat();
  }, [user]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const initChat = async () => {
    try {
      // Find existing open chat or create new one
      let { data: existingChat } = await supabase
        .from("chats")
        .select("*, products(name, price, images)")
        .eq("customer_id", user!.id)
        .eq("status", "open")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (existingChat) {
        setChat(existingChat);
        loadMessages(existingChat.id);
        subscribeToMessages(existingChat.id);
      } else {
        // Create new chat
        const { data: newChat } = await supabase
          .from("chats")
          .insert({
            customer_id: user!.id,
            product_id: productId || null,
            status: "open",
          })
          .select("*, products(name, price, images)")
          .single();

        if (newChat) {
          setChat(newChat);
          // Send automatic welcome message
          await supabase.from("messages").insert({
            chat_id: newChat.id,
            sender_id: user!.id,
            content: productId
              ? `Hi! I'm interested in ordering this product.`
              : `Hi! I'd like to place an order.`,
            is_admin: false,
          });
          loadMessages(newChat.id);
          subscribeToMessages(newChat.id);
        }
      }
    } catch (error) {
      console.error("Error initializing chat:", error);
    } finally {
      setLoading(false);
    }
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
      .channel(`messages:${chatId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `chat_id=eq.${chatId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !chat || sending) return;
    setSending(true);
    try {
      await supabase.from("messages").insert({
        chat_id: chat.id,
        sender_id: user!.id,
        content: newMessage.trim(),
        is_admin: false,
      });
      setNewMessage("");
    } catch (error) {
      console.error("Error sending message:", error);
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-3 flex items-center gap-3 shadow-sm">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </button>
        <div className="flex-1">
          <h1 className="font-semibold text-gray-900">Kano Kaftan</h1>
          <p className="text-xs text-green-500">Online</p>
        </div>
        <ShoppingBag className="w-5 h-5 text-gray-600" />
      </div>

      {/* Product reference */}
      {chat?.products && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2 flex items-center gap-3">
          {chat.products.images?.[0] && (
            <img
              src={chat.products.images[0]}
              className="w-10 h-10 rounded object-cover"
            />
          )}
          <div>
            <p className="text-xs text-amber-800 font-medium">
              {chat.products.name}
            </p>
            <p className="text-xs text-amber-600">
              ₦{chat.products.price?.toLocaleString()}
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 text-sm mt-10">
            Start a conversation to place your order
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.is_admin ? "justify-start" : "justify-end"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${
                msg.is_admin
                  ? "bg-white text-gray-800 shadow-sm border"
                  : "bg-gray-900 text-white"
              }`}
            >
              {msg.content}
              <p
                className={`text-xs mt-1 ${
                  msg.is_admin ? "text-gray-400" : "text-gray-300"
                }`}
              >
                {new Date(msg.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t px-4 py-3 flex items-center gap-2">
        <Input
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type a message..."
          className="flex-1 rounded-full border-gray-200"
          disabled={sending}
        />
        <Button
          onClick={sendMessage}
          disabled={!newMessage.trim() || sending}
          size="icon"
          className="rounded-full bg-gray-900 hover:bg-gray-700"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
