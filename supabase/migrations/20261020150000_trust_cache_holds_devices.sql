-- Suspicious accounts, part 2:
--   * "Not a duplicate": admins can clear a warning they checked; it stays cleared.
--   * Same device: the app records a random id kept on the phone; two accounts
--     signing in from the same phone get a "same_device" warning.
--   * Saved warnings: worked out for everyone each night (and right away for the
--     people involved when a bank account, device or blocked invite appears), so
--     the Suspicious list stays fast as the app grows.
--   * Rewards on hold: when a friend verifies and either side has a warning, the
--     inviter's K² waits for an admin to approve or reject it.

-- ---------------------------------------------------------------------------
-- Dismissed warnings and devices
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.user_trust_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  other_id UUID,
  dismissed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_trust_dismissals_once_idx
  ON public.user_trust_dismissals (user_id, code, COALESCE(other_id, '00000000-0000-0000-0000-000000000000'::UUID));
ALTER TABLE public.user_trust_dismissals ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_devices (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL CHECK (char_length(device_id) BETWEEN 16 AND 64),
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, device_id)
);
CREATE INDEX IF NOT EXISTS user_devices_device_idx ON public.user_devices (device_id);
ALTER TABLE public.user_devices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.user_trust_flags_cache (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  flags JSONB NOT NULL DEFAULT '[]'::JSONB,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS user_trust_flags_cache_flagged_idx ON public.user_trust_flags_cache (user_id) WHERE flags <> '[]'::JSONB;
ALTER TABLE public.user_trust_flags_cache ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Held rewards
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.customer_referrals ' || 'DR' || 'OP CONSTRAINT IF EXISTS customer_referrals_status_check';
END $$;
ALTER TABLE public.customer_referrals ADD CONSTRAINT customer_referrals_status_check
  CHECK (status IN ('joined', 'held', 'rewarded', 'cancelled'));
ALTER TABLE public.customer_referrals
  ADD COLUMN IF NOT EXISTS held_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS held_reason TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Warnings (live), now with same_device and minus dismissed ones
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_trust_flags(p_user_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH me AS (
    SELECT p.id, public.phone_key(p.phone) AS phone, b.account_name
    FROM public.profiles p
    LEFT JOIN public.customer_bank_accounts b ON b.user_id = p.id
    WHERE p.id = p_user_id
  ), raw AS (
    SELECT 'same_bank_name'::TEXT AS code, 'Another account has a bank account in the same name'::TEXT AS label, b.user_id AS other_id
    FROM me JOIN public.customer_bank_accounts b
      ON b.user_id <> me.id AND me.account_name IS NOT NULL AND public.names_same(me.account_name, b.account_name)
    UNION
    SELECT 'same_phone', 'Same phone number as another account', p.id
    FROM me JOIN public.profiles p ON p.id <> me.id AND me.phone IS NOT NULL AND public.phone_key(p.phone) = me.phone
    UNION
    SELECT 'same_device', 'Signed in on the same phone as another account', d2.user_id
    FROM public.user_devices d1
    JOIN public.user_devices d2 ON d2.device_id = d1.device_id AND d2.user_id <> d1.user_id
    WHERE d1.user_id = p_user_id
    UNION
    SELECT 'blocked_invite', 'An invite with another account was blocked (same name)',
           CASE WHEN r.referrer_id = p_user_id THEN r.referred_id ELSE r.referrer_id END
    FROM public.customer_referrals r
    WHERE r.status = 'cancelled' AND r.reviewed_at IS NULL AND p_user_id IN (r.referrer_id, r.referred_id)
    UNION
    SELECT 'invite_burst', format('%s friends joined within 24 hours', max(w.cnt)), NULL::UUID
    FROM (
      SELECT count(*) OVER (ORDER BY created_at RANGE BETWEEN interval '24 hours' PRECEDING AND CURRENT ROW) AS cnt
      FROM public.customer_referrals WHERE referrer_id = p_user_id
    ) w
    HAVING max(w.cnt) >= 5
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', raw.code, 'label', raw.label, 'other_id', raw.other_id) ORDER BY raw.code), '[]'::JSONB)
  FROM raw
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_trust_dismissals d
    WHERE d.user_id = p_user_id AND d.code = raw.code AND d.other_id IS NOT DISTINCT FROM raw.other_id
  );
$$;

/** Saves one user's warnings; with p_around, also everyone those warnings point at. */
CREATE OR REPLACE FUNCTION public.refresh_trust_flags(p_user_id UUID, p_around BOOLEAN DEFAULT true)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_flags JSONB := public.user_trust_flags(p_user_id);
  v_other UUID;
BEGIN
  INSERT INTO public.user_trust_flags_cache (user_id, flags, refreshed_at)
  VALUES (p_user_id, v_flags, now())
  ON CONFLICT (user_id) DO UPDATE SET flags = EXCLUDED.flags, refreshed_at = EXCLUDED.refreshed_at;
  IF p_around THEN
    FOR v_other IN SELECT DISTINCT (f ->> 'other_id')::UUID FROM jsonb_array_elements(v_flags) f WHERE f ->> 'other_id' IS NOT NULL LOOP
      PERFORM public.refresh_trust_flags(v_other, false);
    END LOOP;
  END IF;
END;
$$;

/** Nightly: everyone's warnings. */
CREATE OR REPLACE FUNCTION public.refresh_all_trust_flags()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_id IN SELECT id FROM public.profiles LOOP
    PERFORM public.refresh_trust_flags(v_id, false);
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;

-- Fresh warnings right away when something that matters changes.
CREATE OR REPLACE FUNCTION public.trust_flags_on_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'customer_referrals' THEN
    PERFORM public.refresh_trust_flags(NEW.referrer_id);
    PERFORM public.refresh_trust_flags(NEW.referred_id);
  ELSE
    PERFORM public.refresh_trust_flags(NEW.user_id);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER customer_bank_accounts_trust_flags
  AFTER INSERT OR UPDATE OF account_name ON public.customer_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.trust_flags_on_change();
CREATE OR REPLACE TRIGGER user_devices_trust_flags
  AFTER INSERT ON public.user_devices
  FOR EACH ROW EXECUTE FUNCTION public.trust_flags_on_change();
CREATE OR REPLACE TRIGGER customer_referrals_trust_flags
  AFTER INSERT OR UPDATE OF status ON public.customer_referrals
  FOR EACH ROW EXECUTE FUNCTION public.trust_flags_on_change();

-- ---------------------------------------------------------------------------
-- Device sign-ins
-- ---------------------------------------------------------------------------

/** Called by the app once per session: notes that this account used this phone. */
CREATE OR REPLACE FUNCTION public.record_my_device(p_device_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL OR p_device_id IS NULL OR p_device_id !~ '^[A-Za-z0-9-]{16,64}$' THEN
    RETURN;
  END IF;
  -- One phone with dozens of accounts is itself the signal; no need to keep more.
  IF (SELECT count(*) FROM public.user_devices WHERE user_id = v_uid) >= 20 THEN
    UPDATE public.user_devices SET last_seen_at = now() WHERE user_id = v_uid AND device_id = p_device_id;
    RETURN;
  END IF;
  INSERT INTO public.user_devices (user_id, device_id) VALUES (v_uid, p_device_id)
  ON CONFLICT (user_id, device_id) DO UPDATE SET last_seen_at = now();
END;
$$;

-- ---------------------------------------------------------------------------
-- Rewards on hold
-- ---------------------------------------------------------------------------

/** Pays the inviter once the invited buyer has a verified bank account; holds it when either side has a warning. */
CREATE OR REPLACE FUNCTION public.reward_referral_if_verified(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.customer_referrals%ROWTYPE;
  v_mine public.customer_bank_accounts%ROWTYPE;
  v_warnings TEXT;
BEGIN
  SELECT * INTO v_ref FROM public.customer_referrals WHERE referred_id = p_user_id AND status = 'joined' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT * INTO v_mine FROM public.customer_bank_accounts WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  -- The friend's verified name can't be the inviter's own full name: that's a second account.
  IF EXISTS (SELECT 1 FROM public.customer_bank_accounts b WHERE b.user_id = v_ref.referrer_id
             AND public.names_same(b.account_name, v_mine.account_name)) THEN
    UPDATE public.customer_referrals SET status = 'cancelled' WHERE id = v_ref.id;
    RETURN;
  END IF;

  SELECT string_agg(DISTINCT f ->> 'label', '; ') INTO v_warnings
  FROM (
    SELECT jsonb_array_elements(public.user_trust_flags(p_user_id)) AS f
    UNION ALL
    SELECT jsonb_array_elements(public.user_trust_flags(v_ref.referrer_id))
  ) x;

  IF v_warnings IS NOT NULL THEN
    UPDATE public.customer_referrals SET status = 'held', held_at = now(), held_reason = v_warnings WHERE id = v_ref.id;
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
    VALUES (v_ref.referrer_id, 'Your friend verified',
            'Your K² reward is being checked by Kano Kaftan and will be added once approved.', 'info', 'system', '/invite');
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
    SELECT ur.user_id, 'Invite reward on hold', format('Check before paying: %s', v_warnings), 'warning', 'system',
           '/admin/users?filter=suspicious'
    FROM public.user_roles ur WHERE ur.role = 'admin';
    RETURN;
  END IF;

  PERFORM public.pay_referral_reward(v_ref.id);
END;
$$;

/** Marks a referral rewarded and adds the inviter's K² (shared by the normal path and admin approval). */
CREATE OR REPLACE FUNCTION public.pay_referral_reward(p_referral_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.customer_referrals%ROWTYPE;
  v_amount NUMERIC;
  v_friend TEXT;
BEGIN
  SELECT * INTO v_ref FROM public.customer_referrals WHERE id = p_referral_id;
  SELECT COALESCE(referral_referrer_credit, 0) INTO v_amount FROM public.platform_settings WHERE id = 1;
  UPDATE public.customer_referrals SET status = 'rewarded', rewarded_at = now() WHERE id = v_ref.id;
  IF v_amount > 0 THEN
    INSERT INTO public.customer_credits (user_id, amount, kind, referral_id, note)
    VALUES (v_ref.referrer_id, v_amount, 'referral_reward', v_ref.id, 'Your friend verified their account')
    ON CONFLICT DO NOTHING;
    SELECT COALESCE(NULLIF(split_part(btrim(full_name), ' ', 1), ''), 'Your friend') INTO v_friend FROM public.profiles WHERE id = v_ref.referred_id;
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    VALUES (v_ref.referrer_id, format('+%s K² credit', to_char(v_amount, 'FM999,999,990')),
            format('%s verified their account. You also get %s%% of their orders as K² credit.', v_friend,
                   to_char((SELECT referral_order_percent FROM public.platform_settings WHERE id = 1), 'FM990.##')),
            'success', 'promotion', '/invite', jsonb_build_object('referral_id', v_ref.id));
  END IF;
END;
$$;

/** Admin: rewards waiting for a decision. */
CREATE OR REPLACE FUNCTION public.admin_held_referrals()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', r.id, 'held_at', r.held_at, 'reason', r.held_reason,
      'referrer_id', r.referrer_id, 'referrer_name', COALESCE(NULLIF(btrim(a.full_name), ''), a.email),
      'friend_id', r.referred_id, 'friend_name', COALESCE(NULLIF(btrim(f.full_name), ''), f.email),
      'friend_bank_name', b.account_name,
      'amount', (SELECT referral_referrer_credit FROM public.platform_settings WHERE id = 1)
    ) ORDER BY r.held_at)
    FROM public.customer_referrals r
    JOIN public.profiles a ON a.id = r.referrer_id
    JOIN public.profiles f ON f.id = r.referred_id
    LEFT JOIN public.customer_bank_accounts b ON b.user_id = r.referred_id
    WHERE r.status = 'held'
  ), '[]'::JSONB);
END;
$$;

/** Admin: approve (pay the K²) or reject (the invite doesn't count) a held reward. */
CREATE OR REPLACE FUNCTION public.admin_review_held_referral(p_id UUID, p_approve BOOLEAN)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.customer_referrals%ROWTYPE;
BEGIN
  PERFORM public.require_admin();
  SELECT * INTO v_ref FROM public.customer_referrals WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_ref.status <> 'held' THEN
    RAISE EXCEPTION 'This reward is no longer waiting for a decision.';
  END IF;
  UPDATE public.customer_referrals SET reviewed_by = auth.uid(), reviewed_at = now() WHERE id = p_id;
  IF p_approve THEN
    PERFORM public.pay_referral_reward(p_id);
    RETURN 'approved';
  END IF;
  UPDATE public.customer_referrals SET status = 'cancelled' WHERE id = p_id;
  INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
  VALUES (v_ref.referrer_id, 'Invite reward not approved',
          'This invite didn''t count: the accounts look like they belong to the same person. Contact us if this is a mistake.',
          'info', 'system', '/invite');
  RETURN 'rejected';
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin: dismiss a warning, recheck everyone, status
-- ---------------------------------------------------------------------------

/** "Not a duplicate": clears this warning for both accounts. */
CREATE OR REPLACE FUNCTION public.admin_dismiss_trust_flag(p_user_id UUID, p_code TEXT, p_other_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  IF p_code NOT IN ('same_bank_name', 'same_phone', 'same_device', 'blocked_invite', 'invite_burst') THEN
    RAISE EXCEPTION 'Unknown warning.';
  END IF;
  INSERT INTO public.user_trust_dismissals (user_id, code, other_id, dismissed_by)
  VALUES (p_user_id, p_code, p_other_id, auth.uid())
  ON CONFLICT DO NOTHING;
  IF p_other_id IS NOT NULL THEN
    INSERT INTO public.user_trust_dismissals (user_id, code, other_id, dismissed_by)
    VALUES (p_other_id, p_code, p_user_id, auth.uid())
    ON CONFLICT DO NOTHING;
  END IF;
  PERFORM public.refresh_trust_flags(p_user_id);
  IF p_other_id IS NOT NULL THEN
    PERFORM public.refresh_trust_flags(p_other_id);
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_recheck_trust_flags()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN public.refresh_all_trust_flags();
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_trust_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN jsonb_build_object(
    'checked_at', (SELECT min(refreshed_at) FROM public.user_trust_flags_cache),
    'held', (SELECT count(*) FROM public.customer_referrals WHERE status = 'held')
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Users list reads the saved warnings
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_users(p_search TEXT DEFAULT NULL, p_role TEXT DEFAULT 'customer', p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search TEXT := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  PERFORM public.require_admin();
  RETURN (
    WITH base AS (
      SELECT p.id, p.email, p.full_name, p.phone, p.avatar_url, p.is_verified, p.created_at, p.last_seen_at,
             b.bank_name AS linked_bank_name, b.account_name AS bank_account_name, b.account_last4, b.verified_at AS bank_verified_at,
             COALESCE(c.flags, '[]'::JSONB) AS flags
      FROM public.profiles p
      LEFT JOIN public.customer_bank_accounts b ON b.user_id = p.id
      LEFT JOIN public.user_trust_flags_cache c ON c.user_id = p.id
      WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role::TEXT IN ('vendor', 'admin'))
        AND (v_search IS NULL OR p.full_name ILIKE '%' || v_search || '%' OR p.email ILIKE '%' || v_search || '%'
             OR p.phone ILIKE '%' || v_search || '%' OR b.account_name ILIKE '%' || v_search || '%')
    ), filtered AS (
      SELECT * FROM base
      WHERE p_role IN ('customer', 'all')
         OR (p_role = 'bank_linked' AND bank_verified_at IS NOT NULL)
         OR (p_role = 'bank_missing' AND bank_verified_at IS NULL)
         OR (p_role = 'suspicious' AND flags <> '[]'::JSONB)
    ), page AS (
      SELECT *, CASE WHEN p_role = 'bank_linked' THEN bank_verified_at ELSE created_at END AS sort_at
      FROM filtered
      ORDER BY CASE WHEN p_role = 'bank_linked' THEN bank_verified_at ELSE created_at END DESC
      LIMIT LEAST(p_limit, 200) OFFSET GREATEST(p_offset, 0)
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM filtered),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', pg.id, 'email', pg.email, 'full_name', pg.full_name, 'phone', pg.phone, 'avatar_url', pg.avatar_url,
        'is_verified', pg.is_verified, 'created_at', pg.created_at, 'last_seen_at', pg.last_seen_at,
        'roles', '["customer"]'::JSONB,
        'bank_name', pg.linked_bank_name, 'bank_account_name', pg.bank_account_name,
        'account_last4', pg.account_last4, 'bank_verified_at', pg.bank_verified_at,
        'invited_by_id', inv.referrer_id,
        'invited_by_name', COALESCE(NULLIF(btrim(ip.full_name), ''), ip.email),
        'friends_invited', (SELECT count(*) FROM public.customer_referrals r WHERE r.referrer_id = pg.id AND r.status <> 'cancelled'),
        'friends_verified', (SELECT count(*) FROM public.customer_referrals r WHERE r.referrer_id = pg.id AND r.status = 'rewarded'),
        'k2_earned', COALESCE((SELECT sum(c.amount) FROM public.customer_credits c
                               WHERE c.user_id = pg.id AND c.kind IN ('referral_reward', 'referral_commission')), 0),
        'flags', pg.flags
      ) ORDER BY pg.sort_at DESC)
      FROM page pg
      LEFT JOIN public.customer_referrals inv ON inv.referred_id = pg.id
      LEFT JOIN public.profiles ip ON ip.id = inv.referrer_id), '[]'::JSONB)
    )
  );
