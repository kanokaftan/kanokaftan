-- Scale and safety work.
--
-- 1. Guest carts. Signed-out shoppers could read and change every guest cart
--    (the policy only checked session_id IS NOT NULL). Guest carts now go
--    through functions that need the cart's secret random id, and the anon
--    table policies are removed. merge_guest_cart() moves a guest cart into the
--    shopper's account at sign-in (that never worked: RLS hid guest rows from
--    signed-in users).
-- 2. Rate limits for public edge functions (check_rate_limit, service only).
-- 3. Retention: old read notifications, analytics, app errors, rate-limit
--    windows and ended calls are cleaned up nightly.
-- 4. Admins are told when a seller payout fails.

-- ---------------------------------------------------------------------------
-- 1. Guest carts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.guest_cart_session_ok(p_session TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_session ~ '^[0-9a-fA-F-]{32,40}$';
$$;

/** Items in a guest cart, shaped like the signed-in cart query. */
CREATE OR REPLACE FUNCTION public.guest_cart(p_session TEXT)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', ci.id, 'product_id', ci.product_id, 'variant_id', ci.variant_id, 'quantity', ci.quantity,
    'size', ci.size, 'color', ci.color,
    'product', jsonb_build_object(
      'id', p.id, 'name', p.name, 'slug', p.slug, 'price', p.price, 'stock_quantity', p.stock_quantity,
      'product_images', COALESCE((SELECT jsonb_agg(jsonb_build_object('url', pi.url, 'is_primary', pi.is_primary))
                                  FROM public.product_images pi WHERE pi.product_id = p.id), '[]'::JSONB)
    )
  ) ORDER BY ci.created_at), '[]'::JSONB)
  FROM public.cart_items ci
  JOIN public.products p ON p.id = ci.product_id
  WHERE public.guest_cart_session_ok(p_session)
    AND ci.session_id = p_session AND ci.user_id IS NULL;
$$;

