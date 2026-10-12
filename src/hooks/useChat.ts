import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";
import { playSound } from "@/lib/callTones";
import { compressImage } from "@/lib/compressImage";

export type ConversationSummary = Database["public"]["Functions"]["list_inbox"]["Returns"][number];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
export type ChatMessageType = "text" | "image" | "voice";
export type ChatMessage = Omit<MessageRow, "message_type"> & { message_type: ChatMessageType };

export interface SendMessageInput {
  body: string;
  messageType?: ChatMessageType;
  /** Path inside the private `chat-media` bucket; must start with `<conversation_id>/`. */
  mediaPath?: string | null;
  /** The message being replied to (same conversation). */
  replyToId?: string | null;
}

export interface MessageReaction {
  message_id: string;
  user_id: string;
  emoji: string;
}

interface ReadState {
  customer_id: string;
  customer_last_read_at: string | null;
  vendor_last_read_at: string | null;
}

export const CHAT_MEDIA_BUCKET = "chat-media";
export const CHAT_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const CHAT_AUDIO_TYPES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"] as const;
/** Default bodies for media messages (body is required; it also feeds inbox previews). */
export const MEDIA_LABELS: Record<Exclude<ChatMessageType, "text">, string> = {
  image: "Photo",
  voice: "Voice note",
};

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "audio/webm": "webm",
  "audio/ogg": "ogg",
  "audio/mp4": "m4a",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
};

/** "audio/webm;codecs=opus" -> "audio/webm" */
export const baseMimeType = (mime: string) => mime.split(";")[0].trim().toLowerCase();

/** Normalises a DB / realtime row so the media fields are always present. */
function toChatMessage(row: Partial<MessageRow> & Pick<MessageRow, "id">): ChatMessage {
  const type = row.message_type === "image" || row.message_type === "voice" ? row.message_type : "text";
  return {
    ...(row as MessageRow),
    message_type: type,
    media_path: row.media_path ?? null,
    reply_to_id: row.reply_to_id ?? null,
  };
}

/**
 * Uploads a photo or voice note to the private chat-media bucket and returns its storage path.
 * Throws a readable error for unsupported types or files over 10 MB.
 */
export async function uploadChatMedia(conversationId: string, media: Blob): Promise<string> {
  // Photos are shrunk first (phone photos are often several MB); voice notes go as they are.
  const file = media instanceof File && media.type.startsWith("image/") ? await compressImage(media) : media;
  const contentType = baseMimeType(file.type || "");
  const ext = EXTENSIONS[contentType];
  if (!ext) throw new Error("This file type isn't supported");
  if (file.size > CHAT_MEDIA_MAX_BYTES) throw new Error("File must be under 10 MB");
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).upload(path, file, {
    contentType,
    upsert: false,
  });
  if (error) throw error;
  return path;
}

