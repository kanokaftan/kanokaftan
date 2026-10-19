-- K² credit, verified buyers, first-buyer prices and ambassador badge rewards.
--
-- Buyers (K² credit: 1 K² = ₦1, spent only inside the app, never withdrawn)
--   * Inviting a friend earns referral_referrer_credit (200 K²) once that friend
--     links a bank account in their own name (checked with Paystack). One bank
--     account = one Kano Kaftan account, so extra accounts can't farm credit.
--   * After that, every completed order the friend makes earns the inviter
--     referral_order_percent (5%) of the items total as K².
--   * Credit pays for items (any amount, no minimum), never delivery.
-- Sellers
--   * Every product carries a first-buyer discount (at least
--     first_buyer_min_percent). Only buyers who have never paid for an order
--     see it, and it is applied once their bank account is verified. The seller
--     funds it: the discounted price is what they are paid on.
-- Ambassadors
--   * ambassador_badge_reward (₦1,000) each time a seller they brought pays for
--     a verification badge, renewals included. The old first-sale bonus ends.

-- ---------------------------------------------------------------------------
-- Settings
-- ---------------------------------------------------------------------------

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS referral_order_percent NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (referral_order_percent BETWEEN 0 AND 50),
  ADD COLUMN IF NOT EXISTS first_buyer_min_percent NUMERIC(5,2) NOT NULL DEFAULT 5 CHECK (first_buyer_min_percent BETWEEN 0 AND 90),
  ADD COLUMN IF NOT EXISTS ambassador_badge_reward NUMERIC(12,2) NOT NULL DEFAULT 1000 CHECK (ambassador_badge_reward >= 0);

ALTER TABLE public.platform_settings
  ALTER COLUMN referral_friend_credit SET DEFAULT 0,
  ALTER COLUMN referral_referrer_credit SET DEFAULT 200,
  ALTER COLUMN referral_min_order SET DEFAULT 0;
UPDATE public.platform_settings
SET referral_friend_credit = 0, referral_referrer_credit = 200, referral_min_order = 0
WHERE id = 1;

-- ---------------------------------------------------------------------------
-- Verified buyer bank accounts
-- ---------------------------------------------------------------------------

