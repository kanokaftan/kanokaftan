-- Fix chat RLS so admin can see ALL chats and messages
-- Run this in Supabase SQL Editor if supabase db push has not been run

ALTER TABLE public.chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop all existing chat policies (clean slate)
DROP POLICY IF EXISTS "Customers can view their own chats" ON public.chats;
DROP POLICY IF EXISTS "Customers can create their own chats" ON public.chats;
DROP POLICY IF EXISTS "Customers can update their own chats" ON public.chats;
DROP POLICY IF EXISTS "Admins can view all chats" ON public.chats;
DROP POLICY IF EXISTS "Admins can update all chats" ON public.chats;
DROP POLICY IF EXISTS "Admins can insert chats" ON public.chats;
DROP POLICY IF EXISTS "Admin sees all chats" ON public.chats;
DROP POLICY IF EXISTS "Customer sees own chats" ON public.chats;
DROP POLICY IF EXISTS "Customer creates chat" ON public.chats;
DROP POLICY IF EXISTS "Admin updates chats" ON public.chats;
DROP POLICY IF EXISTS "Customer updates own chat" ON public.chats;

-- Drop all existing message policies
DROP POLICY IF EXISTS "Users can view messages in their chats" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages in their chats" ON public.messages;
DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
DROP POLICY IF EXISTS "Admins can send messages" ON public.messages;
DROP POLICY IF EXISTS "Admin sees all messages" ON public.messages;
DROP POLICY IF EXISTS "Customer sees own messages" ON public.messages;
DROP POLICY IF EXISTS "Admin sends messages" ON public.messages;
DROP POLICY IF EXISTS "Customer sends messages" ON public.messages;

-- Drop notification policies
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;

-- ── CHATS ──────────────────────────────────────────────────────────────────

-- Admin can read ALL chats (uses user_roles table directly - no has_role dependency)
CREATE POLICY "admin_read_all_chats" ON public.chats
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin can update any chat (close, reopen)
CREATE POLICY "admin_update_all_chats" ON public.chats
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Customers read their own chats
CREATE POLICY "customer_read_own_chats" ON public.chats
  FOR SELECT USING (customer_id = auth.uid());

-- Customers create their own chats
CREATE POLICY "customer_create_chat" ON public.chats
  FOR INSERT WITH CHECK (customer_id = auth.uid());

-- Customers update their own chats
CREATE POLICY "customer_update_own_chat" ON public.chats
  FOR UPDATE USING (customer_id = auth.uid());

-- ── MESSAGES ───────────────────────────────────────────────────────────────

-- Admin can read ALL messages
CREATE POLICY "admin_read_all_messages" ON public.messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Admin can insert messages
CREATE POLICY "admin_send_messages" ON public.messages
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );

-- Customers read messages in their own chats
CREATE POLICY "customer_read_own_messages" ON public.messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id AND chats.customer_id = auth.uid()
    )
  );

-- Customers send messages in their own chats
CREATE POLICY "customer_send_messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM public.chats
      WHERE chats.id = messages.chat_id AND chats.customer_id = auth.uid()
    )
  );

-- ── NOTIFICATIONS ──────────────────────────────────────────────────────────

CREATE POLICY "users_read_own_notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Anyone authenticated can insert notifications
CREATE POLICY "authenticated_insert_notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
