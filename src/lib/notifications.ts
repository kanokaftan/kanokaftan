import { supabase } from "@/integrations/supabase/client";

interface CreateNotificationParams {
  userId: string;
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'order' | 'payment' | 'system';
  category?: 'order' | 'payment' | 'product' | 'review' | 'system' | 'promotion' | 'general';
  actionUrl?: string;
  metadata?: Record<string, any>;
}

/**
 * Create a notification for a user (client-side)
 * Note: This uses the edge function for service-role access
 */
export async function createNotification(params: CreateNotificationParams) {
  const { data, error } = await supabase.functions.invoke('create-notification', {
    body: {
      action: 'create',
      user_id: params.userId,
      title: params.title,
      message: params.message,
      type: params.type || 'info',
      category: params.category || 'general',
      action_url: params.actionUrl,
      metadata: params.metadata || {},
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Send notifications to multiple users
 */
export async function createBulkNotifications(
  userIds: string[],
  notification: Omit<CreateNotificationParams, 'userId'>
) {
  const { data, error } = await supabase.functions.invoke('create-notification', {
    body: {
      action: 'bulk',
      user_ids: userIds,
      title: notification.title,
      message: notification.message,
      type: notification.type || 'info',
      category: notification.category || 'general',
      action_url: notification.actionUrl,
      metadata: notification.metadata || {},
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Notify all users with a specific role
 */
export async function notifyRole(
  role: 'customer' | 'vendor' | 'admin',
  notification: Omit<CreateNotificationParams, 'userId'>
) {
  const { data, error } = await supabase.functions.invoke('create-notification', {
    body: {
      action: 'notify_role',
      role,
      title: notification.title,
      message: notification.message,
      type: notification.type || 'info',
      category: notification.category || 'general',
      action_url: notification.actionUrl,
      metadata: notification.metadata || {},
    },
  });

  if (error) throw error;
  return data;
}
