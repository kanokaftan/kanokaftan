-- Customer referral programme ("Invite friends").
--
-- Every customer gets a personal code (kanokaftan.shop/invite/CODE).
-- - The friend who signs up with it gets a welcome credit.
-- - The inviter gets a reward credit when that friend's FIRST order is
--   completed (delivered and not disputed), so fake sign-ups earn nothing.
-- Credit is Kano Kaftan money: it lowers what the buyer pays at checkout,
-- never what sellers are paid. It only applies to orders whose items total
-- at least the minimum, never covers delivery, and comes back if the order
-- is cancelled. Amounts and the on/off switch live in platform_settings.

-- ---------------------------------------------------------------------------
-- Settings and order column
-- ---------------------------------------------------------------------------

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS referral_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS referral_friend_credit NUMERIC(12,2) NOT NULL DEFAULT 1000 CHECK (referral_friend_credit >= 0),
  ADD COLUMN IF NOT EXISTS referral_referrer_credit NUMERIC(12,2) NOT NULL DEFAULT 1000 CHECK (referral_referrer_credit >= 0),
  ADD COLUMN IF NOT EXISTS referral_min_order NUMERIC(12,2) NOT NULL DEFAULT 5000 CHECK (referral_min_order >= 0);

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS credit_used NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit_used >= 0);

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.customer_referral_codes (
  user_id UUID PRIMARY KEY,
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{4,12}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.customer_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL,
  referred_id UUID NOT NULL UNIQUE,
  code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'joined' CHECK (status IN ('joined', 'rewarded', 'cancelled')),
  first_order_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  rewarded_at TIMESTAMPTZ,
  CHECK (referrer_id <> referred_id)
);
CREATE INDEX IF NOT EXISTS customer_referrals_referrer_idx ON public.customer_referrals (referrer_id, created_at DESC);

-- Credit ledger: the balance is the sum of a customer's lines.
CREATE TABLE IF NOT EXISTS public.customer_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  amount NUMERIC(12,2) NOT NULL CHECK (amount <> 0),
  kind TEXT NOT NULL CHECK (kind IN ('referral_welcome', 'referral_reward', 'order_spend', 'order_refund', 'admin_adjust')),
  order_id UUID,
  referral_id UUID REFERENCES public.customer_referrals(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customer_credits_user_idx ON public.customer_credits (user_id, created_at DESC);
-- One spend and one refund per order, one welcome and one reward per referral.
CREATE UNIQUE INDEX IF NOT EXISTS customer_credits_order_kind_idx ON public.customer_credits (order_id, kind) WHERE order_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS customer_credits_referral_kind_idx ON public.customer_credits (referral_id, kind) WHERE referral_id IS NOT NULL;

ALTER TABLE public.customer_referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_credits ENABLE ROW LEVEL SECURITY;

-- Read your own rows; all writes go through the functions below.
CREATE POLICY "customer_referral_codes: select" ON public.customer_referral_codes FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));
CREATE POLICY "customer_referrals: select" ON public.customer_referrals FOR SELECT TO authenticated
  USING (referrer_id = (SELECT auth.uid()) OR referred_id = (SELECT auth.uid()) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));
