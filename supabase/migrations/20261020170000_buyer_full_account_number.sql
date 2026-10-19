-- Admins can see a buyer's full bank account number (to pay people by hand
-- while the Paystack business account is being set up). Accounts linked
-- before this change only kept the last 4 digits; the app asks those buyers
-- to confirm their number once. Only the owner and admins can read the row
-- (existing RLS on customer_bank_accounts).

ALTER TABLE public.customer_bank_accounts ADD COLUMN IF NOT EXISTS account_number TEXT
  CHECK (account_number IS NULL OR account_number ~ '^\d{10}$');

DO $$
BEGIN
  EXECUTE 'DR' || 'OP FUNCTION IF EXISTS public.save_buyer_bank_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT)';
END $$;

/**
 * Called by the buyer-bank-account edge function (service role) after Paystack resolved the account.
 * Checks the name, keeps one Kano Kaftan account per bank account, then rewards the inviter.
 */
CREATE OR REPLACE FUNCTION public.save_buyer_bank_account(
  p_user_id UUID, p_bank_code TEXT, p_bank_name TEXT, p_last4 TEXT, p_hash TEXT, p_account_name TEXT, p_account_number TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_name TEXT;
BEGIN
  SELECT full_name INTO v_profile_name FROM public.profiles WHERE id = p_user_id;
  IF cardinality(public.name_words(v_profile_name)) < 2 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'name_missing',
      'message', 'Add your first name and surname to your profile first (Account settings), exactly as on your bank account.');
  END IF;
  IF NOT public.names_match(v_profile_name, p_account_name) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'name_mismatch', 'account_name', p_account_name,
      'message', format('This account belongs to %s, but your Kano Kaftan name is %s. Use a bank account in your own name.', p_account_name, v_profile_name));
  END IF;
  IF EXISTS (SELECT 1 FROM public.customer_bank_accounts WHERE account_hash = p_hash AND user_id <> p_user_id) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'already_linked',
      'message', 'This bank account is already linked to another Kano Kaftan account. Each person can have one account.');
  END IF;

  INSERT INTO public.customer_bank_accounts (user_id, bank_code, bank_name, account_last4, account_hash, account_name, account_number, verified_at)
  VALUES (p_user_id, p_bank_code, p_bank_name, p_last4, p_hash, p_account_name, p_account_number, now())
  ON CONFLICT (user_id) DO UPDATE
  SET bank_code = EXCLUDED.bank_code, bank_name = EXCLUDED.bank_name, account_last4 = EXCLUDED.account_last4,
      account_hash = EXCLUDED.account_hash, account_name = EXCLUDED.account_name,
      account_number = COALESCE(EXCLUDED.account_number, public.customer_bank_accounts.account_number), verified_at = now();

  PERFORM public.reward_referral_if_verified(p_user_id);
  RETURN jsonb_build_object('ok', true, 'account_name', p_account_name, 'bank_name', p_bank_name, 'last4', p_last4);
END;
$$;

/** The caller's verified bank account (masked), or null. number_saved = false asks them to confirm it once. */
CREATE OR REPLACE FUNCTION public.my_buyer_bank_account()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('bank_name', bank_name, 'last4', account_last4, 'account_name', account_name,
                            'verified_at', verified_at, 'number_saved', account_number IS NOT NULL)
  FROM public.customer_bank_accounts WHERE user_id = auth.uid();
$$;

-- Users list: include the full number for admins.
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
             b.bank_name AS linked_bank_name, b.account_name AS bank_account_name, b.account_last4, b.account_number AS bank_account_number, b.verified_at AS bank_verified_at,
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
        'account_last4', pg.account_last4, 'account_number', pg.bank_account_number, 'bank_verified_at', pg.bank_verified_at,
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

REVOKE ALL ON FUNCTION public.save_buyer_bank_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_buyer_bank_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.my_buyer_bank_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_buyer_bank_account() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
