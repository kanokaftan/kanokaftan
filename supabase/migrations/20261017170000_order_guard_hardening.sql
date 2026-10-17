-- Security review fixes for orders.
--
-- 1. delivery_type decides the commission (concierge orders pay
--    commission_percent, checkout orders checkout_commission_percent), but a
--    seller or the buyer could edit it, turning a concierge order into a 0%
--    one before payment. It and the other admin-set columns are now locked.
-- 2. tracking_updates (the order timeline) could be rewritten by the buyer or
--    any seller in the order. Clients may now only add entries, and only for
--    the status they are moving the order to.
-- 3. A payment completed after the buyer cancelled used to revive the
--    cancelled order. It is now left cancelled and admins are told to refund.
-- 4. vendor_setup_status() told any signed-in user whether a seller had a
--    phone, location or bank account. It now answers only about yourself.

CREATE OR REPLACE FUNCTION public.guard_order_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_is_admin BOOLEAN;
  v_release_days INTEGER;
  v_old_updates JSONB;
  v_new_updates JSONB;
  v_old_len INTEGER;
BEGIN
  IF public.is_client_request() THEN
    IF TG_OP = 'INSERT' THEN
      RAISE EXCEPTION 'Orders must be placed through checkout';
    END IF;

    v_is_admin := public.has_role(v_uid, 'admin');

    -- Customer cancelling an unpaid order is the only payment_status change allowed.
    IF NOT (
      OLD.user_id = v_uid
      AND OLD.payment_status = 'pending'
      AND NEW.payment_status = 'cancelled'
      AND NEW.status = 'cancelled'
    ) AND NEW.payment_status IS DISTINCT FROM OLD.payment_status THEN
      RAISE EXCEPTION 'payment_status cannot be changed directly';
    END IF;

    IF NEW.user_id IS DISTINCT FROM OLD.user_id
      OR NEW.subtotal IS DISTINCT FROM OLD.subtotal
      OR NEW.shipping_fee IS DISTINCT FROM OLD.shipping_fee
      OR NEW.total IS DISTINCT FROM OLD.total
      OR NEW.shipping_address IS DISTINCT FROM OLD.shipping_address
      OR NEW.payment_reference IS DISTINCT FROM OLD.payment_reference
      OR NEW.escrow_status IS DISTINCT FROM OLD.escrow_status
      OR NEW.confirmed_at IS DISTINCT FROM OLD.confirmed_at
      OR NEW.auto_release_at IS DISTINCT FROM OLD.auto_release_at
      OR NEW.shipped_at IS DISTINCT FROM OLD.shipped_at
      OR NEW.dispute_status IS DISTINCT FROM OLD.dispute_status
      OR NEW.dispute_reason IS DISTINCT FROM OLD.dispute_reason
      OR NEW.disputed_at IS DISTINCT FROM OLD.disputed_at
      OR NEW.dispute_resolved_at IS DISTINCT FROM OLD.dispute_resolved_at
      OR NEW.created_at IS DISTINCT FROM OLD.created_at
    THEN
      RAISE EXCEPTION 'Payment and delivery fields cannot be changed directly';
    END IF;

    -- Set by checkout or by admins only: delivery_type also decides the commission.
    IF NOT v_is_admin AND (
      NEW.delivery_type IS DISTINCT FROM OLD.delivery_type
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.estimated_delivery_date IS DISTINCT FROM OLD.estimated_delivery_date
    ) THEN
      RAISE EXCEPTION 'Only Kano Kaftan can change this order''s delivery details';
    END IF;

    -- The timeline can only grow, by entries for the status being set now.
    IF NOT v_is_admin AND NEW.tracking_updates IS DISTINCT FROM OLD.tracking_updates THEN
      v_old_updates := COALESCE(OLD.tracking_updates, '[]'::JSONB);
      v_new_updates := COALESCE(NEW.tracking_updates, '[]'::JSONB);
      v_old_len := jsonb_array_length(v_old_updates);
      IF jsonb_typeof(v_new_updates) <> 'array'
        OR jsonb_array_length(v_new_updates) <= v_old_len
        OR NEW.status IS NOT DISTINCT FROM OLD.status
        OR COALESCE((SELECT jsonb_agg(e ORDER BY i) FROM jsonb_array_elements(v_new_updates) WITH ORDINALITY t(e, i) WHERE i <= v_old_len), '[]'::JSONB) <> v_old_updates
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(v_new_updates) WITH ORDINALITY t(e, i)
          WHERE i > v_old_len AND (e ->> 'status') IS DISTINCT FROM NEW.status
        )
      THEN
        RAISE EXCEPTION 'The order timeline can only be added to';
      END IF;
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status AND NOT v_is_admin THEN
      IF OLD.user_id = v_uid AND OLD.payment_status = 'pending' AND NEW.status = 'cancelled' THEN
        NULL; -- customer cancelling an unpaid order
      ELSIF public.is_order_vendor(OLD.id, v_uid)
        AND OLD.payment_status = 'paid'
        AND OLD.status NOT IN ('completed', 'cancelled')
        AND NEW.status IN ('processing', 'ready_for_pickup', 'shipped', 'out_for_delivery', 'delivered')
      THEN
        NULL; -- vendor moving a paid order through fulfilment
      ELSE
        RAISE EXCEPTION 'You cannot change this order to %', NEW.status;
      END IF;
    END IF;
  END IF;

  -- Start the auto-release clock the first time the order leaves the vendor.
  IF TG_OP = 'UPDATE'
    AND OLD.shipped_at IS NULL
    AND NEW.payment_status = 'paid'
    AND NEW.status IN ('shipped', 'out_for_delivery', 'delivered')
  THEN
    SELECT auto_release_days INTO v_release_days FROM public.platform_settings WHERE id = 1;
    NEW.shipped_at := now();
    NEW.auto_release_at := now() + make_interval(days => COALESCE(v_release_days, 7));
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_order_paid(p_order_id uuid, p_reference text, p_amount_kobo bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_commission NUMERIC;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order % not found', p_order_id;
  END IF;

  IF v_order.payment_status = 'paid' THEN
    RETURN false;
  END IF;

  -- Paid after the buyer cancelled: keep it cancelled and ask an admin to refund.
  IF v_order.status = 'cancelled' OR v_order.payment_status = 'cancelled' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE action_url = '/admin/orders' AND metadata ->> 'payment_reference' = p_reference
    ) THEN
      INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
      SELECT ur.user_id, 'Refund needed: payment on a cancelled order',
             format('₦%s was paid (ref %s) for an order the buyer had cancelled. Refund it from Paystack.',
                    to_char(p_amount_kobo / 100.0, 'FM999,999,990.00'), p_reference),
             'warning', 'payment', '/admin/orders',
             jsonb_build_object('order_id', p_order_id, 'payment_reference', p_reference)
      FROM public.user_roles ur WHERE ur.role = 'admin';
    END IF;
    RETURN false;
  END IF;

  IF round(v_order.total * 100) <> p_amount_kobo THEN
    RAISE EXCEPTION 'Amount paid (% kobo) does not match order total (% kobo)',
      p_amount_kobo, round(v_order.total * 100);
  END IF;

  UPDATE public.orders
  SET payment_status = 'paid',
      status = 'payment_confirmed',
      escrow_status = 'held',
      payment_reference = p_reference,
      tracking_updates = COALESCE(tracking_updates, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'status', 'payment_confirmed',
        'message', 'Payment received and held securely',
        'timestamp', now()
      ))
  WHERE id = p_order_id;

  UPDATE public.products p
  SET stock_quantity = GREATEST(0, p.stock_quantity - oi.qty)
  FROM (
    SELECT product_id, sum(quantity) AS qty
    FROM public.order_items WHERE order_id = p_order_id
    GROUP BY product_id
  ) oi
  WHERE p.id = oi.product_id;

  UPDATE public.product_variants v
  SET stock_quantity = GREATEST(0, v.stock_quantity - oi.qty)
  FROM (
    SELECT variant_id, sum(quantity) AS qty
    FROM public.order_items WHERE order_id = p_order_id AND variant_id IS NOT NULL
    GROUP BY variant_id
  ) oi
  WHERE v.id = oi.variant_id;

  SELECT commission_percent INTO v_commission FROM public.platform_settings WHERE id = 1;
  v_commission := COALESCE(v_commission, 0);

  INSERT INTO public.payouts (
    order_id, vendor_id, tranche, gross_amount, commission_percent,
    commission_amount, amount, status
  )
  SELECT
    p_order_id, s.vendor_id, t.tranche, s.gross, v_commission, s.commission,
    CASE WHEN t.tranche = 1 THEN s.first_half ELSE s.net - s.first_half END,
    CASE WHEN t.tranche = 1 THEN 'pending' ELSE 'held' END
  FROM (
    SELECT
      vendor_id,
      gross,
      commission,
      gross - commission AS net,
      floor((gross - commission) * 100 / 2) / 100 AS first_half
    FROM (
      SELECT
        vendor_id,
        sum(total_price) AS gross,
        round(sum(total_price) * v_commission / 100, 2) AS commission
      FROM public.order_items
      WHERE order_id = p_order_id
      GROUP BY vendor_id
    ) g
  ) s
  CROSS JOIN (VALUES (1::SMALLINT), (2::SMALLINT)) AS t(tranche)
  ON CONFLICT (order_id, vendor_id, tranche) DO NOTHING;

  RETURN true;