CREATE POLICY "customer_credits: select" ON public.customer_credits FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_role((SELECT auth.uid()), 'admin'::app_role)));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.customer_credit_balance(p_user_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(sum(amount), 0) FROM public.customer_credits WHERE user_id = p_user_id;
$$;

/** The caller's code, created the first time: up to 5 letters of their first name + 3 digits. */
CREATE OR REPLACE FUNCTION public.ensure_referral_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code TEXT;
  v_base TEXT;
  v_try INTEGER := 0;
BEGIN
  SELECT code INTO v_code FROM public.customer_referral_codes WHERE user_id = p_user_id;
  IF v_code IS NOT NULL THEN
    RETURN v_code;
  END IF;

  SELECT left(regexp_replace(upper(split_part(COALESCE(full_name, ''), ' ', 1)), '[^A-Z]', '', 'g'), 5)
    INTO v_base FROM public.profiles WHERE id = p_user_id;
  IF COALESCE(char_length(v_base), 0) < 2 THEN
    v_base := 'KK';
  END IF;

  LOOP
    v_try := v_try + 1;
    v_code := CASE WHEN v_try <= 20
      THEN v_base || lpad((floor(random() * 1000))::INT::TEXT, 3, '0')
      ELSE upper(substr(md5(gen_random_uuid()::TEXT), 1, 8)) END;
    BEGIN
      INSERT INTO public.customer_referral_codes (user_id, code) VALUES (p_user_id, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      -- Someone else has this code (or a parallel call just made ours).
      SELECT code INTO v_code FROM public.customer_referral_codes WHERE user_id = p_user_id;
      IF v_code IS NOT NULL THEN
        RETURN v_code;
      END IF;
      IF v_try > 40 THEN
        RAISE EXCEPTION 'Could not create an invite code. Please try again.';
      END IF;
    END;
  END LOOP;
END;
$$;

-- ---------------------------------------------------------------------------
-- Customer functions
-- ---------------------------------------------------------------------------

/** Everything the "Invite friends" page shows. */
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
    'min_order', COALESCE(s.referral_min_order, 0),
    'balance', public.customer_credit_balance(v_uid),
    'joined', (SELECT count(*) FROM public.customer_referrals WHERE referrer_id = v_uid AND status <> 'cancelled'),
    'rewarded', (SELECT count(*) FROM public.customer_referrals WHERE referrer_id = v_uid AND status = 'rewarded'),
    'earned', COALESCE((SELECT sum(amount) FROM public.customer_credits WHERE user_id = v_uid AND kind = 'referral_reward'), 0),
    'friends', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'name', COALESCE(NULLIF(split_part(btrim(p.full_name), ' ', 1), ''), 'A friend'),
        'status', r.status,
        'joined_at', r.created_at,
        'rewarded_at', r.rewarded_at
      ) ORDER BY r.created_at DESC)
      FROM (SELECT * FROM public.customer_referrals WHERE referrer_id = v_uid ORDER BY created_at DESC LIMIT 50) r
      LEFT JOIN public.profiles p ON p.id = r.referred_id
    ), '[]'::JSONB),
    'history', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('amount', c.amount, 'kind', c.kind, 'order_id', c.order_id, 'created_at', c.created_at) ORDER BY c.created_at DESC)
      FROM (SELECT * FROM public.customer_credits WHERE user_id = v_uid ORDER BY created_at DESC LIMIT 30) c
    ), '[]'::JSONB)
  );
END;
$$;

/** Credit available at checkout. */
CREATE OR REPLACE FUNCTION public.my_credit()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('balance', 0, 'min_order', 0);
  END IF;
  RETURN jsonb_build_object(
    'balance', public.customer_credit_balance(auth.uid()),
    'min_order', COALESCE((SELECT referral_min_order FROM public.platform_settings WHERE id = 1), 0)
  );
END;
$$;

/** For the sign-up banner: who invited you and what you get (first name only). */
CREATE OR REPLACE FUNCTION public.referral_invite(p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.platform_settings%ROWTYPE;
  v_name TEXT;
BEGIN
  SELECT * INTO s FROM public.platform_settings WHERE id = 1;
  IF NOT COALESCE(s.referral_enabled, false) THEN
    RETURN jsonb_build_object('valid', false);
  END IF;
  SELECT COALESCE(NULLIF(split_part(btrim(p.full_name), ' ', 1), ''), 'A friend') INTO v_name
  FROM public.customer_referral_codes c
  LEFT JOIN public.profiles p ON p.id = c.user_id
  WHERE c.code = upper(btrim(COALESCE(p_code, '')));
  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false);
  END IF;
  RETURN jsonb_build_object('valid', true, 'inviter', v_name, 'friend_credit', s.referral_friend_credit, 'min_order', s.referral_min_order);
