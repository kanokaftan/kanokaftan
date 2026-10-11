-- Run payouts every 15 minutes: release second halves whose delivery window
-- ended, send pending transfers, re-check stuck ones and end expired featured
-- placements. Uses the same internal secret as push notifications, so nothing
-- extra needs configuring. Sending is skipped until PAYSTACK_SECRET_KEY exists,
-- then the very next run sends everything that was waiting.

CREATE OR REPLACE FUNCTION public.run_payouts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_cfg public.push_config%ROWTYPE;
BEGIN
  SELECT * INTO v_cfg FROM public.push_config WHERE id = 1;
  IF v_cfg.function_url IS NULL OR v_cfg.hook_secret IS NULL THEN
    RAISE WARNING 'run_payouts: push_config not set up';
    RETURN;
  END IF;
  PERFORM net.http_post(
    url := regexp_replace(v_cfg.function_url, '/push/?$', '/process-payouts'),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_cfg.hook_secret),
    body := '{}'::jsonb
  );
END;
$$;
REVOKE EXECUTE ON FUNCTION public.run_payouts() FROM PUBLIC, anon, authenticated;

SELECT cron.schedule('payout-run', '*/15 * * * *', 'SELECT public.run_payouts()');