/** Signed (private) URL for a chat attachment, cached per path. */
export function useChatMediaUrl(path: string | null | undefined) {
  return useQuery({
    queryKey: ["chat-media", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(CHAT_MEDIA_BUCKET).createSignedUrl(path!, 3600);
      if (error) throw error;
      return data.signedUrl;
    },
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
}

export function useConversations() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();
  const instanceId = useId();

  const query = useQuery({
    queryKey: ["conversations", userId],
    queryFn: async (): Promise<ConversationSummary[]> => {
      const { data, error } = await supabase.rpc("list_inbox", {});
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!userId,
  });

  // Refresh the inbox whenever one of my conversations changes.
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`inbox-${userId}-${instanceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, instanceId]);

  const unreadCount = (query.data ?? []).filter((c) => c.unread).length;
  return { conversations: query.data ?? [], isLoading: query.isLoading, unreadCount };
}

export function useConversation(conversationId: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const summaryQuery = useQuery({
    queryKey: ["conversation", conversationId],
    queryFn: async (): Promise<ConversationSummary | null> => {
      const { data, error } = await supabase.rpc("list_inbox", { p_conversation_id: conversationId! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!conversationId && !!userId,
  });

  const messagesQuery = useQuery({
    queryKey: ["messages", conversationId],
    queryFn: async (): Promise<ChatMessage[]> => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId!)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []).map(toChatMessage);
    },
    enabled: !!conversationId && !!userId,
  });

  const reactionsQuery = useQuery({
    queryKey: ["message-reactions", conversationId],
    queryFn: async (): Promise<MessageReaction[]> => {
      const { data, error } = await supabase
        .from("message_reactions")
        .select("message_id, user_id, emoji")
        .eq("conversation_id", conversationId!)
        .not("emoji", "is", null);
      if (error) throw error;
      return (data ?? []) as MessageReaction[];
    },
    enabled: !!conversationId && !!userId,
  });

  /** Put (or remove, with null) one person's reaction in the cached list. */
  const applyReaction = useCallback(
    (messageId: string, reactorId: string, emoji: string | null) => {
      queryClient.setQueryData<MessageReaction[]>(["message-reactions", conversationId], (old = []) => {
        const rest = old.filter((r) => !(r.message_id === messageId && r.user_id === reactorId));
        return emoji ? [...rest, { message_id: messageId, user_id: reactorId, emoji }] : rest;
      });
    },
    [queryClient, conversationId],
  );

  const react = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string | null }) => {
      const { error } = await supabase.rpc("set_message_reaction", { p_message_id: messageId, p_emoji: emoji ?? undefined });
      if (error) throw new Error(error.message);
    },
    // Show it straight away; undo if the server says no.
    onMutate: ({ messageId, emoji }) => {
      const previous = queryClient.getQueryData<MessageReaction[]>(["message-reactions", conversationId]);
      if (userId) applyReaction(messageId, userId, emoji);
      return { previous };
    },
    onError: (error, _vars, context) => {
      console.error("[chat] reaction failed", error);
      if (context?.previous) queryClient.setQueryData(["message-reactions", conversationId], context.previous);
    },
  });

  useEffect(() => {
    if (!conversationId || !userId) return;
    const onReaction = (payload: { new: unknown }) => {
      const row = payload.new as { message_id: string; user_id: string; emoji: string | null };
      if (!row?.message_id) return;
      applyReaction(row.message_id, row.user_id, row.emoji);
      if (row.emoji && row.user_id !== userId) playSound("reaction");
    };
    const channel = supabase
      .channel(`reactions-${conversationId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${conversationId}` }, onReaction)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "message_reactions", filter: `conversation_id=eq.${conversationId}` }, onReaction)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, applyReaction]);

  useEffect(() => {
    if (!conversationId || !userId) return;
    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const message = toChatMessage(payload.new as MessageRow);
          queryClient.setQueryData<ChatMessage[]>(["messages", conversationId], (old = []) =>
            old.some((m) => m.id === message.id) ? old : [...old, message],
          );
          if (message.sender_id !== userId) {
            playSound("receive");
            supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId });
          }
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, queryClient]);

  // When the other side last opened the chat: drives the ✓✓ "read" ticks.
  const readStateQuery = useQuery({
    queryKey: ["conversation-read", conversationId],
    queryFn: async (): Promise<ReadState | null> => {
      const { data, error } = await supabase
        .from("conversations")
        .select("customer_id, customer_last_read_at, vendor_last_read_at")
        .eq("id", conversationId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!conversationId && !!userId,
  });

  useEffect(() => {
    if (!conversationId || !userId) return;
    const channel = supabase
      .channel(`read-${conversationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "conversations", filter: `id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as Partial<ReadState>;
          if (!row?.customer_id) return;
          queryClient.setQueryData<ReadState>(["conversation-read", conversationId], {
            customer_id: row.customer_id,
            customer_last_read_at: row.customer_last_read_at ?? null,
            vendor_last_read_at: row.vendor_last_read_at ?? null,
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, queryClient]);

  const readState = readStateQuery.data;
  /** The customer sees the shop's (or support team's) read time; everyone else sees the customer's. */
  const otherLastReadAt = readState
    ? (readState.customer_id === userId ? readState.vendor_last_read_at : readState.customer_last_read_at)
    : null;

  // Opening the thread marks it read.
  useEffect(() => {
    if (!conversationId || !userId) return;
    supabase.rpc("mark_conversation_read", { p_conversation_id: conversationId }).then(() => {
      queryClient.invalidateQueries({ queryKey: ["conversations", userId] });
    });
  }, [conversationId, userId, queryClient]);

  const sendMessage = useMutation({
    mutationFn: async (input: string | SendMessageInput) => {
      const { body, messageType = "text", mediaPath = null, replyToId = null } = typeof input === "string" ? { body: input } : input;
      const isMedia = messageType !== "text";
      if (isMedia && !mediaPath) throw new Error("Missing attachment");
      const text = body.trim() || (isMedia ? MEDIA_LABELS[messageType] : "");
      if (!text) throw new Error("Message is empty");
      const { data, error } = await supabase
        .from("messages")
        .insert({
          conversation_id: conversationId!,
          sender_id: userId!,
          body: text.slice(0, 2000),
          message_type: messageType,
          media_path: isMedia ? mediaPath : null,
          reply_to_id: replyToId,
        })
        .select()
        .single();
      if (error) throw error;
      return toChatMessage(data);
    },
    onSuccess: (message) => {
      queryClient.setQueryData<ChatMessage[]>(["messages", conversationId], (old = []) =>
        old.some((m) => m.id === message.id) ? old : [...old, message],
      );
    },
  });

  return {
    conversation: summaryQuery.data ?? null,
    messages: messagesQuery.data ?? [],
    isLoading: summaryQuery.isLoading || messagesQuery.isLoading,
    sendMessage,
    userId,
    reactions: reactionsQuery.data ?? [],
    react,
    otherLastReadAt,
  };
}

/**
 * Lightweight "is typing" signal over a Realtime broadcast channel (nothing is stored).
 * Returns whether someone else in the thread is typing, and a throttled notifier to call on input.
 */
export function useTypingIndicator(conversationId: string | undefined, userId: string | null) {
  const [otherTyping, setOtherTyping] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentRef = useRef(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!conversationId || !userId) return;
    const channel = supabase
      .channel(`typing-${conversationId}`)
      .on("broadcast", { event: "typing" }, ({ payload }) => {
        if (!payload || payload.user_id === userId) return;
        setOtherTyping(true);
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
        hideTimerRef.current = setTimeout(() => setOtherTyping(false), 3000);
      })
      .on("broadcast", { event: "stop" }, ({ payload }) => {
        if (!payload || payload.user_id === userId) return;
        setOtherTyping(false);
      })
      .subscribe();
    channelRef.current = channel;
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      channelRef.current = null;
      setOtherTyping(false);
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId]);

  const notifyTyping = useCallback(() => {
    const now = Date.now();
    if (!channelRef.current || now - lastSentRef.current < 2000) return;
    lastSentRef.current = now;
    channelRef.current.send({ type: "broadcast", event: "typing", payload: { user_id: userId } });
  }, [userId]);

  const notifyStopped = useCallback(() => {
    lastSentRef.current = 0;
    channelRef.current?.send({ type: "broadcast", event: "stop", payload: { user_id: userId } });
  }, [userId]);

  return { otherTyping, notifyTyping, notifyStopped };
}

export function useStartConversation() {
  return useMutation({
    mutationFn: async ({ vendorId, productId }: { vendorId: string; productId?: string }) => {
      const { data, error } = await supabase.rpc("start_conversation", {
        p_vendor_id: vendorId,
        p_product_id: productId ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}

/** Opens (or reuses) the signed-in user's chat with the Kano Kaftan team. */
export function useStartSupportConversation() {
  return useMutation({
    mutationFn: async (productId?: string) => {
      const { data, error } = await supabase.rpc("start_support_conversation", {
        p_product_id: productId ?? null,
      });
      if (error) throw new Error(error.message);
      return data;
    },
  });
}