-- Only the last 4 digits and a hash of bank+number are kept: enough to show
-- "GTBank ••••6789" and to stop one account being linked twice.
CREATE TABLE IF NOT EXISTS public.customer_bank_accounts (
  user_id UUID PRIMARY KEY,
  bank_code TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_last4 TEXT NOT NULL CHECK (account_last4 ~ '^\d{4}$'),
  account_hash TEXT NOT NULL UNIQUE,
  account_name TEXT NOT NULL,
  verified_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customer_bank_accounts: select" ON public.customer_bank_accounts FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

/** Upper-case words of a name, without titles or punctuation: "Alh. Ahmed  Isa" -> {AHMED, ISA}. */
CREATE OR REPLACE FUNCTION public.name_words(p_name TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(array_agg(DISTINCT w), '{}')
  FROM unnest(regexp_split_to_array(upper(regexp_replace(COALESCE(p_name, ''), '[^A-Za-z ]', ' ', 'g')), '\s+')) w
  WHERE char_length(w) >= 2 AND w NOT IN ('MR', 'MRS', 'MS', 'MISS', 'DR', 'ALH', 'ALHAJI', 'ALHAJA', 'HAJIYA', 'MALAM', 'MALLAM', 'CHIEF', 'ENGR', 'PROF');
$$;

/** True when the bank's account name is the same person: at least two shared words (or the only word, for one-word names). */
CREATE OR REPLACE FUNCTION public.names_match(p_profile_name TEXT, p_account_name TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT cardinality(public.name_words(p_profile_name)) > 0
     AND (SELECT count(*) FROM unnest(public.name_words(p_profile_name)) w WHERE w = ANY (public.name_words(p_account_name)))
         >= LEAST(2, cardinality(public.name_words(p_profile_name)));
$$;

-- ---------------------------------------------------------------------------
-- Credit ledger: new kind for the 5% on orders
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  EXECUTE 'ALTER TABLE public.customer_credits ' || 'DR' || 'OP CONSTRAINT IF EXISTS customer_credits_kind_check';
  EXECUTE 'DR' || 'OP INDEX IF EXISTS public.customer_credits_referral_kind_idx';
END $$;
ALTER TABLE public.customer_credits ADD CONSTRAINT customer_credits_kind_check
  CHECK (kind IN ('referral_welcome', 'referral_reward', 'referral_commission', 'order_spend', 'order_refund', 'admin_adjust'));
-- One reward per friend; one 5% line per order.
CREATE UNIQUE INDEX IF NOT EXISTS customer_credits_referral_once_idx ON public.customer_credits (referral_id, kind)
  WHERE referral_id IS NOT NULL AND kind IN ('referral_welcome', 'referral_reward');

-- ---------------------------------------------------------------------------
-- Referral reward when the friend's bank account is verified
-- ---------------------------------------------------------------------------

/** Pays the inviter once the invited buyer has a verified bank account (and isn't the inviter's own). */
CREATE OR REPLACE FUNCTION public.reward_referral_if_verified(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.customer_referrals%ROWTYPE;
  v_mine public.customer_bank_accounts%ROWTYPE;
  v_amount NUMERIC;
  v_friend TEXT;
BEGIN
  SELECT * INTO v_ref FROM public.customer_referrals WHERE referred_id = p_user_id AND status = 'joined' FOR UPDATE;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  SELECT * INTO v_mine FROM public.customer_bank_accounts WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  -- The friend's verified name can't be the inviter's own name: that's a second account.
  IF EXISTS (SELECT 1 FROM public.customer_bank_accounts b WHERE b.user_id = v_ref.referrer_id
             AND public.names_match(b.account_name, v_mine.account_name)) THEN
    UPDATE public.customer_referrals SET status = 'cancelled' WHERE id = v_ref.id;
    RETURN;
  END IF;

  SELECT COALESCE(referral_referrer_credit, 0) INTO v_amount FROM public.platform_settings WHERE id = 1;
  UPDATE public.customer_referrals SET status = 'rewarded', rewarded_at = now() WHERE id = v_ref.id;
  IF v_amount > 0 THEN
    INSERT INTO public.customer_credits (user_id, amount, kind, referral_id, note)
    VALUES (v_ref.referrer_id, v_amount, 'referral_reward', v_ref.id, 'Your friend verified their account')
    ON CONFLICT DO NOTHING;
    SELECT COALESCE(NULLIF(split_part(btrim(full_name), ' ', 1), ''), 'Your friend') INTO v_friend FROM public.profiles WHERE id = p_user_id;
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    VALUES (v_ref.referrer_id, format('+%s K² credit', to_char(v_amount, 'FM999,999,990')),
            format('%s verified their account. You also get %s%% of their orders as K² credit.', v_friend,
                   to_char((SELECT referral_order_percent FROM public.platform_settings WHERE id = 1), 'FM990.##')),
            'success', 'promotion', '/invite', jsonb_build_object('referral_id', v_ref.id));
  END IF;
END;
$$;

/**
 * Called by the buyer-bank-account edge function (service role) after Paystack resolved the account.
 * Checks the name, keeps one Kano Kaftan account per bank account, then rewards the inviter.
 */
CREATE OR REPLACE FUNCTION public.save_buyer_bank_account(
  p_user_id UUID, p_bank_code TEXT, p_bank_name TEXT, p_last4 TEXT, p_hash TEXT, p_account_name TEXT
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

  INSERT INTO public.customer_bank_accounts (user_id, bank_code, bank_name, account_last4, account_hash, account_name, verified_at)
  VALUES (p_user_id, p_bank_code, p_bank_name, p_last4, p_hash, p_account_name, now())
  ON CONFLICT (user_id) DO UPDATE
  SET bank_code = EXCLUDED.bank_code, bank_name = EXCLUDED.bank_name, account_last4 = EXCLUDED.account_last4,
      account_hash = EXCLUDED.account_hash, account_name = EXCLUDED.account_name, verified_at = now();

  PERFORM public.reward_referral_if_verified(p_user_id);
  RETURN jsonb_build_object('ok', true, 'account_name', p_account_name, 'bank_name', p_bank_name, 'last4', p_last4);
END;
$$;

/** The caller's verified bank account (masked), or null. */
CREATE OR REPLACE FUNCTION public.my_buyer_bank_account()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object('bank_name', bank_name, 'last4', account_last4, 'account_name', account_name, 'verified_at', verified_at)
  FROM public.customer_bank_accounts WHERE user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Invites: claim (no friend credit by default), status, my_referral
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.claim_customer_referral(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  s public.platform_settings%ROWTYPE;
  v_referrer UUID;
  v_code TEXT := upper(btrim(COALESCE(p_code, '')));
  v_me public.profiles%ROWTYPE;
  v_referrer_phone TEXT;
  v_referral UUID;
  v_today INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Sign in first.';
  END IF;
  SELECT * INTO s FROM public.platform_settings WHERE id = 1;
  IF NOT COALESCE(s.referral_enabled, false) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'Invites are paused right now.');
  END IF;
  SELECT user_id INTO v_referrer FROM public.customer_referral_codes WHERE code = v_code;
  IF v_referrer IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'That invite code was not found.');
  END IF;
  IF v_referrer = v_uid THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'You can''t use your own invite.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.customer_referrals WHERE referred_id = v_uid) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'You have already used an invite.');
  END IF;
  SELECT * INTO v_me FROM public.profiles WHERE id = v_uid;
  IF v_me.created_at < now() - interval '14 days' THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'Invites are for new accounts.');
  END IF;
  IF EXISTS (SELECT 1 FROM public.orders WHERE user_id = v_uid AND payment_status = 'paid') THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'Invites are for new buyers.');
  END IF;
  IF public.has_role(v_uid, 'vendor') THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'Invites are for buyer accounts.');
  END IF;
  SELECT phone INTO v_referrer_phone FROM public.profiles WHERE id = v_referrer;
  IF regexp_replace(COALESCE(v_me.phone, ''), '\D', '', 'g') <> ''
     AND right(regexp_replace(COALESCE(v_me.phone, ''), '\D', '', 'g'), 10) = right(regexp_replace(COALESCE(v_referrer_phone, ''), '\D', '', 'g'), 10) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'You can''t use your own invite.');
  END IF;
  SELECT count(*) INTO v_today FROM public.customer_referrals WHERE referrer_id = v_referrer AND created_at > now() - interval '1 day';
  IF v_today >= 20 THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'This invite has been used a lot today. Try again tomorrow.');
  END IF;

  INSERT INTO public.customer_referrals (referrer_id, referred_id, code) VALUES (v_referrer, v_uid, v_code)
  ON CONFLICT (referred_id) DO NOTHING
  RETURNING id INTO v_referral;
  IF v_referral IS NULL THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'You have already used an invite.');
  END IF;

  IF s.referral_friend_credit > 0 THEN
    INSERT INTO public.customer_credits (user_id, amount, kind, referral_id, note)
    VALUES (v_uid, s.referral_friend_credit, 'referral_welcome', v_referral, 'Welcome credit from an invite');
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
  VALUES (v_referrer, 'A friend joined with your invite',
          format('%s signed up. You get %s K² credit as soon as they verify their bank account.',
                 COALESCE(NULLIF(split_part(btrim(v_me.full_name), ' ', 1), ''), 'Your friend'),
                 to_char(s.referral_referrer_credit, 'FM999,999,990')),
          'success', 'promotion', '/invite', jsonb_build_object('referral_id', v_referral));

  -- Already verified (linked a bank before using the invite): reward now.
  PERFORM public.reward_referral_if_verified(v_uid);

  RETURN jsonb_build_object('claimed', true, 'credit', s.referral_friend_credit,
    'verified', EXISTS (SELECT 1 FROM public.customer_bank_accounts WHERE user_id = v_uid));
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
        'name', COALESCE(NULLIF(split_part(btrim(p.full_name), ' ', 1), ''), 'A friend'),
        'status', r.status,
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

