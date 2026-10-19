-- The phone re-alerts every few seconds while a call rings (closed web apps
-- can't ring). Once the person has the ringing screen open in the app, those
-- alerts stop: the app records that it showed the call.

ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS seen_by UUID[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.mark_call_seen(p_call_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN;
  END IF;
  UPDATE public.calls
  SET seen_by = array_append(seen_by, v_uid)
  WHERE id = p_call_id
    AND status = 'ringing'
    AND NOT (v_uid = ANY (seen_by))
    AND (callee_id = v_uid OR (to_support AND callee_id IS NULL AND public.has_role(v_uid, 'admin')));
END;
$$;

REVOKE ALL ON FUNCTION public.mark_call_seen(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_call_seen(UUID) TO authenticated;
