-- Phone number, exact shop location and payout bank account are compulsory
-- for sellers. Without all three a seller cannot add a product or switch one
-- back on (products already live stay live). Admins are not blocked, so they
-- can still list products for a seller.

SET lock_timeout = '10s';

/** What a seller still has to do before selling. */
CREATE OR REPLACE FUNCTION public.vendor_setup_status(p_vendor_id UUID)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH p AS (
    SELECT
      regexp_replace(COALESCE(phone, ''), '\D', '', 'g') ~ '^(234|0)?[789][01][0-9]{8}$' AS has_phone,
      (store_address ->> 'latitude') IS NOT NULL
        AND (store_address ->> 'longitude') IS NOT NULL
        AND COALESCE((store_address ->> 'location_precise')::BOOLEAN, false) AS has_location
    FROM public.profiles WHERE id = p_vendor_id
  ), a AS (
    SELECT EXISTS (
      SELECT 1 FROM public.vendor_payout_accounts v WHERE v.vendor_id = p_vendor_id AND v.recipient_code IS NOT NULL
    ) AS has_payout
  )
  SELECT jsonb_build_object(
    'has_phone', COALESCE(p.has_phone, false),
    'has_location', COALESCE(p.has_location, false),
    'has_payout', a.has_payout,
    'complete', COALESCE(p.has_phone, false) AND COALESCE(p.has_location, false) AND a.has_payout
  )
  FROM a LEFT JOIN p ON true
$$;

-- Only yes/no flags; the product check runs as the seller, so signed-in users may call it.
REVOKE ALL ON FUNCTION public.vendor_setup_status(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_setup_status(UUID) TO authenticated;

/** The signed-in seller's setup status. */
CREATE OR REPLACE FUNCTION public.my_shop_setup()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.vendor_setup_status(auth.uid())
$$;

REVOKE ALL ON FUNCTION public.my_shop_setup() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_shop_setup() TO authenticated;

-- Not SECURITY DEFINER: is_client_request() must see the real caller.
CREATE OR REPLACE FUNCTION public.guard_product_needs_setup()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_status JSONB;
  v_missing TEXT[] := '{}';
BEGIN
  IF NOT public.is_client_request() OR public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;
  IF NOT COALESCE(NEW.is_active, true) OR (TG_OP = 'UPDATE' AND COALESCE(OLD.is_active, false)) THEN
    RETURN NEW; -- only adding a product or switching one on is checked
  END IF;

  v_status := public.vendor_setup_status(NEW.vendor_id);
  IF (v_status ->> 'complete')::BOOLEAN THEN
    RETURN NEW;
  END IF;

  IF NOT (v_status ->> 'has_phone')::BOOLEAN THEN v_missing := array_append(v_missing, 'your phone number'); END IF;
  IF NOT (v_status ->> 'has_location')::BOOLEAN THEN v_missing := array_append(v_missing, 'your exact shop location'); END IF;
  IF NOT (v_status ->> 'has_payout')::BOOLEAN THEN v_missing := array_append(v_missing, 'your bank account for payouts'); END IF;
  RAISE EXCEPTION 'Finish your shop setup first: add %. Go to Settings.', array_to_string(v_missing, ', ')
    USING ERRCODE = 'P0001';
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_product_needs_setup() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS products_need_seller_setup ON public.products;
CREATE TRIGGER products_need_seller_setup
BEFORE INSERT OR UPDATE OF is_active ON public.products
FOR EACH ROW EXECUTE FUNCTION public.guard_product_needs_setup();

-- Tell current sellers who are missing something.
INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
SELECT ur.user_id, 'Finish your shop setup',
       'Your phone number, exact shop location and bank account are now required to add products. Open Settings to complete them.',
       'warning', 'system', '/vendor/settings'
FROM public.user_roles ur
WHERE ur.role = 'vendor' AND NOT (public.vendor_setup_status(ur.user_id) ->> 'complete')::BOOLEAN;