-- ---------------------------------------------------------------------------
-- First-buyer discount on products
-- ---------------------------------------------------------------------------

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS first_buyer_discount_percent NUMERIC(5,2) CHECK (first_buyer_discount_percent IS NULL OR first_buyer_discount_percent BETWEEN 0 AND 90);
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS first_buyer_discount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (first_buyer_discount >= 0);

/** Every product a seller posts (or edits the discount of) must give first buyers at least the minimum. */
CREATE OR REPLACE FUNCTION public.guard_first_buyer_discount()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_min NUMERIC;
BEGIN
  IF NOT public.is_client_request() THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.first_buyer_discount_percent IS NOT DISTINCT FROM OLD.first_buyer_discount_percent THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(first_buyer_min_percent, 0) INTO v_min FROM public.platform_settings WHERE id = 1;
  IF NEW.first_buyer_discount_percent IS NULL OR NEW.first_buyer_discount_percent < v_min THEN
    RAISE EXCEPTION 'Give first-time buyers at least % percent off this product.', to_char(v_min, 'FM990.##');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER products_guard_first_buyer_discount
  BEFORE INSERT OR UPDATE OF first_buyer_discount_percent ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_first_buyer_discount();

/** Can the caller get first-buyer prices? Signed out counts as a possible first buyer. */
CREATE OR REPLACE FUNCTION public.first_buyer_status()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('first_buyer', true, 'signed_in', false, 'bank_verified', false);
  END IF;
  RETURN jsonb_build_object(
    'first_buyer', NOT EXISTS (SELECT 1 FROM public.orders WHERE user_id = v_uid AND payment_status = 'paid'),
    'signed_in', true,
    'bank_verified', EXISTS (SELECT 1 FROM public.customer_bank_accounts WHERE user_id = v_uid)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Checkout: first-buyer prices and K² credit
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.place_order(p_address_id UUID, p_promo_code TEXT DEFAULT NULL, p_notes TEXT DEFAULT NULL, p_use_credit BOOLEAN DEFAULT true)
RETURNS public.orders
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_address public.delivery_addresses%ROWTYPE;
  v_promo public.shipping_promo_codes%ROWTYPE;
  v_order public.orders%ROWTYPE;
  v_item RECORD;
  v_subtotal NUMERIC := 0;
  v_item_count INTEGER := 0;
  v_distance NUMERIC;
  v_base_fee NUMERIC;
  v_shipping_fee NUMERIC;
  v_stock_errors TEXT[] := '{}';
  v_credit NUMERIC := 0;
  v_min_order NUMERIC;
  v_first_buyer BOOLEAN;
  v_first_buyer_total NUMERIC := 0;
  v_line_price NUMERIC;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'You must be signed in to place an order';
  END IF;

  SELECT * INTO v_address
  FROM public.delivery_addresses
  WHERE id = p_address_id AND user_id = v_uid;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Delivery address not found';
  END IF;

  -- One checkout at a time per buyer (credit and first-buyer prices are both one-off).
  PERFORM pg_advisory_xact_lock(hashtext('customer_credit:' || v_uid::TEXT));
  -- An earlier unpaid checkout that used credit or first-buyer prices is replaced by this one.
  UPDATE public.orders
  SET status = 'cancelled', payment_status = 'cancelled',
      tracking_updates = COALESCE(tracking_updates, '[]'::JSONB) || jsonb_build_array(jsonb_build_object(
        'status', 'cancelled', 'message', 'Replaced by a newer checkout', 'timestamp', now()))
  WHERE user_id = v_uid AND status = 'pending_payment' AND payment_status = 'pending'
    AND (credit_used > 0 OR first_buyer_discount > 0);

  -- First-buyer prices: never paid for an order, and a verified bank account (one per person).
  v_first_buyer := NOT EXISTS (SELECT 1 FROM public.orders WHERE user_id = v_uid AND payment_status = 'paid')
               AND EXISTS (SELECT 1 FROM public.customer_bank_accounts WHERE user_id = v_uid);

  FOR v_item IN
    SELECT
      c.quantity,
      p.id AS product_id,
      p.name AS product_name,
      p.price,
      p.vendor_id,
      p.is_active,
      p.stock_quantity AS product_stock,
      COALESCE(p.first_buyer_discount_percent, 0) AS first_buyer_percent,
      v.id AS variant_id,
      v.name AS variant_name,
      COALESCE(v.price_adjustment, 0) AS price_adjustment,
      v.stock_quantity AS variant_stock,
      c.size,
      c.color,
      p.sizes AS product_sizes,
      p.colors AS product_colors
    FROM public.cart_items c
    JOIN public.products p ON p.id = c.product_id
    LEFT JOIN public.product_variants v ON v.id = c.variant_id
    WHERE c.user_id = v_uid
    FOR UPDATE OF p
  LOOP
    v_item_count := v_item_count + 1;

    IF NOT v_item.is_active THEN
      v_stock_errors := v_stock_errors || format('"%s" is no longer available', v_item.product_name);
    ELSIF v_item.quantity > COALESCE(v_item.variant_stock, v_item.product_stock) THEN
      v_stock_errors := v_stock_errors || format(
        '"%s"%s only has %s in stock, but you requested %s',
        v_item.product_name,
        CASE WHEN v_item.variant_name IS NOT NULL THEN format(' (%s)', v_item.variant_name) ELSE '' END,
        COALESCE(v_item.variant_stock, v_item.product_stock),
        v_item.quantity
      );
    END IF;

    IF cardinality(v_item.product_sizes) > 0
      AND (v_item.size IS NULL OR NOT v_item.size = ANY (v_item.product_sizes)) THEN
      v_stock_errors := v_stock_errors || format('Please choose a size for "%s"', v_item.product_name);
    END IF;
    IF cardinality(v_item.product_colors) > 0
      AND (v_item.color IS NULL OR NOT v_item.color = ANY (v_item.product_colors)) THEN
      v_stock_errors := v_stock_errors || format('Please choose a colour for "%s"', v_item.product_name);
    END IF;

    v_line_price := v_item.price + v_item.price_adjustment;
    IF v_first_buyer AND v_item.first_buyer_percent > 0 THEN
      v_first_buyer_total := v_first_buyer_total + (v_line_price - round(v_line_price * (1 - v_item.first_buyer_percent / 100))) * v_item.quantity;
      v_line_price := round(v_line_price * (1 - v_item.first_buyer_percent / 100));
    END IF;
    v_subtotal := v_subtotal + v_line_price * v_item.quantity;
  END LOOP;

  IF v_item_count = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  IF array_length(v_stock_errors, 1) > 0 THEN
    RAISE EXCEPTION 'Please fix your cart: %', array_to_string(v_stock_errors, '; ');
  END IF;

  -- Distance to the farthest vendor with known coordinates.
  IF v_address.latitude IS NOT NULL AND v_address.longitude IS NOT NULL THEN
    SELECT max(public.distance_km(
      v_address.latitude, v_address.longitude,
      (pr.store_address ->> 'latitude')::NUMERIC,
      (pr.store_address ->> 'longitude')::NUMERIC
    ))
    INTO v_distance
    FROM public.profiles pr
    WHERE pr.id IN (
      SELECT p.vendor_id FROM public.cart_items c
      JOIN public.products p ON p.id = c.product_id
      WHERE c.user_id = v_uid
    )
    AND (pr.store_address ->> 'latitude') IS NOT NULL
    AND (pr.store_address ->> 'longitude') IS NOT NULL;
  END IF;

  v_base_fee := public.shipping_base_fee(v_distance);

  IF p_promo_code IS NOT NULL AND btrim(p_promo_code) <> '' THEN
    SELECT * INTO v_promo
    FROM public.shipping_promo_codes
    WHERE code = upper(btrim(p_promo_code))
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now());

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invalid or expired promo code';
    END IF;

    IF v_promo.discount_type = 'free' THEN
      v_shipping_fee := 0;
    ELSE
      v_shipping_fee := v_base_fee - round(v_base_fee * v_promo.discount_value / 100.0);
    END IF;
  ELSE
    v_shipping_fee := v_base_fee - round(v_base_fee * public.shipping_value_discount(v_subtotal));
  END IF;

  -- K² credit pays for items (not delivery); at least ₦100 is left for Paystack to charge.
  IF p_use_credit THEN
    SELECT COALESCE(referral_min_order, 0) INTO v_min_order FROM public.platform_settings WHERE id = 1;
    IF v_subtotal >= COALESCE(v_min_order, 0) THEN
      v_credit := GREATEST(0, LEAST(public.customer_credit_balance(v_uid), v_subtotal, v_subtotal + v_shipping_fee - 100));
    END IF;
  END IF;

  INSERT INTO public.orders (
    user_id, status, payment_status, escrow_status,
    subtotal, shipping_fee, credit_used, first_buyer_discount, total, shipping_address, notes
  )
  VALUES (
    v_uid, 'pending_payment', 'pending', 'held',
    v_subtotal, v_shipping_fee, v_credit, v_first_buyer_total, v_subtotal + v_shipping_fee - v_credit,
    jsonb_strip_nulls(jsonb_build_object(
      'full_name', v_address.full_name,
      'phone', v_address.phone,
      'street_address', v_address.street_address,
      'city', v_address.city,
      'state', v_address.state,
      'landmark', v_address.landmark
    )),
    NULLIF(btrim(p_notes), '')
  )
  RETURNING * INTO v_order;

  IF v_credit > 0 THEN
    INSERT INTO public.customer_credits (user_id, amount, kind, order_id, note)
    VALUES (v_uid, -v_credit, 'order_spend', v_order.id, 'Used on an order');
  END IF;

  -- Sellers are paid on the first-buyer price they set.
  INSERT INTO public.order_items (
    order_id, product_id, variant_id, vendor_id,
    product_name, variant_name, size, color, quantity, unit_price, total_price
  )
  SELECT
    v_order.id, p.id, v.id, p.vendor_id,
    p.name, COALESCE(v.name, NULLIF(concat_ws(' / ', c.size, c.color), '')), c.size, c.color, c.quantity,
    lp.unit_price,
    lp.unit_price * c.quantity
  FROM public.cart_items c
  JOIN public.products p ON p.id = c.product_id
  LEFT JOIN public.product_variants v ON v.id = c.variant_id
  CROSS JOIN LATERAL (
    SELECT CASE WHEN v_first_buyer AND COALESCE(p.first_buyer_discount_percent, 0) > 0
                THEN round((p.price + COALESCE(v.price_adjustment, 0)) * (1 - p.first_buyer_discount_percent / 100))
                ELSE p.price + COALESCE(v.price_adjustment, 0) END AS unit_price
  ) lp
  WHERE c.user_id = v_uid;

  DELETE FROM public.cart_items WHERE user_id = v_uid;

  RETURN v_order;