CREATE OR REPLACE FUNCTION public.guest_cart_add(
  p_session TEXT, p_product_id UUID, p_quantity INTEGER DEFAULT 1,
  p_variant_id UUID DEFAULT NULL, p_size TEXT DEFAULT NULL, p_color TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing UUID;
BEGIN
  IF NOT public.guest_cart_session_ok(p_session) THEN
    RAISE EXCEPTION 'Your cart session expired. Please refresh the page.';
  END IF;
  IF COALESCE(p_quantity, 0) < 1 OR p_quantity > 100 THEN
    RAISE EXCEPTION 'Choose a quantity between 1 and 100.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.products WHERE id = p_product_id AND is_active) THEN
    RAISE EXCEPTION 'This product is no longer available.';
  END IF;

  SELECT id INTO v_existing FROM public.cart_items
  WHERE session_id = p_session AND user_id IS NULL AND product_id = p_product_id
    AND variant_id IS NOT DISTINCT FROM p_variant_id
    AND size IS NOT DISTINCT FROM NULLIF(p_size, '')
    AND color IS NOT DISTINCT FROM NULLIF(p_color, '')
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE public.cart_items SET quantity = LEAST(quantity + p_quantity, 100) WHERE id = v_existing;
  ELSE
    INSERT INTO public.cart_items (product_id, variant_id, size, color, quantity, user_id, session_id)
    VALUES (p_product_id, p_variant_id, NULLIF(p_size, ''), NULLIF(p_color, ''), p_quantity, NULL, p_session);
  END IF;
END;
$$;

/** Set a guest cart line's quantity; 0 or less removes it. */
CREATE OR REPLACE FUNCTION public.guest_cart_set_quantity(p_session TEXT, p_item_id UUID, p_quantity INTEGER)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.guest_cart_session_ok(p_session) THEN
    RAISE EXCEPTION 'Your cart session expired. Please refresh the page.';
  END IF;
  IF COALESCE(p_quantity, 0) <= 0 THEN
    DELETE FROM public.cart_items WHERE id = p_item_id AND session_id = p_session AND user_id IS NULL;
  ELSE
    UPDATE public.cart_items SET quantity = LEAST(p_quantity, 100)
    WHERE id = p_item_id AND session_id = p_session AND user_id IS NULL;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.guest_cart_clear(p_session TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.guest_cart_session_ok(p_session) THEN
    DELETE FROM public.cart_items WHERE session_id = p_session AND user_id IS NULL;
  END IF;
END;
$$;

/** Move a guest cart into the signed-in shopper's cart, adding quantities for lines they already have. */
CREATE OR REPLACE FUNCTION public.merge_guest_cart(p_session TEXT)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_item RECORD;
  v_existing UUID;
  v_moved INTEGER := 0;
BEGIN
  IF v_me IS NULL OR NOT public.guest_cart_session_ok(p_session) THEN
    RETURN 0;
  END IF;
  FOR v_item IN
    SELECT * FROM public.cart_items WHERE session_id = p_session AND user_id IS NULL FOR UPDATE
  LOOP
    SELECT id INTO v_existing FROM public.cart_items
    WHERE user_id = v_me AND product_id = v_item.product_id
      AND variant_id IS NOT DISTINCT FROM v_item.variant_id
      AND size IS NOT DISTINCT FROM v_item.size
      AND color IS NOT DISTINCT FROM v_item.color
    LIMIT 1;
    IF v_existing IS NOT NULL THEN
      UPDATE public.cart_items SET quantity = LEAST(quantity + v_item.quantity, 100) WHERE id = v_existing;
      DELETE FROM public.cart_items WHERE id = v_item.id;
    ELSE
      UPDATE public.cart_items SET user_id = v_me, session_id = NULL WHERE id = v_item.id;
    END IF;
    v_moved := v_moved + 1;
  END LOOP;
  RETURN v_moved;
END;
$$;

-- ---------------------------------------------------------------------------
-- 2. Rate limits (called by edge functions with the service key)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.api_rate_limits (
  key TEXT NOT NULL,
  window_start TIMESTAMPTZ NOT NULL,
  hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (key, window_start)
);
ALTER TABLE public.api_rate_limits ENABLE ROW LEVEL SECURITY;

/** Count a hit for p_key in the current window; false once p_limit is exceeded. */
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key TEXT, p_limit INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_window TIMESTAMPTZ := to_timestamp(floor(extract(epoch FROM now()) / p_window_seconds) * p_window_seconds);
  v_hits INTEGER;
BEGIN
  INSERT INTO public.api_rate_limits (key, window_start, hits) VALUES (left(p_key, 200), v_window, 1)
  ON CONFLICT (key, window_start) DO UPDATE SET hits = public.api_rate_limits.hits + 1
  RETURNING hits INTO v_hits;
  RETURN v_hits <= p_limit;
END;
$$;

-- ---------------------------------------------------------------------------
-- 3. Retention
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cleanup_old_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_notifications INTEGER;
  v_analytics INTEGER;
  v_errors INTEGER;
  v_limits INTEGER;
  v_calls INTEGER;
BEGIN
  DELETE FROM public.notifications WHERE is_read AND created_at < now() - interval '90 days';
  GET DIAGNOSTICS v_notifications = ROW_COUNT;
  DELETE FROM public.analytics_events WHERE created_at < now() - interval '400 days';
  GET DIAGNOSTICS v_analytics = ROW_COUNT;
  DELETE FROM public.client_errors WHERE last_seen_at < now() - interval '60 days';
  GET DIAGNOSTICS v_errors = ROW_COUNT;
  DELETE FROM public.api_rate_limits WHERE window_start < now() - interval '1 day';
  GET DIAGNOSTICS v_limits = ROW_COUNT;
  DELETE FROM public.calls WHERE created_at < now() - interval '180 days' AND status IN ('ended', 'missed', 'declined', 'cancelled', 'failed');
  GET DIAGNOSTICS v_calls = ROW_COUNT;
  RETURN jsonb_build_object('notifications', v_notifications, 'analytics', v_analytics, 'errors', v_errors,
                            'rate_limits', v_limits, 'calls', v_calls);
END;
$$;

-- ---------------------------------------------------------------------------
-- 4. Payout failures reach the admins
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_admins_payout_failed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    SELECT ur.user_id, 'Seller payout failed',
           format('₦%s to %s failed: %s', to_char(NEW.amount, 'FM999,999,990.00'),
                  COALESCE((SELECT store_name FROM public.profiles WHERE id = NEW.vendor_id), 'a seller'),
                  COALESCE(left(NEW.failure_reason, 160), 'no reason given')),
           'warning', 'payment', '/admin/finance', jsonb_build_object('payout_id', NEW.id)
    FROM public.user_roles ur WHERE ur.role = 'admin';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER payouts_notify_failed
  AFTER UPDATE OF status ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_payout_failed();

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.guest_cart(TEXT) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.guest_cart_add(TEXT, UUID, INTEGER, UUID, TEXT, TEXT) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.guest_cart_set_quantity(TEXT, UUID, INTEGER) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.guest_cart_clear(TEXT) FROM PUBLIC;
  REVOKE ALL ON FUNCTION public.merge_guest_cart(TEXT) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.cleanup_old_data() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.notify_admins_payout_failed() FROM PUBLIC, anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.guest_cart(TEXT) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.guest_cart_add(TEXT, UUID, INTEGER, UUID, TEXT, TEXT) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.guest_cart_set_quantity(TEXT, UUID, INTEGER) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.guest_cart_clear(TEXT) TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.merge_guest_cart(TEXT) TO authenticated;
END $$;

-- Signed-out visitors no longer touch cart_items directly.
DROP POLICY IF EXISTS "Guest cart access" ON public.cart_items;

SELECT cron.schedule('cleanup-old-data', '41 3 * * *', $$SELECT public.cleanup_old_data()$$);
