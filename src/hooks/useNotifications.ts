import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { playSound } from "@/lib/callTones";
import i18n from "@/i18n/index";

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'order' | 'payment' | 'system';
  category: 'order' | 'payment' | 'product' | 'review' | 'system' | 'promotion' | 'general' | 'message' | 'call';
  is_read: boolean;
  action_url: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export function useNotifications() {
  const [userId, setUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user?.id ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const { data: notifications = [], isLoading, refetch } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as Notification[];
    },
    enabled: !!userId,
  });

  // Realtime: optimistic prepend + Sonner toast (no full refetch)
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      // Unique per hook instance: several components use this hook at once
      .channel(`notifications:${userId}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;

          // Prepend optimistically — no DB round-trip
          queryClient.setQueryData(
            ["notifications", userId],
            (old: Notification[] = []) => {
              if (old.find((n) => n.id === newNotif.id)) return old;
              return [newNotif, ...old];
            }
          );

          // Soft chime, except for calls (they ring) and the chat already on screen (it pops).
          const conversationId = (newNotif.metadata as { conversation_id?: string } | null)?.conversation_id;
          const viewingThatChat = !!conversationId && window.location.pathname.endsWith(`/messages/${conversationId}`);
          if (newNotif.category !== "call" && !viewingThatChat) playSound("notify");
          // An order or payment changed: refresh any order cards showing in chats right away.
          if (newNotif.category === "order" || newNotif.category === "payment") {
            queryClient.invalidateQueries({ queryKey: ["chat-order"] });
          }

          // Show toast with optional action
          // Fixed id so several mounted instances show a single toast
          const text = localizedNotification(newNotif, i18n.language ?? "en");
          toast(text.title, {
            id: `notification-${newNotif.id}`,
            description: text.message,
            duration: 5000,
            ...(newNotif.action_url
              ? {
                  action: {
                    label: "View",
                    onClick: () => window.location.assign(newNotif.action_url!),
                  },
                }
              : {}),
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient]);

  const markAsRead = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("id", notificationId);
      if (error) throw error;
    },
    onMutate: async (notificationId) => {
      queryClient.setQueryData(
        ["notifications", userId],
        (old: Notification[] = []) =>
          old.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n))
      );
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true })
        .eq("user_id", userId)
        .eq("is_read", false);
      if (error) throw error;
    },
    onMutate: () => {
      queryClient.setQueryData(
        ["notifications", userId],
        (old: Notification[] = []) => old.map((n) => ({ ...n, is_read: true }))
      );
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const deleteNotification = useMutation({
    mutationFn: async (notificationId: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", notificationId);
      if (error) throw error;
    },
    onMutate: async (notificationId) => {
      queryClient.setQueryData(
        ["notifications", userId],
        (old: Notification[] = []) => old.filter((n) => n.id !== notificationId)
      );
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const clearAll = useMutation({
    mutationFn: async () => {
      if (!userId) return;
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("user_id", userId);
      if (error) throw error;
    },
    onMutate: () => {
      queryClient.setQueryData(["notifications", userId], []);
    },
    onError: () => queryClient.invalidateQueries({ queryKey: ["notifications", userId] }),
  });

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    isLoading,
    refetch,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  };
}

/** Title and message in the person's chosen language (announcements can carry a Hausa version). */
export function localizedNotification(n: Pick<Notification, "title" | "message" | "metadata">, language: string) {
  const meta = (n.metadata ?? {}) as { title_ha?: string; message_ha?: string };
  if (language.startsWith("ha") && meta.title_ha && meta.message_ha) {
    return { title: meta.title_ha, message: meta.message_ha };
  }
  return { title: n.title, message: n.message };
}
