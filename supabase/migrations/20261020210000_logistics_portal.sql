-- Delivery partner accounts.
--
-- A delivery company gets one or more logins. The admin types the company's
-- login email(s) on the Logistics page; the first time that person signs in
-- to Kano Kaftan and opens /delivery, their account is linked to the company.
--
-- In the delivery dashboard the company sees every order assigned to it:
-- where to collect (each seller's shop address and phone) and where to deliver
-- (customer name, phone and address). It can accept a job, mark it picked up
-- and on the way, report a problem, and confirm delivery with the customer's
-- 6-digit code (the code itself is never shown to the company). It is told
-- when a new order is assigned, and chats with Kano Kaftan in the normal
-- support chat (admins can open that chat from the Logistics page).

-- ---------------------------------------------------------------------------
-- Logins
-- ---------------------------------------------------------------------------

ALTER TABLE public.logistics_companies ADD COLUMN IF NOT EXISTS login_emails TEXT[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.logistics_members (
  company_id UUID NOT NULL REFERENCES public.logistics_companies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, user_id)
);
CREATE INDEX IF NOT EXISTS logistics_members_user_idx ON public.logistics_members (user_id);
ALTER TABLE public.logistics_members ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS picked_up_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rider_name TEXT,
  ADD COLUMN IF NOT EXISTS rider_phone TEXT,
  ADD COLUMN IF NOT EXISTS problem TEXT,
  ADD COLUMN IF NOT EXISTS problem_at TIMESTAMPTZ;

/** The delivery company the signed-in person works for (links them by login email the first time). */
CREATE OR REPLACE FUNCTION public.my_logistics_company_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_email TEXT;
  v_company UUID;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT m.company_id INTO v_company
  FROM public.logistics_members m JOIN public.logistics_companies c ON c.id = m.company_id
  WHERE m.user_id = v_uid AND c.is_active
  ORDER BY m.created_at LIMIT 1;
  IF v_company IS NOT NULL THEN
    RETURN v_company;
  END IF;

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT c.id INTO v_company FROM public.logistics_companies c
  WHERE c.is_active AND v_email = ANY (SELECT lower(btrim(e)) FROM unnest(c.login_emails) e)
  ORDER BY c.priority LIMIT 1;
  IF v_company IS NOT NULL THEN
    INSERT INTO public.logistics_members (company_id, user_id) VALUES (v_company, v_uid) ON CONFLICT DO NOTHING;
  END IF;
  RETURN v_company;
END;
$$;

CREATE OR REPLACE FUNCTION public.require_logistics_company()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.my_logistics_company_id();
BEGIN
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'This account isn''t linked to a delivery company. Ask Kano Kaftan to add your email.' USING ERRCODE = '42501';
  END IF;
  RETURN v_company;
END;
$$;

-- ---------------------------------------------------------------------------
-- Dashboard
-- ---------------------------------------------------------------------------

/** Stage of a delivery as the company sees it. */
CREATE OR REPLACE FUNCTION public.delivery_stage(d public.order_deliveries, o public.orders)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN o.status IN ('cancelled', 'refunded') THEN 'cancelled'
    WHEN d.delivered_at IS NOT NULL OR o.status IN ('delivered', 'completed') THEN 'delivered'
    WHEN o.status = 'out_for_delivery' THEN 'on_the_way'
    WHEN d.picked_up_at IS NOT NULL THEN 'picked_up'
    WHEN d.accepted_at IS NOT NULL THEN 'accepted'
    ELSE 'new'
  END;
$$;

/** Everything the delivery company needs: its jobs (open + last 30 days) and counts. */
CREATE OR REPLACE FUNCTION public.logistics_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.require_logistics_company();
  v_jobs JSONB;
BEGIN
  SELECT COALESCE(jsonb_agg(j ORDER BY (j ->> 'sort_at') DESC), '[]'::JSONB) INTO v_jobs
  FROM (
    SELECT jsonb_build_object(
      'order_id', o.id,
      'ref', upper(left(o.id::TEXT, 8)),
      'stage', public.delivery_stage(d, o),
      'order_status', o.status,
      'paid_at', o.created_at,
      'sort_at', COALESCE(d.dispatched_at, d.created_at),
      'assigned_at', d.created_at,
      'accepted_at', d.accepted_at,
      'picked_up_at', d.picked_up_at,
      'delivered_at', COALESCE(d.delivered_at, CASE WHEN o.status IN ('delivered', 'completed') THEN o.confirmed_at END),
      'rider_name', d.rider_name,
      'rider_phone', d.rider_phone,
      'problem', d.problem,
      'delivery_fee', o.shipping_fee,
      'items', (SELECT COALESCE(sum(oi.quantity), 0) FROM public.order_items oi WHERE oi.order_id = o.id),
      'customer', jsonb_build_object(
        'name', o.shipping_address ->> 'full_name',
        'phone', o.shipping_address ->> 'phone',
        'address', concat_ws(', ', o.shipping_address ->> 'street_address', o.shipping_address ->> 'landmark',
                             o.shipping_address ->> 'city', o.shipping_address ->> 'state')),
      'pickups', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'shop', COALESCE(p.store_name, p.full_name, 'Seller'),
          'phone', COALESCE(p.phone, p.store_address ->> 'phone'),
          'address', concat_ws(', ', p.store_address ->> 'street', p.store_address ->> 'city', p.store_address ->> 'state'),
          'lat', NULLIF(p.store_address ->> 'latitude', ''),
          'lng', NULLIF(p.store_address ->> 'longitude', ''),
          'items', s.items,
          'ready', ss.ready_at IS NOT NULL OR o.status = 'ready_for_pickup'))
        FROM (
          SELECT oi.vendor_id, sum(oi.quantity) AS items
          FROM public.order_items oi WHERE oi.order_id = o.id GROUP BY oi.vendor_id
        ) s
        JOIN public.profiles p ON p.id = s.vendor_id
        LEFT JOIN public.order_seller_status ss ON ss.order_id = o.id AND ss.vendor_id = s.vendor_id
      ), '[]'::JSONB)
    ) AS j
    FROM public.order_deliveries d
    JOIN public.orders o ON o.id = d.order_id
    WHERE d.company_id = v_company
      AND o.payment_status = 'paid'
      AND (o.status NOT IN ('delivered', 'completed', 'cancelled', 'refunded')
           OR COALESCE(d.delivered_at, o.updated_at) > now() - interval '30 days')
    LIMIT 300
  ) x;

  RETURN jsonb_build_object(
    'company', (SELECT jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone, 'areas', c.areas)
                FROM public.logistics_companies c WHERE c.id = v_company),
    'jobs', v_jobs
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Actions
-- ---------------------------------------------------------------------------