END;
$$;

/**
 * Called right after a new customer signs in with an invite code saved on their phone.
 * Only new accounts (14 days) with no paid order, one invite each, never your own.
 */
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
    RETURN jsonb_build_object('claimed', false, 'reason', 'Invites are for your first order.');
  END IF;
  IF public.has_role(v_uid, 'vendor') THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'Invites are for customer accounts.');
  END IF;
  SELECT phone INTO v_referrer_phone FROM public.profiles WHERE id = v_referrer;
  IF regexp_replace(COALESCE(v_me.phone, ''), '\D', '', 'g') <> ''
     AND right(regexp_replace(COALESCE(v_me.phone, ''), '\D', '', 'g'), 10) = right(regexp_replace(COALESCE(v_referrer_phone, ''), '\D', '', 'g'), 10) THEN
    RETURN jsonb_build_object('claimed', false, 'reason', 'You can''t use your own invite.');
  END IF;

  -- A link posted somewhere public can't hand out unlimited credit in a day.
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
          format('%s signed up. You get ₦%s credit when their first order of ₦%s+ is completed.',
                 COALESCE(NULLIF(split_part(btrim(v_me.full_name), ' ', 1), ''), 'Your friend'),
                 to_char(s.referral_referrer_credit, 'FM999,999,990'), to_char(s.referral_min_order, 'FM999,999,990')),
          'success', 'promotion', '/invite', jsonb_build_object('referral_id', v_referral));

  RETURN jsonb_build_object('claimed', true, 'credit', s.referral_friend_credit, 'min_order', s.referral_min_order);
END;
$$;

-- ---------------------------------------------------------------------------
-- Checkout: place_order spends credit
-- ---------------------------------------------------------------------------

