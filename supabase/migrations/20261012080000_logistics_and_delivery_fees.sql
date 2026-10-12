-- Logistics companies, automatic delivery assignment + pickup code on payment,
-- and higher in-app delivery fees (never below ₦1,500).

-- ── Delivery companies ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.logistics_companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (btrim(name) <> ''),
  contact_name TEXT,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  -- Places this company covers, e.g. LGAs ("Nasarawa", "Fagge") or
  -- neighbourhoods ("Sabon Gari", "Hotoro"). Matched against the delivery address.
  areas TEXT[] NOT NULL DEFAULT '{}',
  -- Used when no other company covers the customer's address.
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- Lower number wins when two companies cover the same place.
  priority INTEGER NOT NULL DEFAULT 100,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.logistics_companies ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'logistics_companies' AND policyname = 'Admins manage logistics companies') THEN
    CREATE POLICY "Admins manage logistics companies" ON public.logistics_companies
      FOR ALL USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
  END IF;
END $$;

CREATE OR REPLACE TRIGGER update_logistics_companies_updated_at
  BEFORE UPDATE ON public.logistics_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Delivery record per order ─────────────────────────────────────────────
ALTER TABLE public.order_deliveries
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.logistics_companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS company_phone TEXT,
  ADD COLUMN IF NOT EXISTS assigned_automatically BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;
-- A pickup code exists from the moment of payment, even before a company is chosen.
ALTER TABLE public.order_deliveries ALTER COLUMN delivery_company DROP NOT NULL;
CREATE INDEX IF NOT EXISTS order_deliveries_company_idx ON public.order_deliveries (company_id);

-- Existing deliveries were all sent by hand.
UPDATE public.order_deliveries SET dispatched_at = COALESCE(dispatched_at, created_at) WHERE delivery_company IS NOT NULL AND dispatched_at IS NULL;

/** Six random digits from a strong random source. */
CREATE OR REPLACE FUNCTION public.new_pickup_code()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = public
AS $$
  SELECT lpad((('x' || substr(md5(gen_random_uuid()::text), 1, 8))::bit(32)::bigint % 1000000)::text, 6, '0')
$$;