/** Loads one of the company's deliveries, locked; errors if it isn't theirs. */
CREATE OR REPLACE FUNCTION public.logistics_job(p_order_id UUID)
RETURNS public.order_deliveries
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company UUID := public.require_logistics_company();
  v_delivery public.order_deliveries%ROWTYPE;
BEGIN
  SELECT * INTO v_delivery FROM public.order_deliveries WHERE order_id = p_order_id AND company_id = v_company FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'This delivery isn''t assigned to your company.';
  END IF;
  RETURN v_delivery;
END;
$$;

CREATE OR REPLACE FUNCTION public.logistics_add_tracking(p_order_id UUID, p_status TEXT, p_message TEXT, p_new_order_status TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.orders
  SET status = COALESCE(p_new_order_status, status),
      tracking_updates = COALESCE(tracking_updates, '[]'::JSONB) || jsonb_build_array(jsonb_build_object(
        'status', p_status, 'message', p_message, 'timestamp', now()))
  WHERE id = p_order_id;
END;
$$;

/**
 * Delivery company actions on a job:
 *   accept        (optional rider name/phone)
 *   picked_up     parcel collected from the seller(s); order becomes "shipped"
 *   on_the_way    rider heading to the customer; order becomes "out for delivery"
 *   problem       something went wrong; admins are told (p_note says what)
 */
CREATE OR REPLACE FUNCTION public.logistics_update_job(p_order_id UUID, p_action TEXT, p_note TEXT DEFAULT NULL,
                                                       p_rider_name TEXT DEFAULT NULL, p_rider_phone TEXT DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery public.order_deliveries%ROWTYPE := public.logistics_job(p_order_id);
  v_order public.orders%ROWTYPE;
  v_company TEXT;
  v_note TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.status IN ('delivered', 'completed', 'cancelled', 'refunded') THEN
    RAISE EXCEPTION 'This order is already %.', replace(v_order.status, '_', ' ');
  END IF;
  SELECT name INTO v_company FROM public.logistics_companies WHERE id = v_delivery.company_id;

  IF p_action = 'accept' THEN
    UPDATE public.order_deliveries
    SET accepted_at = COALESCE(accepted_at, now()),
        rider_name = COALESCE(NULLIF(btrim(p_rider_name), ''), rider_name),
        rider_phone = COALESCE(NULLIF(regexp_replace(COALESCE(p_rider_phone, ''), '[^0-9+]', '', 'g'), ''), rider_phone),
        dispatched_at = COALESCE(dispatched_at, now())
    WHERE order_id = p_order_id;
    PERFORM public.logistics_add_tracking(p_order_id, 'rider_assigned',
      format('%s accepted the delivery%s', v_company, CASE WHEN NULLIF(btrim(p_rider_name), '') IS NOT NULL THEN format(' (rider: %s)', btrim(p_rider_name)) ELSE '' END));
  ELSIF p_action = 'picked_up' THEN
    UPDATE public.order_deliveries SET accepted_at = COALESCE(accepted_at, now()), picked_up_at = now(), dispatched_at = COALESCE(dispatched_at, now())
    WHERE order_id = p_order_id;
    PERFORM public.logistics_add_tracking(p_order_id, 'shipped', format('Collected by %s', v_company),
      CASE WHEN v_order.status IN ('payment_confirmed', 'processing', 'ready_for_pickup') THEN 'shipped' END);
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    VALUES (v_order.user_id, 'Your order has been collected', format('%s has your parcel and will bring it to you.', v_company),
            'order', 'order', '/orders/' || p_order_id, jsonb_build_object('order_id', p_order_id));
  ELSIF p_action = 'on_the_way' THEN
    UPDATE public.order_deliveries SET accepted_at = COALESCE(accepted_at, now()), picked_up_at = COALESCE(picked_up_at, now())
    WHERE order_id = p_order_id;
    PERFORM public.logistics_add_tracking(p_order_id, 'out_for_delivery', format('%s is on the way to you', v_company), 'out_for_delivery');
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    VALUES (v_order.user_id, 'Your order is on the way',
            format('The %s rider is coming%s. Have your delivery code ready and give it only when the parcel is in your hands.',
                   v_company, CASE WHEN v_delivery.rider_phone IS NOT NULL THEN format(' (%s)', v_delivery.rider_phone) ELSE '' END),
            'order', 'order', '/orders/' || p_order_id, jsonb_build_object('order_id', p_order_id));
  ELSIF p_action = 'problem' THEN
    IF v_note IS NULL THEN
      RAISE EXCEPTION 'Say what the problem is.';
    END IF;
    UPDATE public.order_deliveries SET problem = left(v_note, 500), problem_at = now() WHERE order_id = p_order_id;
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    SELECT ur.user_id, format('Delivery problem: order %s', upper(left(p_order_id::TEXT, 8))),
           format('%s: %s', v_company, left(v_note, 300)), 'warning', 'order', '/admin/orders/' || p_order_id,
           jsonb_build_object('order_id', p_order_id)
    FROM public.user_roles ur WHERE ur.role = 'admin';
  ELSE
    RAISE EXCEPTION 'Unknown action.';
  END IF;
  RETURN p_action;
END;
$$;

/**
 * The rider types the customer's 6-digit code at the door. A right code
 * completes the order exactly like the admin "Mark delivered" (seller's second
 * payment released), unless a dispute is open. Returns {ok, code, message};
 * wrong codes are counted (5 per order per hour) so guessing is pointless.
 */
CREATE OR REPLACE FUNCTION public.logistics_confirm_delivery(p_order_id UUID, p_code TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_delivery public.order_deliveries%ROWTYPE := public.logistics_job(p_order_id);
  v_order public.orders%ROWTYPE;
  v_company TEXT;
  v_release BOOLEAN;
BEGIN
  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF v_order.status IN ('delivered', 'completed') THEN
    RETURN jsonb_build_object('ok', true, 'code', 'already_delivered', 'message', 'This order is already delivered.');
  END IF;
  IF v_order.status IN ('cancelled', 'refunded') THEN
    RETURN jsonb_build_object('ok', false, 'code', 'cancelled', 'message', 'This order was cancelled. Don''t hand over the parcel; call Kano Kaftan.');
  END IF;
  IF NOT public.check_rate_limit('delivery-code:' || p_order_id, 5, 3600) THEN
    RETURN jsonb_build_object('ok', false, 'code', 'too_many',
      'message', 'Too many tries. Ask the customer to check the code in their Kano Kaftan app, or call Kano Kaftan.');
  END IF;
  IF regexp_replace(COALESCE(p_code, ''), '\D', '', 'g') IS DISTINCT FROM v_delivery.pickup_code THEN
    RETURN jsonb_build_object('ok', false, 'code', 'wrong_code',
      'message', 'That code is not right. Ask the customer to read the 6-digit code in their Kano Kaftan app.');
  END IF;

  SELECT name INTO v_company FROM public.logistics_companies WHERE id = v_delivery.company_id;
  v_release := v_order.escrow_status = 'held' AND COALESCE(v_order.dispute_status, '') <> 'open';

  UPDATE public.order_deliveries
  SET delivered_at = now(), accepted_at = COALESCE(accepted_at, now()), picked_up_at = COALESCE(picked_up_at, now())
  WHERE order_id = p_order_id;

  UPDATE public.orders
  SET status = CASE WHEN v_release THEN 'completed' ELSE 'delivered' END,
      confirmed_at = CASE WHEN v_release THEN now() ELSE confirmed_at END,
      escrow_status = CASE WHEN v_release THEN 'released' ELSE escrow_status END,
      shipped_at = COALESCE(shipped_at, now()),
      tracking_updates = COALESCE(tracking_updates, '[]'::JSONB) || jsonb_build_array(jsonb_build_object(
        'status', 'delivered', 'message', format('Delivered by %s (delivery code checked)', v_company), 'timestamp', now()))
  WHERE id = p_order_id;

  IF v_release THEN
    UPDATE public.payouts SET status = 'pending' WHERE order_id = p_order_id AND tranche = 2 AND status = 'held';
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
  VALUES (v_order.user_id, 'Delivered', 'Your order was delivered. Open it to leave a review for the seller.',
          'success', 'order', '/orders/' || p_order_id, jsonb_build_object('order_id', p_order_id));
  RETURN jsonb_build_object('ok', true, 'code', 'delivered', 'message', 'Delivered. Thank you!');
END;
$$;

-- ---------------------------------------------------------------------------
-- Tell the company when a delivery is assigned to it
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_logistics_assignment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.company_id IS NULL OR (TG_OP = 'UPDATE' AND NEW.company_id IS NOT DISTINCT FROM OLD.company_id) THEN
    RETURN NEW;
  END IF;
  INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
  SELECT m.user_id, 'New delivery for you',
         format('Order %s needs a rider. Open your delivery dashboard to accept it.', upper(left(NEW.order_id::TEXT, 8))),
         'info', 'order', '/delivery', jsonb_build_object('order_id', NEW.order_id, 'kind', 'logistics_assigned')
  FROM public.logistics_members m WHERE m.company_id = NEW.company_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER order_deliveries_notify_logistics
  AFTER INSERT OR UPDATE OF company_id ON public.order_deliveries
  FOR EACH ROW EXECUTE FUNCTION public.notify_logistics_assignment();

-- ---------------------------------------------------------------------------
-- Admin: logins per company, and opening a chat with a company
-- ---------------------------------------------------------------------------

/** Who has signed in for each company (for the Logistics page). */
CREATE OR REPLACE FUNCTION public.admin_logistics_members()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN COALESCE((
    SELECT jsonb_object_agg(company_id, members) FROM (
      SELECT m.company_id, jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email,
                                                         'name', COALESCE(NULLIF(btrim(p.full_name), ''), u.email)) ORDER BY m.created_at) AS members
      FROM public.logistics_members m
      JOIN auth.users u ON u.id = m.user_id
      LEFT JOIN public.profiles p ON p.id = m.user_id
      GROUP BY m.company_id
    ) x
  ), '{}'::JSONB);
END;
$$;

/** Opens (or reuses) the support chat with one of a company's logins, so the admin can message them. */
CREATE OR REPLACE FUNCTION public.admin_open_user_chat(p_user_id UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  PERFORM public.require_admin();
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'That account was not found.';
  END IF;
  INSERT INTO public.conversations (customer_id, vendor_id, product_id, kind)
  VALUES (p_user_id, NULL, NULL, 'support')
  ON CONFLICT (customer_id) WHERE kind = 'support' DO UPDATE SET customer_id = EXCLUDED.customer_id
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.my_logistics_company_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_logistics_company_id() TO authenticated;
REVOKE ALL ON FUNCTION public.require_logistics_company() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.delivery_stage(public.order_deliveries, public.orders) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.logistics_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.logistics_dashboard() TO authenticated;
REVOKE ALL ON FUNCTION public.logistics_job(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.logistics_add_tracking(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.logistics_update_job(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.logistics_update_job(UUID, TEXT, TEXT, TEXT, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.logistics_confirm_delivery(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.logistics_confirm_delivery(UUID, TEXT) TO authenticated;
REVOKE ALL ON FUNCTION public.notify_logistics_assignment() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_logistics_members() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_logistics_members() TO authenticated;
REVOKE ALL ON FUNCTION public.admin_open_user_chat(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_open_user_chat(UUID) TO authenticated;
