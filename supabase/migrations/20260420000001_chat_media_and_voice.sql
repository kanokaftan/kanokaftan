-- Add message_type and media_url to messages table
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS media_url TEXT;

-- Create public chat-media storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO NOTHING;

-- Any authenticated user can upload chat media
CREATE POLICY "Authenticated users can upload chat media"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat-media');

-- Public read access to chat media
CREATE POLICY "Public can view chat media"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'chat-media');

-- Users can delete their own uploads
CREATE POLICY "Authenticated users can delete chat media"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'chat-media');