/** Lower-case words only, padded with spaces, so " sabon gari " matches whole words. */
CREATE OR REPLACE FUNCTION public.address_match_text(p_address JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT ' ' || btrim(regexp_replace(lower(concat_ws(' ',
    p_address ->> 'street_address', p_address ->> 'landmark', p_address ->> 'city', p_address ->> 'state'
  )), '[^a-z0-9]+', ' ', 'g')) || ' '
$$;

/**
 * The delivery company for an address: the active company naming the most
 * specific matching area (longest name), then by priority; else the default.
 */
CREATE OR REPLACE FUNCTION public.pick_logistics_company(p_address JSONB)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH addr AS (SELECT public.address_match_text(p_address) AS t),
  matches AS (
    SELECT c.id, c.priority, max(length(a.area)) AS best
    FROM public.logistics_companies c
    CROSS JOIN LATERAL unnest(c.areas) AS a(area)
    CROSS JOIN addr
    WHERE c.is_active
      AND btrim(a.area) <> ''
      AND addr.t LIKE '% ' || btrim(regexp_replace(lower(a.area), '[^a-z0-9]+', ' ', 'g')) || ' %'
    GROUP BY c.id, c.priority
  )
  SELECT id FROM (
    SELECT id, 0 AS fallback, best, priority FROM matches
    UNION ALL
    SELECT id, 1, 0, priority FROM public.logistics_companies WHERE is_active AND is_default
  ) candidates
  ORDER BY fallback, best DESC, priority, id
  LIMIT 1
$$;

/** On payment: create the pickup code, choose a company and tell the customer. */
CREATE OR REPLACE FUNCTION public.assign_delivery_on_payment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company public.logistics_companies%ROWTYPE;
  v_company_id UUID;
  v_code TEXT;
BEGIN
  IF EXISTS (SELECT 1 FROM public.order_deliveries WHERE order_id = NEW.id) THEN
    RETURN NEW;
  END IF;

  v_company_id := public.pick_logistics_company(NEW.shipping_address);
  IF v_company_id IS NOT NULL THEN
    SELECT * INTO v_company FROM public.logistics_companies WHERE id = v_company_id;
  END IF;
  v_code := public.new_pickup_code();

  INSERT INTO public.order_deliveries (order_id, delivery_company, company_id, company_phone, pickup_code, assigned_automatically)
  VALUES (NEW.id, v_company.name, v_company_id, COALESCE(v_company.phone, v_company.whatsapp), v_code, v_company_id IS NOT NULL)
  ON CONFLICT (order_id) DO NOTHING;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
  VALUES (
    NEW.user_id,
    'Payment received. Your delivery code: ' || v_code,
    CASE WHEN v_company_id IS NOT NULL
      THEN format('%s will deliver your order. Give the rider code %s only when your parcel is in your hands.', v_company.name, v_code)
      ELSE format('We''re arranging your delivery. Give the rider code %s only when your parcel is in your hands.', v_code)
    END,
    'success', 'order', '/orders/' || NEW.id,
    jsonb_build_object('order_id', NEW.id, 'kind', 'pickup_code')
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never undo a payment because delivery set-up failed; the admin can assign by hand.
  RAISE WARNING 'assign_delivery_on_payment failed for order %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER orders_assign_delivery_on_payment
  AFTER UPDATE OF payment_status ON public.orders
  FOR EACH ROW
  WHEN (NEW.payment_status = 'paid' AND OLD.payment_status IS DISTINCT FROM 'paid')
  EXECUTE FUNCTION public.assign_delivery_on_payment();

/**
 * Admin hands the parcel to the company: confirm/change the company and code,
 * mark the order shipped and tell the customer.
 */
CREATE OR REPLACE FUNCTION public.admin_dispatch_delivery(
  p_order_id UUID,
  p_company_id UUID,
  p_pickup_code TEXT DEFAULT NULL,
  p_tracking_reference TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order public.orders%ROWTYPE;
  v_company public.logistics_companies%ROWTYPE;
  v_code TEXT;
  v_code_changed BOOLEAN;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.payment_status <> 'paid' THEN
    RAISE EXCEPTION 'The customer has not paid for this order yet';
  END IF;

  SELECT * INTO v_company FROM public.logistics_companies WHERE id = p_company_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Choose a delivery company';
  END IF;

  v_code := NULLIF(regexp_replace(COALESCE(p_pickup_code, ''), '\s', '', 'g'), '');
  IF v_code IS NULL THEN
    v_code := COALESCE((SELECT pickup_code FROM public.order_deliveries WHERE order_id = p_order_id), public.new_pickup_code());
  END IF;
  v_code_changed := v_code IS DISTINCT FROM (SELECT pickup_code FROM public.order_deliveries WHERE order_id = p_order_id);

  INSERT INTO public.order_deliveries (order_id, delivery_company, company_id, company_phone, pickup_code, tracking_reference, created_by, dispatched_at)
  VALUES (p_order_id, v_company.name, v_company.id, COALESCE(v_company.phone, v_company.whatsapp), v_code,
          NULLIF(btrim(p_tracking_reference), ''), auth.uid(), now())
  ON CONFLICT (order_id) DO UPDATE
  SET delivery_company = EXCLUDED.delivery_company,
      company_id = EXCLUDED.company_id,
      company_phone = EXCLUDED.company_phone,
      pickup_code = EXCLUDED.pickup_code,
      tracking_reference = EXCLUDED.tracking_reference,
      assigned_automatically = false,
      dispatched_at = COALESCE(public.order_deliveries.dispatched_at, now());

  UPDATE public.orders
  SET status = CASE WHEN status IN ('payment_confirmed', 'processing', 'ready_for_pickup') THEN 'shipped' ELSE status END,
      tracking_updates = COALESCE(tracking_updates, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
        'status', 'shipped',
        'message', format('Sent with %s', v_company.name),
        'timestamp', now()
      ))
  WHERE id = p_order_id;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
  VALUES (
    v_order.user_id, 'Your order is on its way',
    format('%s is delivering it.%s Give the rider code %s when your parcel arrives.',
           v_company.name, CASE WHEN v_code_changed THEN ' Your code has changed.' ELSE '' END, v_code),
    'order', 'order', '/orders/' || p_order_id,
    jsonb_build_object('order_id', p_order_id)
  );
END;
$$;

/** Admin list: every delivery that is paid but not yet delivered, with its company. */
CREATE OR REPLACE FUNCTION public.admin_logistics_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Admins only';
  END IF;
  RETURN jsonb_build_object(
    'open_by_company', COALESCE((
      SELECT jsonb_object_agg(COALESCE(d.company_id::text, 'unassigned'), n)
      FROM (
        SELECT d.company_id, count(*) AS n
        FROM public.order_deliveries d JOIN public.orders o ON o.id = d.order_id
        WHERE o.payment_status = 'paid' AND o.status NOT IN ('delivered', 'completed', 'cancelled', 'refunded')
        GROUP BY d.company_id
      ) d
    ), '{}'::jsonb),
    'waiting_dispatch', (
      SELECT count(*) FROM public.order_deliveries d JOIN public.orders o ON o.id = d.order_id
      WHERE o.payment_status = 'paid' AND d.dispatched_at IS NULL AND o.status NOT IN ('cancelled', 'refunded')
    )
  );
END;
$$;

-- ── Delivery fees: higher, and never below ₦1,500 ─────────────────────────
CREATE OR REPLACE FUNCTION public.shipping_min_fee()
RETURNS NUMERIC LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT 1500::NUMERIC $$;

CREATE OR REPLACE FUNCTION public.shipping_base_fee(p_distance_km NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_distance_km IS NULL THEN 2500
    WHEN p_distance_km <= 5 THEN 1500
    WHEN p_distance_km <= 10 THEN 2000
    WHEN p_distance_km <= 20 THEN 2500
    WHEN p_distance_km <= 35 THEN 3500
    WHEN p_distance_km <= 60 THEN 5000
    WHEN p_distance_km <= 120 THEN 7000
    WHEN p_distance_km <= 300 THEN 9500
    WHEN p_distance_km <= 600 THEN 12000
    ELSE 15000
  END::NUMERIC
$$;

-- Big orders still get money off delivery, but the fee never drops below the minimum.
CREATE OR REPLACE FUNCTION public.shipping_value_discount(p_subtotal NUMERIC)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN p_subtotal >= 500000 THEN 0.50
    WHEN p_subtotal >= 200000 THEN 0.30
    WHEN p_subtotal >= 100000 THEN 0.20
    WHEN p_subtotal >= 50000 THEN 0.10
    ELSE 0
  END::NUMERIC
$$;

/** Final in-app delivery fee. Only a "free delivery" promo code goes below the minimum. */
CREATE OR REPLACE FUNCTION public.shipping_final_fee(p_base_fee NUMERIC, p_discount NUMERIC, p_free BOOLEAN DEFAULT false)
RETURNS NUMERIC
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE WHEN p_free THEN 0
              ELSE GREATEST(public.shipping_min_fee(), p_base_fee - round(p_base_fee * LEAST(GREATEST(p_discount, 0), 1)))
         END
$$;

-- The ₦1,500 floor is enforced when an in-app order is saved (admin-made
-- "concierge" orders keep the fee the admin typed). place_order() already
-- charges shipping_base_fee() minus shipping_value_discount(); this trigger
-- lifts anything under the minimum. A free-delivery promo (fee 0) is untouched.
CREATE OR REPLACE FUNCTION public.enforce_min_delivery_fee()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.delivery_type, '') <> 'concierge'
     AND NEW.shipping_fee > 0 AND NEW.shipping_fee < public.shipping_min_fee() THEN
    NEW.total := NEW.total + (public.shipping_min_fee() - NEW.shipping_fee);
    NEW.shipping_fee := public.shipping_min_fee();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.enforce_min_delivery_fee() FROM PUBLIC, anon, authenticated;
CREATE OR REPLACE TRIGGER orders_enforce_min_delivery_fee
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_min_delivery_fee();

-- ── Access ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.assign_delivery_on_payment() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pick_logistics_company(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.new_pickup_code() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_dispatch_delivery(UUID, UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_logistics_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dispatch_delivery(UUID, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_logistics_overview() TO authenticated;
