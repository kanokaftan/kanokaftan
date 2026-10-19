-- Admin Users: spot suspicious accounts and see invite stats per user.
--
-- Flags (any of these puts a user under the "Suspicious" filter):
--   same_bank_name  another user's linked bank account is in the same full name
--                   (the same person with a second account, or relatives sharing)
--   same_phone      another account has the same phone number
--   blocked_invite  an invite between this user and another was blocked because
--                   both bank accounts are in the same name
--   invite_burst    5 or more friends joined through their link within 24 hours
-- Flags are hints for a person to check, not proof.

CREATE OR REPLACE FUNCTION public.phone_key(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 10), '');
$$;

/** Why a user's account looks like it might be a duplicate. Empty array when nothing stands out. */
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
  )
  SELECT COALESCE(jsonb_agg(f), '[]'::JSONB) FROM (
    SELECT jsonb_build_object('code', 'same_bank_name', 'label', 'Another account has a bank account in the same name', 'other_id', b.user_id) AS f
    FROM me JOIN public.customer_bank_accounts b
      ON b.user_id <> me.id AND me.account_name IS NOT NULL AND public.names_same(me.account_name, b.account_name)
    UNION ALL
    SELECT jsonb_build_object('code', 'same_phone', 'label', 'Same phone number as another account', 'other_id', p.id)
    FROM me JOIN public.profiles p ON p.id <> me.id AND me.phone IS NOT NULL AND public.phone_key(p.phone) = me.phone
    UNION ALL
    SELECT jsonb_build_object('code', 'blocked_invite', 'label', 'An invite with another account was blocked (same name)',
                              'other_id', CASE WHEN r.referrer_id = p_user_id THEN r.referred_id ELSE r.referrer_id END)
    FROM public.customer_referrals r
    WHERE r.status = 'cancelled' AND p_user_id IN (r.referrer_id, r.referred_id)
    UNION ALL
    SELECT jsonb_build_object('code', 'invite_burst', 'label', format('%s friends joined within 24 hours', max(w.cnt)), 'other_id', NULL)
    FROM (
      SELECT count(*) OVER (ORDER BY created_at RANGE BETWEEN interval '24 hours' PRECEDING AND CURRENT ROW) AS cnt
      FROM public.customer_referrals WHERE referrer_id = p_user_id
    ) w
    HAVING max(w.cnt) >= 5
  ) x;
$$;

/** Users list for admins: buyers only, bank account, invite stats and trust flags. */
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
             b.bank_name AS linked_bank_name, b.account_name AS bank_account_name, b.account_last4, b.verified_at AS bank_verified_at
      FROM public.profiles p
      LEFT JOIN public.customer_bank_accounts b ON b.user_id = p.id
      WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role::TEXT IN ('vendor', 'admin'))
        AND (v_search IS NULL OR p.full_name ILIKE '%' || v_search || '%' OR p.email ILIKE '%' || v_search || '%'
             OR p.phone ILIKE '%' || v_search || '%' OR b.account_name ILIKE '%' || v_search || '%')
    ), filtered AS (
      SELECT * FROM base
      WHERE p_role IN ('customer', 'all')
         OR (p_role = 'bank_linked' AND bank_verified_at IS NOT NULL)
         OR (p_role = 'bank_missing' AND bank_verified_at IS NULL)
         OR (p_role = 'suspicious' AND jsonb_array_length(public.user_trust_flags(id)) > 0)
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
        'flags', public.user_trust_flags(pg.id)
      ) ORDER BY pg.sort_at DESC)
      FROM page pg
      LEFT JOIN public.customer_referrals inv ON inv.referred_id = pg.id
      LEFT JOIN public.profiles ip ON ip.id = inv.referrer_id), '[]'::JSONB)
    )
  );
END;
$$;

/** One user's invite picture and trust flags, with names of the other accounts involved. */
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
        'status', r.status, 'joined_at', r.created_at, 'pings', r.ping_count,
        'bank_linked', EXISTS (SELECT 1 FROM public.customer_bank_accounts b WHERE b.user_id = p.id)
      ) ORDER BY r.created_at DESC)
      FROM public.customer_referrals r JOIN public.profiles p ON p.id = r.referred_id
      WHERE r.referrer_id = p_user_id
    ), '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.phone_key(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.user_trust_flags(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_user_trust(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_trust(UUID) TO authenticated;