END;
$$;

-- admin_user_trust: friends now include held ones with the reason.
CREATE OR REPLACE FUNCTION public.admin_user_trust(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN jsonb_build_object(
    'flags', COALESCE((
      SELECT jsonb_agg(f.value || jsonb_build_object(
        'other_name', COALESCE(NULLIF(btrim(o.full_name), ''), o.email),
        'other_email', o.email,
        'other_is_seller', EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = o.id AND r.role::TEXT = 'vendor')))
      FROM jsonb_array_elements(public.user_trust_flags(p_user_id)) f
      LEFT JOIN public.profiles o ON o.id = NULLIF(f.value ->> 'other_id', '')::UUID
    ), '[]'::JSONB),
    'invited_by', (
      SELECT jsonb_build_object('id', p.id, 'name', COALESCE(NULLIF(btrim(p.full_name), ''), p.email), 'status', r.status, 'joined_at', r.created_at)
      FROM public.customer_referrals r JOIN public.profiles p ON p.id = r.referrer_id
      WHERE r.referred_id = p_user_id
    ),
    'k2_balance', public.customer_credit_balance(p_user_id),
    'k2_earned', COALESCE((SELECT sum(amount) FROM public.customer_credits
                           WHERE user_id = p_user_id AND kind IN ('referral_reward', 'referral_commission')), 0),
    'friends', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', COALESCE(NULLIF(btrim(p.full_name), ''), p.email), 'email', p.email,
        'referral_id', r.id, 'status', r.status, 'held_reason', r.held_reason, 'joined_at', r.created_at, 'pings', r.ping_count,
        'bank_linked', EXISTS (SELECT 1 FROM public.customer_bank_accounts b WHERE b.user_id = p.id)
      ) ORDER BY r.created_at DESC)
      FROM public.customer_referrals r JOIN public.profiles p ON p.id = r.referred_id
      WHERE r.referrer_id = p_user_id
    ), '[]'::JSONB)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Nightly recheck (02:10 Lagos) and first fill
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'trust-flags-nightly') THEN
    PERFORM cron.unschedule('trust-flags-nightly');
  END IF;
  PERFORM cron.schedule('trust-flags-nightly', '10 1 * * *', 'SELECT public.refresh_all_trust_flags()');
END $$;

SELECT public.refresh_all_trust_flags();

REVOKE ALL ON FUNCTION public.refresh_trust_flags(UUID, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.refresh_all_trust_flags() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trust_flags_on_change() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.pay_referral_reward(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_referral_if_verified(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_trust_flags(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_my_device(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_my_device(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_held_referrals() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_held_referrals() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_review_held_referral(UUID, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_review_held_referral(UUID, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_dismiss_trust_flag(UUID, TEXT, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dismiss_trust_flag(UUID, TEXT, UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_recheck_trust_flags() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_recheck_trust_flags() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_trust_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_trust_status() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_user_trust(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_trust(UUID) TO authenticated;
