-- Private profile fields.
--
-- Two SELECT policies on profiles ("Public profiles viewable" USING (true), and
-- "Anyone can view vendor store info") let anyone, signed out included, read
-- every column of every profile: email, phone, exact address and bank account.
-- Names, photos and shop details are meant to be public (reviews, shop pages,
-- chat), so rows stay visible; the private COLUMNS are taken away from the API
-- roles instead, and handed out only by get_profile_private():
--   * yourself and admins: everything;
--   * a seller: email and phone of buyers who ordered from them (delivery);
--   * shop_pickup_points(): only map position and town of shops, for checkout.

-- Public columns only, for everyone.
REVOKE SELECT ON public.profiles FROM anon, authenticated;
GRANT SELECT (
  id, full_name, avatar_url, created_at, updated_at,
  store_name, store_description, store_slug, store_banner_url,
  is_verified, verified_until, shop_featured_until, verification_tier, last_seen_at
) ON public.profiles TO anon, authenticated;

-- Your own preferences (rows are still limited by RLS to what you can see).
GRANT SELECT (notification_push, notification_orders, notification_promotions, preferred_language, preferred_currency)
  ON public.profiles TO authenticated;

-- Signed-out visitors never write profiles.
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.profiles FROM anon;

-- The vendor search view must not hand out addresses either: town only, and it
-- runs as its owner so it doesn't need the private column itself.
CREATE OR REPLACE VIEW public.public_vendor_profiles
WITH (security_invoker = false) AS
SELECT id,
       full_name,
       avatar_url,
       is_verified,
       store_name,
       store_slug,
       store_banner_url,
       store_description,
       jsonb_strip_nulls(jsonb_build_object('city', store_address ->> 'city', 'state', store_address ->> 'state')) AS store_address,
       CASE WHEN is_verified THEN verification_tier ELSE NULL::text END AS verification_tier
FROM public.profiles
WHERE store_name IS NOT NULL;

/** Private fields for the given people, limited to what the caller may see. */
CREATE OR REPLACE FUNCTION public.get_profile_private(p_ids UUID[])
RETURNS TABLE (
  id UUID, email TEXT, phone TEXT, store_address JSONB,
  bank_name TEXT, account_number TEXT, account_name TEXT, payout_preference TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me UUID := auth.uid();
  v_admin BOOLEAN := public.has_role(auth.uid(), 'admin');
BEGIN
  IF v_me IS NULL THEN
    RETURN;
  END IF;
  RETURN QUERY
  SELECT p.id,
         p.email,
         p.phone,
         CASE WHEN full_access THEN p.store_address END,
         CASE WHEN full_access THEN p.bank_name END,
         CASE WHEN full_access THEN p.account_number END,
         CASE WHEN full_access THEN p.account_name END,
         CASE WHEN full_access THEN p.payout_preference END
  FROM public.profiles p
  CROSS JOIN LATERAL (SELECT (v_admin OR p.id = v_me) AS full_access) a
  WHERE p.id = ANY (p_ids)
    AND (
      a.full_access
      -- Sellers may contact buyers who ordered from them.
      OR EXISTS (
        SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.vendor_id = v_me AND o.user_id = p.id
      )
    );
END;
$$;

/** Where shops are, for delivery prices at checkout: position and town, nothing else. */
CREATE OR REPLACE FUNCTION public.shop_pickup_points(p_ids UUID[])
RETURNS TABLE (id UUID, latitude DOUBLE PRECISION, longitude DOUBLE PRECISION, city TEXT, state TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id,
         NULLIF(p.store_address ->> 'latitude', '')::DOUBLE PRECISION,
         NULLIF(p.store_address ->> 'longitude', '')::DOUBLE PRECISION,
         p.store_address ->> 'city',
         p.store_address ->> 'state'
  FROM public.profiles p
  WHERE p.id = ANY (p_ids) AND p.store_name IS NOT NULL;
$$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.get_profile_private(UUID[]) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.get_profile_private(UUID[]) TO authenticated;
  REVOKE ALL ON FUNCTION public.shop_pickup_points(UUID[]) FROM PUBLIC;
  GRANT EXECUTE ON FUNCTION public.shop_pickup_points(UUID[]) TO anon, authenticated;
END $$;