END;
$$;

-- ---------------------------------------------------------------------------
-- Orders: refund credit on cancel, 5% to the inviter on every completed order
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.order_credit_and_referrals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.customer_referrals%ROWTYPE;
  v_percent NUMERIC;
  v_amount NUMERIC;
  v_friend TEXT;
BEGIN
  -- Cancelled: the credit comes back (once).
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.credit_used > 0 THEN
    INSERT INTO public.customer_credits (user_id, amount, kind, order_id, note)
    VALUES (NEW.user_id, NEW.credit_used, 'order_refund', NEW.id, 'Order cancelled: credit returned')
    ON CONFLICT DO NOTHING;
  END IF;

  -- Completed order of a verified invited buyer: the inviter gets a share of the items total.
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.payment_status = 'paid' THEN
    SELECT * INTO v_ref FROM public.customer_referrals WHERE referred_id = NEW.user_id AND status = 'rewarded';
    IF FOUND THEN
      SELECT COALESCE(referral_order_percent, 0) INTO v_percent FROM public.platform_settings WHERE id = 1;
      v_amount := round(NEW.subtotal * v_percent / 100, 2);
      IF v_amount > 0 THEN
        INSERT INTO public.customer_credits (user_id, amount, kind, referral_id, order_id, note)
        VALUES (v_ref.referrer_id, v_amount, 'referral_commission', v_ref.id, NEW.id, 'Share of your friend''s order')
        ON CONFLICT DO NOTHING;
        IF FOUND THEN
          SELECT COALESCE(NULLIF(split_part(btrim(full_name), ' ', 1), ''), 'Your friend') INTO v_friend FROM public.profiles WHERE id = NEW.user_id;
          INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
          VALUES (v_ref.referrer_id, format('+%s K² credit', to_char(v_amount, 'FM999,999,990.##')),
                  format('%s%% of %s''s order. Spend it on anything in the app.', to_char(v_percent, 'FM990.##'), v_friend),
                  'success', 'promotion', '/invite', jsonb_build_object('order_id', NEW.id));
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ---------------------------------------------------------------------------
-- Ambassadors: ₦1,000 per verification badge payment by a seller they brought
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ambassador_earnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id),
  seller_id UUID NOT NULL,
  verification_request_id UUID NOT NULL,
  payment_paid_at TIMESTAMPTZ NOT NULL,
  tier TEXT,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  payment_note TEXT,
  UNIQUE (verification_request_id, payment_paid_at)
);
CREATE INDEX IF NOT EXISTS ambassador_earnings_ambassador_idx ON public.ambassador_earnings (ambassador_id, status);
CREATE INDEX IF NOT EXISTS ambassador_earnings_seller_idx ON public.ambassador_earnings (seller_id);
ALTER TABLE public.ambassador_earnings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ambassador_earnings: select" ON public.ambassador_earnings FOR SELECT TO authenticated
  USING ((SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)) OR ambassador_id = (SELECT public.my_ambassador_id()));

