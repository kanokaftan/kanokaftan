-- Fix the overly permissive notifications INSERT policy
-- The "Service role can insert notifications" policy uses WITH CHECK (true) which is flagged

-- Drop the problematic policy
DROP POLICY IF EXISTS "Service role can insert notifications" ON public.notifications;

-- Create a proper policy for service role that uses service_role() check
-- Service role operations should be done through edge functions which bypass RLS anyway
-- For user-created notifications (if any), we need a proper policy

-- Policy for users to view their own notifications (should already exist but let's ensure)
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
CREATE POLICY "Users can view their own notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Policy for users to update their own notifications (mark as read)
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
ON public.notifications
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- For INSERT, notifications are created by edge functions using service role
-- which bypasses RLS, so we don't need a permissive INSERT policy
-- If we need to allow specific inserts, we can add a targeted policy