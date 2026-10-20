-- Helpers for the delete-account edge function (service role only):
-- the person's uploaded files, removing their Google/email sign-in records,
-- and a small log so admins can see that a deletion happened (no personal data).

CREATE TABLE IF NOT EXISTS public.account_deletions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL,
  mode TEXT NOT NULL CHECK (mode IN ('deleted', 'anonymised')),
  had_shop BOOLEAN NOT NULL DEFAULT false,
  files_removed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read account deletions" ON public.account_deletions FOR SELECT TO authenticated
  USING (public.has_role((SELECT auth.uid()), 'admin'));

/** Every file this person uploaded (their own folder in each bucket). */
CREATE OR REPLACE FUNCTION public.account_storage_paths(p_user_id UUID)
RETURNS TABLE (bucket_id TEXT, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  SELECT o.bucket_id, o.name FROM storage.objects o
  WHERE o.bucket_id IN ('product-images', 'chat-media') AND o.name LIKE p_user_id::TEXT || '/%';
$$;

/** Removes sign-in methods and sessions for an anonymised account (its auth row stays, blocked). */
CREATE OR REPLACE FUNCTION public.purge_account_sign_in(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  DELETE FROM auth.identities WHERE user_id = p_user_id;
  DELETE FROM auth.sessions WHERE user_id = p_user_id;
  DELETE FROM auth.mfa_factors WHERE user_id = p_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.account_storage_paths(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_storage_paths(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.purge_account_sign_in(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.purge_account_sign_in(UUID) TO service_role;
REVOKE ALL ON TABLE public.account_deletions FROM anon;
