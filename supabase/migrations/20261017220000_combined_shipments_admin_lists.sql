-- Combined shipments and server-side admin lists.
--
-- Combined shipments: an order with items from several sellers is collected
-- and delivered as ONE shipment, managed by Kano Kaftan. Each seller only
-- marks their part "ready"; when every seller is ready the order becomes
-- ready_for_pickup and admins are told. Sellers can no longer move a
-- multi-seller order past "processing" themselves (that used to start the
-- payout clock for everyone in the order).
--
-- Admin lists: one function per admin list returns a page of rows plus the
-- total, with search and filters done in the database, so admin pages stay
-- fast with thousands of users, sellers, products and orders.

-- ---------------------------------------------------------------------------
-- Combined shipments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.order_seller_status (
  order_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  ready_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, vendor_id)
);
ALTER TABLE public.order_seller_status ENABLE ROW LEVEL SECURITY;

/** How many different sellers an order has. */
CREATE OR REPLACE FUNCTION public.order_seller_count(p_order_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT count(DISTINCT vendor_id)::INTEGER FROM public.order_items WHERE order_id = p_order_id;
$$;

/** Each seller's readiness for one order (sellers in the order, its buyer, admins). */
CREATE OR REPLACE FUNCTION public.order_fulfilment(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.is_order_vendor(p_order_id, auth.uid())
    OR public.is_order_customer(p_order_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'You can''t see this order.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'combined', public.order_seller_count(p_order_id) > 1,
    'sellers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'vendor_id', v.vendor_id,
        'store_name', COALESCE(p.store_name, 'Seller'),
        'ready', s.ready_at IS NOT NULL,
        'ready_at', s.ready_at,
        'me', v.vendor_id = auth.uid()
      ) ORDER BY p.store_name)
      FROM (SELECT DISTINCT vendor_id FROM public.order_items WHERE order_id = p_order_id) v
      LEFT JOIN public.order_seller_status s ON s.order_id = p_order_id AND s.vendor_id = v.vendor_id
      LEFT JOIN public.profiles p ON p.id = v.vendor_id
    ), '[]'::JSONB)
  );
END;
$$;

/** A seller marks their part of a paid order ready (or not ready) for collection. */
CREATE OR REPLACE FUNCTION public.vendor_set_ready(p_order_id UUID, p_ready BOOLEAN DEFAULT true)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_sellers INTEGER;
  v_ready INTEGER;
BEGIN
  IF NOT public.is_order_vendor(p_order_id, auth.uid()) THEN
    RAISE EXCEPTION 'This order has none of your items.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.payment_status <> 'paid' OR v_order.status NOT IN ('payment_confirmed', 'processing', 'ready_for_pickup') THEN
    RAISE EXCEPTION 'This order can''t be prepared now (it is %).', replace(v_order.status, '_', ' ');
  END IF;

  INSERT INTO public.order_seller_status (order_id, vendor_id, ready_at, updated_at)
  VALUES (p_order_id, auth.uid(), CASE WHEN p_ready THEN now() END, now())
  ON CONFLICT (order_id, vendor_id) DO UPDATE
  SET ready_at = CASE WHEN p_ready THEN COALESCE(public.order_seller_status.ready_at, now()) END, updated_at = now();

  v_sellers := public.order_seller_count(p_order_id);
  SELECT count(*) INTO v_ready FROM public.order_seller_status WHERE order_id = p_order_id AND ready_at IS NOT NULL;

  IF v_ready >= v_sellers AND v_order.status <> 'ready_for_pickup' THEN
    UPDATE public.orders
    SET status = 'ready_for_pickup',
        tracking_updates = COALESCE(tracking_updates, '[]'::JSONB) || jsonb_build_array(jsonb_build_object(
          'status', 'ready_for_pickup',
          'message', CASE WHEN v_sellers > 1 THEN 'All sellers have packed your items. Kano Kaftan will collect them together.' ELSE 'Your order is packed and ready for collection.' END,
          'timestamp', now()))
    WHERE id = p_order_id;
    IF v_sellers > 1 THEN
      INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
      SELECT ur.user_id, 'Combined order ready for pickup',
             format('All %s sellers in order #%s are ready. Send one rider to collect from each.', v_sellers, left(p_order_id::TEXT, 8)),
             'order', 'order', '/admin/shipments', jsonb_build_object('order_id', p_order_id)
      FROM public.user_roles ur WHERE ur.role = 'admin';
    END IF;
  ELSIF v_ready < v_sellers AND v_order.status = 'ready_for_pickup' THEN
    -- A seller took their "ready" back before collection.
    UPDATE public.orders SET status = 'processing' WHERE id = p_order_id;
  ELSIF v_order.status = 'payment_confirmed' THEN
    UPDATE public.orders SET status = 'processing' WHERE id = p_order_id;
  END IF;

  RETURN public.order_fulfilment(p_order_id);
