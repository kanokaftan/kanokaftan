-- "Remind" button on Invite friends: the inviter can nudge a friend who joined
-- but hasn't linked a bank account yet. The friend gets a notification (and a
-- phone alert) that opens their account page with the bank card.
-- Limits: once every 24 hours per friend, 5 reminders in all.

ALTER TABLE public.customer_referrals
  ADD COLUMN IF NOT EXISTS ping_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_pinged_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.referral_ping_limit()
RETURNS INTEGER
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT 5 $$;

CREATE OR REPLACE FUNCTION public.referral_ping_gap()
RETURNS INTERVAL
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$ SELECT interval '24 hours' $$;

/** Sends the invited friend a reminder to link their bank account. */
CREATE OR REPLACE FUNCTION public.ping_referred_friend(p_referral_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_ref public.customer_referrals%ROWTYPE;
  v_me TEXT;
  v_reward NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_ref FROM public.customer_referrals WHERE id = p_referral_id AND referrer_id = v_uid FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That friend was not found.';
  END IF;
  IF v_ref.status <> 'joined' OR EXISTS (SELECT 1 FROM public.customer_bank_accounts WHERE user_id = v_ref.referred_id) THEN
    RAISE EXCEPTION 'Your friend has already verified. No reminder needed.';
  END IF;
  IF v_ref.ping_count >= public.referral_ping_limit() THEN
    RAISE EXCEPTION 'You have already reminded them % times. Try sending them a message instead.', public.referral_ping_limit();
  END IF;
  IF v_ref.last_pinged_at IS NOT NULL AND v_ref.last_pinged_at > now() - public.referral_ping_gap() THEN
    RAISE EXCEPTION 'You reminded them recently. You can remind them again tomorrow.';
  END IF;

  UPDATE public.customer_referrals
  SET ping_count = ping_count + 1, last_pinged_at = now()
  WHERE id = v_ref.id;

  SELECT COALESCE(NULLIF(split_part(btrim(full_name), ' ', 1), ''), 'Your friend') INTO v_me FROM public.profiles WHERE id = v_uid;
  SELECT COALESCE(referral_referrer_credit, 0) INTO v_reward FROM public.platform_settings WHERE id = 1;
  INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
  VALUES (
    v_ref.referred_id,
    format('%s is waiting for you', v_me),
    format('Link your bank account (takes 1 minute) to unlock first-buyer prices on Kano Kaftan. %s also gets %s K² when you do.',
           v_me, to_char(v_reward, 'FM999,999,990')),
    'info', 'system', '/account', jsonb_build_object('referral_id', v_ref.id, 'kind', 'referral_ping')
  );

  RETURN jsonb_build_object('ok', true, 'pings', v_ref.ping_count + 1,
    'next_ping_at', now() + public.referral_ping_gap(),
    'pings_left', public.referral_ping_limit() - v_ref.ping_count - 1);
END;
$$;

CREATE OR REPLACE FUNCTION public.my_referral()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  s public.platform_settings%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in to invite friends.';
  END IF;
  SELECT * INTO s FROM public.platform_settings WHERE id = 1;

  RETURN jsonb_build_object(
    'enabled', COALESCE(s.referral_enabled, false),
    'code', CASE WHEN COALESCE(s.referral_enabled, false) THEN public.ensure_referral_code(v_uid) END,
    'friend_credit', COALESCE(s.referral_friend_credit, 0),
    'referrer_credit', COALESCE(s.referral_referrer_credit, 0),
    'order_percent', COALESCE(s.referral_order_percent, 0),
    'min_order', COALESCE(s.referral_min_order, 0),
    'balance', public.customer_credit_balance(v_uid),
    'bank_verified', EXISTS (SELECT 1 FROM public.customer_bank_accounts WHERE user_id = v_uid),
    'joined', (SELECT count(*) FROM public.customer_referrals WHERE referrer_id = v_uid AND status <> 'cancelled'),
    'verified', (SELECT count(*) FROM public.customer_referrals WHERE referrer_id = v_uid AND status = 'rewarded'),
    'rewarded', (SELECT count(*) FROM public.customer_referrals WHERE referrer_id = v_uid AND status = 'rewarded'),
    'earned', COALESCE((SELECT sum(amount) FROM public.customer_credits WHERE user_id = v_uid AND kind IN ('referral_reward', 'referral_commission')), 0),
    'friends', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', COALESCE(NULLIF(split_part(btrim(p.full_name), ' ', 1), ''), 'A friend'),
        'status', r.status,
        'pings', r.ping_count,
        'last_pinged_at', r.last_pinged_at,
        -- A reminder can go out once a day, a few times in all, while they haven't linked a bank account.
        'can_ping', r.status = 'joined'
          AND r.ping_count < public.referral_ping_limit()
          AND (r.last_pinged_at IS NULL OR r.last_pinged_at < now() - public.referral_ping_gap())
          AND NOT EXISTS (SELECT 1 FROM public.customer_bank_accounts b WHERE b.user_id = r.referred_id),
        'joined_at', r.created_at,
        'rewarded_at', r.rewarded_at,
        'earned', COALESCE((SELECT sum(c.amount) FROM public.customer_credits c WHERE c.referral_id = r.id AND c.user_id = v_uid), 0)
      ) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM public.customer_referrals WHERE referrer_id = v_uid ORDER BY created_at DESC LIMIT 100) r
      LEFT JOIN public.profiles p ON p.id = r.referred_id
    ), '[]'::JSONB),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('amount', c.amount, 'kind', c.kind, 'order_id', c.order_id, 'created_at', c.created_at) ORDER BY c.created_at DESC)
      FROM (SELECT * FROM public.customer_credits WHERE user_id = v_uid ORDER BY created_at DESC LIMIT 30) c
    ), '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.referral_ping_limit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.referral_ping_gap() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ping_referred_friend(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ping_referred_friend(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.my_referral() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral() TO authenticated;