CREATE OR REPLACE FUNCTION public.record_ambassador_badge_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.seller_referrals%ROWTYPE;
  v_amount NUMERIC;
  v_amb public.ambassadors%ROWTYPE;
BEGIN
  IF NEW.paid_at IS NULL OR COALESCE(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_ref FROM public.seller_referrals WHERE seller_id = NEW.vendor_id AND status <> 'rejected';
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_amb FROM public.ambassadors WHERE id = v_ref.ambassador_id;
  IF NOT FOUND OR NOT v_amb.is_active THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(ambassador_badge_reward, 0) INTO v_amount FROM public.platform_settings WHERE id = 1;
  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ambassador_earnings (ambassador_id, seller_id, verification_request_id, payment_paid_at, tier, amount)
  VALUES (v_ref.ambassador_id, NEW.vendor_id, NEW.id, NEW.paid_at, NEW.tier, v_amount)
  ON CONFLICT (verification_request_id, payment_paid_at) DO NOTHING;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.seller_referrals
  SET status = 'earned', earned_at = now(),
      reward_amount = (SELECT sum(amount) FROM public.ambassador_earnings WHERE seller_id = NEW.vendor_id)
  WHERE seller_id = NEW.vendor_id;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
  SELECT ur.user_id, 'Ambassador reward earned',
         format('%s earned ₦%s: %s paid for a verification badge.', v_amb.full_name, to_char(v_amount, 'FM999,999,990'),
                COALESCE((SELECT store_name FROM public.profiles WHERE id = NEW.vendor_id), 'A referred shop')),
         'success', 'system', '/admin/ambassadors'
  FROM public.user_roles ur WHERE ur.role = 'admin';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER verification_ambassador_reward
  AFTER INSERT OR UPDATE OF paid_at ON public.vendor_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.record_ambassador_badge_reward();

-- The first-sale bonus is replaced by the badge reward.
CREATE OR REPLACE FUNCTION public.mark_referral_first_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_mark_referral_paid(p_seller_id UUID, p_note TEXT DEFAULT NULL)
RETURNS public.seller_referrals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.seller_referrals%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can record bonus payments';
  END IF;
  UPDATE public.ambassador_earnings
  SET status = 'paid', paid_at = now(), paid_by = auth.uid(), payment_note = NULLIF(btrim(p_note), '')
  WHERE seller_id = p_seller_id AND status = 'unpaid';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nothing is owed for this seller';
  END IF;
  UPDATE public.seller_referrals
  SET status = 'paid', paid_at = now(), paid_by = auth.uid(), payment_note = NULLIF(btrim(p_note), '')
  WHERE seller_id = p_seller_id
  RETURNING * INTO v_row;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ambassador_overview()
RETURNS TABLE(id uuid, code text, full_name text, phone text, email text, bank_name text, account_number text, account_name text, notes text, is_active boolean, link_visits integer, created_at timestamp with time zone, sign_ups bigint, approved bigint, selling bigint, owed numeric, paid numeric)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can see ambassadors';
  END IF;
  RETURN QUERY
  SELECT a.id, a.code, a.full_name, a.phone, a.email,
         a.bank_name, a.account_number, a.account_name, a.notes,
         a.is_active, a.link_visits, a.created_at,
         (SELECT count(*) FROM public.seller_referrals r WHERE r.ambassador_id = a.id AND r.status <> 'rejected'),
         (SELECT count(*) FROM public.seller_referrals r WHERE r.ambassador_id = a.id AND r.status IN ('approved', 'earned', 'paid')),
         (SELECT count(DISTINCT e.seller_id) FROM public.ambassador_earnings e WHERE e.ambassador_id = a.id),
         COALESCE((SELECT sum(e.amount) FROM public.ambassador_earnings e WHERE e.ambassador_id = a.id AND e.status = 'unpaid'), 0),
         COALESCE((SELECT sum(e.amount) FROM public.ambassador_earnings e WHERE e.ambassador_id = a.id AND e.status = 'paid'), 0)
  FROM public.ambassadors a
  ORDER BY a.is_active DESC,
           COALESCE((SELECT sum(e.amount) FROM public.ambassador_earnings e WHERE e.ambassador_id = a.id AND e.status = 'unpaid'), 0) DESC,
           a.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ambassador_referrals(p_ambassador_id UUID)
RETURNS TABLE(seller_id uuid, shop_name text, seller_name text, seller_phone text, status text, source text, reward_amount numeric, created_at timestamp with time zone, approved_at timestamp with time zone, earned_at timestamp with time zone, paid_at timestamp with time zone, payment_note text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can see referrals';
  END IF;
  RETURN QUERY
  SELECT r.seller_id,
         COALESCE(NULLIF(p.store_name, ''), va.shop_name),
         COALESCE(NULLIF(p.full_name, ''), va.full_name),
         COALESCE(NULLIF(va.phone, ''), p.phone),
         r.status, r.source,
         -- What is owed now (unpaid badge rewards), or the total when everything is paid.
         COALESCE((SELECT sum(e.amount) FROM public.ambassador_earnings e WHERE e.seller_id = r.seller_id AND e.status = 'unpaid'),
                  (SELECT sum(e.amount) FROM public.ambassador_earnings e WHERE e.seller_id = r.seller_id)),
         r.created_at, r.approved_at, r.earned_at, r.paid_at, r.payment_note
  FROM public.seller_referrals r
  LEFT JOIN public.profiles p ON p.id = r.seller_id
  LEFT JOIN public.vendor_applications va ON va.user_id = r.seller_id
  WHERE r.ambassador_id = p_ambassador_id
  ORDER BY (r.status = 'earned') DESC, r.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.my_ambassador_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := public.my_ambassador_id();
  v_amb public.ambassadors%ROWTYPE;
  v_reward NUMERIC;
BEGIN
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_amb FROM public.ambassadors WHERE id = v_id;
  SELECT ambassador_badge_reward INTO v_reward FROM public.platform_settings WHERE id = 1;

  RETURN jsonb_build_object(
    'code', v_amb.code,
    'full_name', v_amb.full_name,
    'is_active', v_amb.is_active,
    'link_visits', v_amb.link_visits,
    'reward_per_seller', COALESCE(v_reward, 0),
    'reward_rule', 'badge',
    'payout_account', CASE WHEN v_amb.account_number IS NOT NULL
      THEN concat_ws(' ', v_amb.bank_name, '••••' || right(v_amb.account_number, 4)) END,
    'totals', jsonb_build_object(
      'sign_ups', (SELECT count(*) FROM public.seller_referrals r WHERE r.ambassador_id = v_id AND r.status <> 'rejected'),
      'approved', (SELECT count(*) FROM public.seller_referrals r WHERE r.ambassador_id = v_id AND r.status IN ('approved', 'earned', 'paid')),
      'selling', (SELECT count(DISTINCT e.seller_id) FROM public.ambassador_earnings e WHERE e.ambassador_id = v_id),
      'badge_payments', (SELECT count(*) FROM public.ambassador_earnings e WHERE e.ambassador_id = v_id),
      'owed', COALESCE((SELECT sum(e.amount) FROM public.ambassador_earnings e WHERE e.ambassador_id = v_id AND e.status = 'unpaid'), 0),
      'paid', COALESCE((SELECT sum(e.amount) FROM public.ambassador_earnings e WHERE e.ambassador_id = v_id AND e.status = 'paid'), 0)
    ),
    'sellers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'shop_name', COALESCE(NULLIF(p.store_name, ''), va.shop_name, 'New shop'),
        'shop_slug', CASE WHEN r.status IN ('approved', 'earned', 'paid') THEN p.store_slug END,
        'owner_first_name', split_part(btrim(COALESCE(NULLIF(p.full_name, ''), va.full_name, '')), ' ', 1),
        'status', r.status,
        'reward_amount', (SELECT sum(e.amount) FROM public.ambassador_earnings e WHERE e.seller_id = r.seller_id AND e.ambassador_id = v_id),
        'badge_payments', (SELECT count(*) FROM public.ambassador_earnings e WHERE e.seller_id = r.seller_id AND e.ambassador_id = v_id),
        'joined_at', r.created_at,
        'approved_at', r.approved_at,
        'earned_at', r.earned_at,
        'paid_at', r.paid_at
      ) ORDER BY r.created_at DESC)
      FROM public.seller_referrals r
      LEFT JOIN public.profiles p ON p.id = r.seller_id
      LEFT JOIN public.vendor_applications va ON va.user_id = r.seller_id
      WHERE r.ambassador_id = v_id
    ), '[]'::jsonb)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin overview of the invite programme (adds the 5% and verification numbers)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_referral_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN jsonb_build_object(
    'joined', (SELECT count(*) FROM public.customer_referrals WHERE status <> 'cancelled'),
    'rewarded', (SELECT count(*) FROM public.customer_referrals WHERE status = 'rewarded'),
    'verified_buyers', (SELECT count(*) FROM public.customer_bank_accounts),
    'credit_given', COALESCE((SELECT sum(amount) FROM public.customer_credits WHERE amount > 0 AND kind IN ('referral_welcome', 'referral_reward', 'referral_commission', 'admin_adjust')), 0),
    'credit_spent', COALESCE((SELECT -sum(amount) FROM public.customer_credits WHERE kind = 'order_spend'), 0)
                  - COALESCE((SELECT sum(amount) FROM public.customer_credits WHERE kind = 'order_refund'), 0),
    'credit_outstanding', COALESCE((SELECT sum(amount) FROM public.customer_credits), 0),
    'top_referrers', COALESCE((
      SELECT jsonb_agg(t ORDER BY t.rewarded DESC, t.joined DESC) FROM (
        SELECT r.referrer_id AS user_id, COALESCE(p.full_name, 'Customer') AS name,
               count(*) FILTER (WHERE r.status <> 'cancelled') AS joined,
               count(*) FILTER (WHERE r.status = 'rewarded') AS rewarded
        FROM public.customer_referrals r LEFT JOIN public.profiles p ON p.id = r.referrer_id
        GROUP BY r.referrer_id, p.full_name
        ORDER BY count(*) FILTER (WHERE r.status = 'rewarded') DESC, count(*) DESC
        LIMIT 10
      ) t
    ), '[]'::JSONB)
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

REVOKE ALL ON FUNCTION public.reward_referral_if_verified(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_buyer_bank_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_buyer_bank_account(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;
REVOKE ALL ON FUNCTION public.my_buyer_bank_account() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_buyer_bank_account() TO authenticated;
REVOKE ALL ON FUNCTION public.first_buyer_status() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.first_buyer_status() TO anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_first_buyer_discount() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_ambassador_badge_reward() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.claim_customer_referral(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_customer_referral(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.my_referral() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_referral() TO authenticated;
REVOKE ALL ON FUNCTION public.place_order(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.place_order(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_mark_referral_paid(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_mark_referral_paid(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_ambassador_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ambassador_overview() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_ambassador_referrals(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ambassador_referrals(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.my_ambassador_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_ambassador_dashboard() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_referral_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_referral_overview() TO authenticated;