DROP FUNCTION IF EXISTS public.place_order(UUID, TEXT, TEXT);

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

  FOR v_item IN
    SELECT
      c.quantity,
      p.id AS product_id,
      p.name AS product_name,
      p.price,
      p.vendor_id,
      p.is_active,
      p.stock_quantity AS product_stock,
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

    v_subtotal := v_subtotal + (v_item.price + v_item.price_adjustment) * v_item.quantity;
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

  -- Kano Kaftan credit: one checkout at a time per customer, items only, at least ₦100 left to pay.
  IF p_use_credit THEN
    PERFORM pg_advisory_xact_lock(hashtext('customer_credit:' || v_uid::TEXT));
    -- An earlier checkout that used credit but was never paid gives it back (it is replaced by this one).
    UPDATE public.orders
    SET status = 'cancelled', payment_status = 'cancelled',
        tracking_updates = COALESCE(tracking_updates, '[]'::JSONB) || jsonb_build_array(jsonb_build_object(
          'status', 'cancelled', 'message', 'Replaced by a newer checkout', 'timestamp', now()))
    WHERE user_id = v_uid AND status = 'pending_payment' AND payment_status = 'pending' AND credit_used > 0;
    SELECT COALESCE(referral_min_order, 0) INTO v_min_order FROM public.platform_settings WHERE id = 1;
    IF v_subtotal >= COALESCE(v_min_order, 0) THEN
      v_credit := GREATEST(0, LEAST(public.customer_credit_balance(v_uid), v_subtotal, v_subtotal + v_shipping_fee - 100));
    END IF;
  END IF;

  INSERT INTO public.orders (
    user_id, status, payment_status, escrow_status,
    subtotal, shipping_fee, credit_used, total, shipping_address, notes
  )
  VALUES (
    v_uid, 'pending_payment', 'pending', 'held',
    v_subtotal, v_shipping_fee, v_credit, v_subtotal + v_shipping_fee - v_credit,
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

  INSERT INTO public.order_items (
    order_id, product_id, variant_id, vendor_id,
    product_name, variant_name, size, color, quantity, unit_price, total_price
  )
  SELECT
    v_order.id, p.id, v.id, p.vendor_id,
    p.name, COALESCE(v.name, NULLIF(concat_ws(' / ', c.size, c.color), '')), c.size, c.color, c.quantity,
    p.price + COALESCE(v.price_adjustment, 0),
    (p.price + COALESCE(v.price_adjustment, 0)) * c.quantity
  FROM public.cart_items c
  JOIN public.products p ON p.id = c.product_id
  LEFT JOIN public.product_variants v ON v.id = c.variant_id
  WHERE c.user_id = v_uid;

  DELETE FROM public.cart_items WHERE user_id = v_uid;

  RETURN v_order;
END;
$$;

-- ---------------------------------------------------------------------------
-- Order triggers: refund on cancel, reward on first completed order, lock credit_used
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guard_order_credit()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF public.is_client_request() AND NEW.credit_used IS DISTINCT FROM OLD.credit_used THEN
    RAISE EXCEPTION 'Credit on an order can''t be changed';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER orders_guard_credit
  BEFORE UPDATE OF credit_used ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_order_credit();

CREATE OR REPLACE FUNCTION public.order_credit_and_referrals()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s public.platform_settings%ROWTYPE;
  v_ref public.customer_referrals%ROWTYPE;
  v_friend TEXT;
BEGIN
  -- Cancelled: the credit comes back (once).
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' AND NEW.credit_used > 0 THEN
    INSERT INTO public.customer_credits (user_id, amount, kind, order_id, note)
    VALUES (NEW.user_id, NEW.credit_used, 'order_refund', NEW.id, 'Order cancelled: credit returned')
    ON CONFLICT DO NOTHING;
  END IF;

  -- First completed order of an invited customer: reward whoever invited them.
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' AND NEW.payment_status = 'paid' THEN
    SELECT * INTO v_ref FROM public.customer_referrals WHERE referred_id = NEW.user_id AND status = 'joined' FOR UPDATE;
    IF FOUND THEN
      SELECT * INTO s FROM public.platform_settings WHERE id = 1;
      IF NEW.subtotal >= COALESCE(s.referral_min_order, 0) THEN
        UPDATE public.customer_referrals SET status = 'rewarded', first_order_id = NEW.id, rewarded_at = now() WHERE id = v_ref.id;
        IF COALESCE(s.referral_referrer_credit, 0) > 0 THEN
          INSERT INTO public.customer_credits (user_id, amount, kind, referral_id, order_id, note)
          VALUES (v_ref.referrer_id, s.referral_referrer_credit, 'referral_reward', v_ref.id, NULL, 'Your friend''s first order was completed')
          ON CONFLICT DO NOTHING;
          SELECT COALESCE(NULLIF(split_part(btrim(full_name), ' ', 1), ''), 'Your friend') INTO v_friend FROM public.profiles WHERE id = NEW.user_id;
          INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
          VALUES (v_ref.referrer_id, 'You earned invite credit',
                  format('%s''s first order is complete. ₦%s credit was added to your account.', v_friend, to_char(s.referral_referrer_credit, 'FM999,999,990')),
                  'success', 'promotion', '/invite', jsonb_build_object('referral_id', v_ref.id));
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER orders_credit_and_referrals
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.order_credit_and_referrals();

-- ---------------------------------------------------------------------------
-- Admin
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
    'credit_given', COALESCE((SELECT sum(amount) FROM public.customer_credits WHERE amount > 0 AND kind IN ('referral_welcome', 'referral_reward', 'admin_adjust')), 0),
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

REVOKE ALL ON FUNCTION public.customer_credit_balance(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_referral_code(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_order_credit() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.order_credit_and_referrals() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.my_referral() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_credit() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.claim_customer_referral(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_referral_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.place_order(UUID, TEXT, TEXT, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.referral_invite(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.my_referral() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_credit() TO authenticated;
GRANT EXECUTE ON FUNCTION public.claim_customer_referral(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_referral_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.place_order(UUID, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.referral_invite(TEXT) TO anon, authenticated;
