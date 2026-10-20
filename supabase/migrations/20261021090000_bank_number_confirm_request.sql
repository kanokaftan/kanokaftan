-- Bank links made before full account numbers were kept only have the last 4
-- digits (the rest is a keyed hash that can't be read back). Admins can ask
-- those buyers to confirm their number once: they get a notification that
-- opens the confirm form. At most one reminder per person per day.

/** How many linked buyer bank accounts are still missing the full number. */
CREATE OR REPLACE FUNCTION public.admin_bank_numbers_missing()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN (SELECT count(*) FROM public.customer_bank_accounts WHERE account_number IS NULL AND verified_at IS NOT NULL);
END;
$$;

/**
 * Sends "please confirm your account number" to the given buyers (or, with no
 * list, to everyone still missing it). Returns how many were reminded and how
 * many were skipped because they were reminded in the last 24 hours.
 */
CREATE OR REPLACE FUNCTION public.admin_request_bank_number_confirm(p_user_ids UUID[] DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sent INTEGER;
  v_targets INTEGER;
BEGIN
  PERFORM public.require_admin();

  WITH targets AS (
    SELECT b.user_id FROM public.customer_bank_accounts b
    WHERE b.account_number IS NULL AND b.verified_at IS NOT NULL
      AND (p_user_ids IS NULL OR b.user_id = ANY (p_user_ids))
  ), fresh AS (
    SELECT t.user_id FROM targets t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.notifications n
      WHERE n.user_id = t.user_id AND n.metadata ->> 'kind' = 'confirm_bank_number' AND n.created_at > now() - interval '24 hours')
  ), sent AS (
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    SELECT f.user_id, 'Please confirm your bank account number',
           'Kano Kaftan needs your full account number once so we can pay your rewards. It takes 10 seconds.',
           'info', 'system', '/account?confirm_bank=1', jsonb_build_object('kind', 'confirm_bank_number')
    FROM fresh f
    RETURNING 1
  )
  SELECT (SELECT count(*) FROM sent), (SELECT count(*) FROM targets) INTO v_sent, v_targets;

  RETURN jsonb_build_object('sent', v_sent, 'skipped', v_targets - v_sent);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_bank_numbers_missing() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_bank_numbers_missing() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_request_bank_number_confirm(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_request_bank_number_confirm(UUID[]) TO authenticated;