END;
$$;

-- Answers only about yourself (admins and server jobs may ask about anyone).
-- It stays callable by signed-in users because the product guard, which must
-- run as the caller, uses it for the seller's own products.
CREATE OR REPLACE FUNCTION public.vendor_setup_status(p_vendor_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_has_phone BOOLEAN := false;
  v_has_location BOOLEAN := false;
  v_has_payout BOOLEAN;
BEGIN
  IF auth.uid() IS NOT NULL AND p_vendor_id IS DISTINCT FROM auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'You can only check your own shop setup.' USING ERRCODE = '42501';
  END IF;

  SELECT
    regexp_replace(COALESCE(phone, ''), '\D', '', 'g') ~ '^(234|0)?[789][01][0-9]{8}$',
    (store_address ->> 'latitude') IS NOT NULL
      AND (store_address ->> 'longitude') IS NOT NULL
      AND COALESCE((store_address ->> 'location_precise')::BOOLEAN, false)
  INTO v_has_phone, v_has_location
  FROM public.profiles WHERE id = p_vendor_id;

  v_has_payout := EXISTS (
    SELECT 1 FROM public.vendor_payout_accounts v WHERE v.vendor_id = p_vendor_id AND v.recipient_code IS NOT NULL
  );

  RETURN jsonb_build_object(
    'has_phone', COALESCE(v_has_phone, false),
    'has_location', COALESCE(v_has_location, false),
    'has_payout', v_has_payout,
    'complete', COALESCE(v_has_phone, false) AND COALESCE(v_has_location, false) AND v_has_payout
  );
END;
$$;