END;
$$;

-- Sellers can't ship or deliver a combined order themselves: Kano Kaftan does.
CREATE OR REPLACE FUNCTION public.guard_combined_order_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF public.is_client_request()
    AND NEW.status IS DISTINCT FROM OLD.status
    AND NOT public.has_role(auth.uid(), 'admin')
    AND NEW.status IN ('ready_for_pickup', 'shipped', 'out_for_delivery', 'delivered')
    AND public.is_order_vendor(OLD.id, auth.uid())
    AND public.order_seller_count(OLD.id) > 1
  THEN
    RAISE EXCEPTION 'This order has items from several sellers. Mark your items ready; Kano Kaftan collects and delivers them together.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER orders_guard_combined_status
  BEFORE UPDATE OF status ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.guard_combined_order_status();

/** Admin queue: paid multi-seller orders not yet sent, with each seller's readiness and pickup place. */
CREATE OR REPLACE FUNCTION public.admin_combined_shipments()
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
      'order_id', o.id,
      'created_at', o.created_at,
      'status', o.status,
      'total', o.total,
      'shipping_address', o.shipping_address,
      'customer_name', COALESCE(cp.full_name, 'Customer'),
      'customer_phone', COALESCE(cp.phone, o.shipping_address ->> 'phone'),
      'dispatched', d.dispatched_at IS NOT NULL,
      'delivery_company', d.delivery_company,
      'pickup_code', d.pickup_code,
      'sellers', (
        SELECT jsonb_agg(jsonb_build_object(
          'vendor_id', v.vendor_id,
          'store_name', COALESCE(p.store_name, 'Seller'),
          'phone', p.phone,
          'address', jsonb_strip_nulls(jsonb_build_object('street', p.store_address ->> 'street', 'city', p.store_address ->> 'city', 'state', p.store_address ->> 'state')),
          'items', v.items,
          'ready', s.ready_at IS NOT NULL
        ) ORDER BY s.ready_at NULLS FIRST, p.store_name)
        FROM (SELECT vendor_id, sum(quantity) AS items FROM public.order_items WHERE order_id = o.id GROUP BY vendor_id) v
        LEFT JOIN public.order_seller_status s ON s.order_id = o.id AND s.vendor_id = v.vendor_id
        LEFT JOIN public.profiles p ON p.id = v.vendor_id
      )
    ) ORDER BY (o.status = 'ready_for_pickup') DESC, o.created_at)
    FROM public.orders o
    LEFT JOIN public.order_deliveries d ON d.order_id = o.id
    LEFT JOIN public.profiles cp ON cp.id = o.user_id
    WHERE o.payment_status = 'paid'
      AND o.status IN ('payment_confirmed', 'processing', 'ready_for_pickup')
      AND public.order_seller_count(o.id) > 1
  ), '[]'::JSONB);
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin overview: every count the admin home needs, in one call
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_overview_counts()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN jsonb_build_object(
    -- needs attention
    'seller_applications', (SELECT count(*) FROM public.vendor_applications WHERE status = 'pending'),
    'verification_reviews', (SELECT count(*) FROM public.vendor_verification_requests WHERE status = 'pending_review'),
    'ambassador_applications', (SELECT count(*) FROM public.ambassador_applications WHERE status = 'pending'),
    'orders_to_prepare', (SELECT count(*) FROM public.orders WHERE payment_status = 'paid' AND status IN ('payment_confirmed', 'processing')),
    'combined_ready', (SELECT count(*) FROM public.orders o WHERE o.payment_status = 'paid' AND o.status = 'ready_for_pickup'
                         AND public.order_seller_count(o.id) > 1
                         AND NOT EXISTS (SELECT 1 FROM public.order_deliveries d WHERE d.order_id = o.id AND d.dispatched_at IS NOT NULL)),
    'open_disputes', (SELECT count(*) FROM public.orders WHERE dispute_status = 'open'),
    'failed_payouts', (SELECT count(*) FROM public.payouts WHERE status = 'failed'),
    'refunds_needed', (SELECT count(DISTINCT metadata ->> 'payment_reference') FROM public.notifications
                       WHERE title = 'Refund needed: payment on a cancelled order' AND NOT is_read),
    'open_reports', (SELECT count(*) FROM public.reports WHERE COALESCE(status, 'open') IN ('open', 'pending')),
    'app_errors', (SELECT count(*) FROM public.client_errors WHERE resolved_at IS NULL),
    -- totals
    'customers', (SELECT count(*) FROM public.profiles p WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role IN ('vendor', 'admin'))),
    'sellers', (SELECT count(*) FROM public.user_roles WHERE role = 'vendor'),
    'verified_sellers', (SELECT count(*) FROM public.profiles WHERE is_verified),
    'products', (SELECT count(*) FROM public.products WHERE deleted_at IS NULL),
    'live_products', (SELECT count(*) FROM public.products WHERE deleted_at IS NULL AND is_active),
    'paid_orders', (SELECT count(*) FROM public.orders WHERE payment_status = 'paid'),
    'unpaid_orders', (SELECT count(*) FROM public.orders WHERE payment_status = 'pending'),
    'in_transit', (SELECT count(*) FROM public.orders WHERE payment_status = 'paid' AND status IN ('shipped', 'out_for_delivery')),
    'completed_orders', (SELECT count(*) FROM public.orders WHERE status = 'completed'),
    'revenue', (SELECT COALESCE(sum(total), 0) FROM public.orders WHERE payment_status = 'paid'),
    'unpaid_value', (SELECT COALESCE(sum(total), 0) FROM public.orders WHERE payment_status = 'pending'),
    'escrow_held', (SELECT COALESCE(sum(total), 0) FROM public.orders WHERE payment_status = 'paid' AND escrow_status = 'held'),
    'escrow_released', (SELECT COALESCE(sum(total), 0) FROM public.orders WHERE payment_status = 'paid' AND escrow_status = 'released')
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Admin lists (page + total)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_list_users(p_search TEXT DEFAULT NULL, p_role TEXT DEFAULT 'all', p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
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
      SELECT p.*, COALESCE((SELECT array_agg(r.role::TEXT ORDER BY r.role) FROM public.user_roles r WHERE r.user_id = p.id), ARRAY['customer']) AS roles
      FROM public.profiles p
      WHERE (v_search IS NULL OR p.full_name ILIKE '%' || v_search || '%' OR p.email ILIKE '%' || v_search || '%'
             OR p.phone ILIKE '%' || v_search || '%' OR p.store_name ILIKE '%' || v_search || '%')
    ), filtered AS (
      SELECT * FROM base
      WHERE p_role = 'all'
         OR (p_role = 'customer' AND NOT (roles && ARRAY['vendor', 'admin']))
         OR p_role = ANY (roles)
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM filtered),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'email', email, 'full_name', full_name, 'phone', phone, 'avatar_url', avatar_url,
        'is_verified', is_verified, 'verification_tier', verification_tier, 'store_name', store_name,
        'created_at', created_at, 'last_seen_at', last_seen_at, 'roles', to_jsonb(roles)
      ) ORDER BY created_at DESC) FROM (SELECT * FROM filtered ORDER BY created_at DESC LIMIT LEAST(p_limit, 200) OFFSET GREATEST(p_offset, 0)) x), '[]'::JSONB)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_vendors(p_search TEXT DEFAULT NULL, p_filter TEXT DEFAULT 'all', p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
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
    WITH filtered AS (
      SELECT p.* FROM public.profiles p
      WHERE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role = 'vendor')
        AND (v_search IS NULL OR p.store_name ILIKE '%' || v_search || '%' OR p.full_name ILIKE '%' || v_search || '%'
             OR p.email ILIKE '%' || v_search || '%' OR p.phone ILIKE '%' || v_search || '%')
        AND (p_filter = 'all'
             OR (p_filter = 'verified' AND p.is_verified)
             OR (p_filter = 'unverified' AND NOT COALESCE(p.is_verified, false))
             OR (p_filter = 'gold' AND p.verification_tier = 'gold'))
    ), page AS (
      SELECT * FROM filtered ORDER BY created_at DESC LIMIT LEAST(p_limit, 200) OFFSET GREATEST(p_offset, 0)
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM filtered),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', pg.id, 'email', pg.email, 'full_name', pg.full_name, 'phone', pg.phone, 'avatar_url', pg.avatar_url,
        'is_verified', pg.is_verified, 'verification_tier', pg.verification_tier, 'store_name', pg.store_name,
        'store_slug', pg.store_slug, 'store_description', pg.store_description, 'created_at', pg.created_at,
        'bank_name', pg.bank_name, 'account_number', pg.account_number, 'account_name', pg.account_name,
        'payout_preference', pg.payout_preference, 'store_address', pg.store_address,
        'product_count', (SELECT count(*) FROM public.products pr WHERE pr.vendor_id = pg.id AND pr.deleted_at IS NULL),
        'total_sales', COALESCE((SELECT sum(oi.total_price) FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
                                 WHERE oi.vendor_id = pg.id AND o.payment_status = 'paid'), 0),
        'pending_payout', COALESCE((SELECT sum(oi.total_price) FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
                                    WHERE oi.vendor_id = pg.id AND o.payment_status = 'paid' AND o.escrow_status = 'held'), 0)
      ) ORDER BY pg.created_at DESC) FROM page pg), '[]'::JSONB)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_products(p_search TEXT DEFAULT NULL, p_filter TEXT DEFAULT 'all', p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
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
    WITH filtered AS (
      SELECT pr.* FROM public.products pr
      LEFT JOIN public.profiles v ON v.id = pr.vendor_id
      WHERE pr.deleted_at IS NULL
        AND (v_search IS NULL OR pr.name ILIKE '%' || v_search || '%' OR v.store_name ILIKE '%' || v_search || '%')
        AND (p_filter = 'all'
             OR (p_filter = 'active' AND pr.is_active)
             OR (p_filter = 'inactive' AND NOT pr.is_active)
             OR (p_filter = 'featured' AND pr.featured)
             OR (p_filter = 'out_of_stock' AND pr.stock_quantity <= 0))
    ), page AS (
      SELECT * FROM filtered ORDER BY created_at DESC LIMIT LEAST(p_limit, 200) OFFSET GREATEST(p_offset, 0)
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM filtered),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', pg.id, 'name', pg.name, 'slug', pg.slug, 'price', pg.price, 'stock_quantity', pg.stock_quantity,
        'is_active', pg.is_active, 'featured', pg.featured, 'created_at', pg.created_at, 'vendor_id', pg.vendor_id,
        'category', (SELECT jsonb_build_object('name', c.name) FROM public.categories c WHERE c.id = pg.category_id),
        'vendor', (SELECT jsonb_build_object('store_name', v.store_name, 'full_name', v.full_name) FROM public.profiles v WHERE v.id = pg.vendor_id),
        'product_images', COALESCE((SELECT jsonb_agg(jsonb_build_object('url', pi.url) ORDER BY pi.is_primary DESC, pi.display_order NULLS LAST)
                                    FROM public.product_images pi WHERE pi.product_id = pg.id), '[]'::JSONB)
      ) ORDER BY pg.created_at DESC) FROM page pg), '[]'::JSONB)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_orders(p_search TEXT DEFAULT NULL, p_filter TEXT DEFAULT 'all', p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
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
    WITH filtered AS (
      SELECT o.* FROM public.orders o
      LEFT JOIN public.profiles c ON c.id = o.user_id
      WHERE (v_search IS NULL OR o.id::TEXT ILIKE v_search || '%' OR c.full_name ILIKE '%' || v_search || '%'
             OR c.email ILIKE '%' || v_search || '%' OR o.payment_reference ILIKE '%' || v_search || '%')
        AND (p_filter = 'all'
             OR (p_filter = 'unpaid' AND o.payment_status = 'pending')
             OR (p_filter = 'to_prepare' AND o.payment_status = 'paid' AND o.status IN ('payment_confirmed', 'processing', 'ready_for_pickup'))
             OR (p_filter = 'in_transit' AND o.status IN ('shipped', 'out_for_delivery'))
             OR (p_filter = 'delivered' AND o.status IN ('delivered', 'completed'))
             OR (p_filter = 'cancelled' AND o.status = 'cancelled')
             OR (p_filter = 'disputed' AND o.dispute_status = 'open')
             OR (p_filter = 'combined' AND public.order_seller_count(o.id) > 1))
    ), page AS (
      SELECT * FROM filtered ORDER BY created_at DESC LIMIT LEAST(p_limit, 200) OFFSET GREATEST(p_offset, 0)
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM filtered),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', pg.id, 'user_id', pg.user_id, 'status', pg.status, 'payment_status', pg.payment_status,
        'escrow_status', pg.escrow_status, 'total', pg.total, 'subtotal', pg.subtotal, 'shipping_fee', pg.shipping_fee,
        'shipping_address', pg.shipping_address, 'created_at', pg.created_at, 'dispute_status', pg.dispute_status,
        'customer', (SELECT jsonb_build_object('full_name', c.full_name, 'email', c.email) FROM public.profiles c WHERE c.id = pg.user_id),
        'seller_count', public.order_seller_count(pg.id),
        'order_items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
          'id', oi.id, 'product_name', oi.product_name, 'quantity', oi.quantity, 'unit_price', oi.unit_price,
          'total_price', oi.total_price, 'vendor', jsonb_build_object('store_name', v.store_name)
        )) FROM public.order_items oi LEFT JOIN public.profiles v ON v.id = oi.vendor_id WHERE oi.order_id = pg.id), '[]'::JSONB)
      ) ORDER BY pg.created_at DESC) FROM page pg), '[]'::JSONB)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_category_counts()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN COALESCE((SELECT jsonb_object_agg(category_id, n) FROM (
    SELECT category_id, count(*) AS n FROM public.products WHERE deleted_at IS NULL AND category_id IS NOT NULL GROUP BY category_id
  ) x), '{}'::JSONB);
END;
$$;

-- Indexes the lists and counts lean on.
CREATE INDEX IF NOT EXISTS orders_created_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_payment_status_idx ON public.orders (payment_status, status);
CREATE INDEX IF NOT EXISTS products_created_idx ON public.products (created_at DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS profiles_created_idx ON public.profiles (created_at DESC);
CREATE INDEX IF NOT EXISTS order_items_order_vendor_idx ON public.order_items (order_id, vendor_id);

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.order_seller_count(UUID) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.order_fulfilment(UUID) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.vendor_set_ready(UUID, BOOLEAN) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_combined_shipments() FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_overview_counts() FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_list_vendors(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_list_products(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_list_orders(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_category_counts() FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.order_seller_count(UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.order_fulfilment(UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.vendor_set_ready(UUID, BOOLEAN) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_combined_shipments() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_overview_counts() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_list_vendors(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_list_products(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_list_orders(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_category_counts() TO authenticated;
END $$;
