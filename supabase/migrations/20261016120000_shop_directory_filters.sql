-- Shop directory: filters (gold / verified / unverified, tailors / sellers),
-- counts for the filter chips, and paging for thousands of shops.
--
-- The shop type lives in its own small table (not a profiles column) so adding
-- it never locks the busy profiles table. Shops that haven't chosen yet are
-- guessed from their name and description ("tailor", "dinki", "made to measure"…).

CREATE TABLE IF NOT EXISTS public.shop_types (
  vendor_id UUID PRIMARY KEY,
  shop_type TEXT NOT NULL CHECK (shop_type IN ('tailor', 'seller')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can see shop types" ON public.shop_types;
CREATE POLICY "Anyone can see shop types" ON public.shop_types FOR SELECT USING (true);

/** The shop's chosen type, or a guess from its name and description. */
CREATE OR REPLACE FUNCTION public.shop_type_of(p_vendor_id UUID, p_name TEXT, p_description TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT st.shop_type FROM public.shop_types st WHERE st.vendor_id = p_vendor_id),
    CASE WHEN concat_ws(' ', p_name, p_description) ~* '(tailor|stitch|sew|sewing|dinki|telo|bespoke|made[ -]to[ -]measure|fashion designer|couture)'
         THEN 'tailor' ELSE 'seller' END
  )
$$;

/**
 * Shops for the directory. p_badge: all | gold | verified | unverified
 * ("verified" includes gold). p_type: all | tailor | seller.
 * Same order as before: gold, verified, then most followed and best selling.
 */
CREATE OR REPLACE FUNCTION public.browse_shops(
  p_search TEXT DEFAULT NULL,
  p_badge TEXT DEFAULT 'all',
  p_type TEXT DEFAULT 'all',
  p_limit INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID, store_name TEXT, store_slug TEXT, store_description TEXT, avatar_url TEXT, store_banner_url TEXT,
  is_verified BOOLEAN, city TEXT, state TEXT, joined_at TIMESTAMPTZ,
  product_count BIGINT, follower_count BIGINT, items_sold BIGINT, rating NUMERIC, review_count BIGINT,
  verification_tier TEXT, shop_type TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT s.*, public.shop_type_of(s.id, s.store_name, s.store_description) AS shop_type
    FROM public.shop_summaries() s
    WHERE s.product_count > 0
      AND (p_search IS NULL OR btrim(p_search) = ''
           OR s.store_name ILIKE '%' || btrim(p_search) || '%'
           OR s.city ILIKE '%' || btrim(p_search) || '%')
  )
  SELECT s.id, s.store_name, s.store_slug, s.store_description, s.avatar_url, s.store_banner_url,
         s.is_verified, s.city, s.state, s.joined_at,
         s.product_count, s.follower_count, s.items_sold, s.rating, s.review_count,
         s.verification_tier, s.shop_type
  FROM s
  WHERE (COALESCE(p_badge, 'all') = 'all'
         OR (p_badge = 'gold' AND s.verification_tier = 'gold')
         OR (p_badge = 'verified' AND s.is_verified)
         OR (p_badge = 'unverified' AND NOT s.is_verified))
    AND (COALESCE(p_type, 'all') = 'all' OR s.shop_type = p_type)
  ORDER BY (s.verification_tier = 'gold') DESC NULLS LAST, s.is_verified DESC,
           s.follower_count DESC, s.items_sold DESC, s.product_count DESC, s.store_name
  LIMIT LEAST(GREATEST(p_limit, 1), 60)
  OFFSET GREATEST(p_offset, 0)
$$;

/**
 * Numbers for the filter chips, for the current search. Badge chips count
 * within the chosen shop type; type tabs count within the chosen badge.
 */
CREATE OR REPLACE FUNCTION public.shop_filter_counts(p_search TEXT DEFAULT NULL, p_badge TEXT DEFAULT 'all', p_type TEXT DEFAULT 'all')
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT s.is_verified, s.verification_tier, public.shop_type_of(s.id, s.store_name, s.store_description) AS shop_type
    FROM public.shop_summaries() s
    WHERE s.product_count > 0
      AND (p_search IS NULL OR btrim(p_search) = ''
           OR s.store_name ILIKE '%' || btrim(p_search) || '%'
           OR s.city ILIKE '%' || btrim(p_search) || '%')
  ), b AS (
    SELECT *,
      (COALESCE(p_type, 'all') = 'all' OR shop_type = p_type) AS in_type,
      (COALESCE(p_badge, 'all') = 'all'
        OR (p_badge = 'gold' AND verification_tier = 'gold')
        OR (p_badge = 'verified' AND is_verified)
        OR (p_badge = 'unverified' AND NOT is_verified)) AS in_badge
    FROM s
  )
  SELECT jsonb_build_object(
    'total', count(*),
    'all', count(*) FILTER (WHERE in_type),
    'gold', count(*) FILTER (WHERE in_type AND verification_tier = 'gold'),
    'verified', count(*) FILTER (WHERE in_type AND is_verified),
    'unverified', count(*) FILTER (WHERE in_type AND NOT is_verified),
    'everyone', count(*) FILTER (WHERE in_badge),
    'tailor', count(*) FILTER (WHERE in_badge AND shop_type = 'tailor'),
    'seller', count(*) FILTER (WHERE in_badge AND shop_type = 'seller')
  )
  FROM b
$$;

/** A seller says whether their shop is a tailor or sells ready-made items. */
CREATE OR REPLACE FUNCTION public.set_my_shop_type(p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'vendor') THEN
    RAISE EXCEPTION 'Only sellers can set a shop type';
  END IF;
  IF p_type NOT IN ('tailor', 'seller') THEN
    RAISE EXCEPTION 'Choose tailor or seller';
  END IF;
  INSERT INTO public.shop_types (vendor_id, shop_type) VALUES (auth.uid(), p_type)
  ON CONFLICT (vendor_id) DO UPDATE SET shop_type = EXCLUDED.shop_type, updated_at = now();
  RETURN p_type;
END;
$$;

/** The current shop type for the signed-in seller (chosen or guessed). */
CREATE OR REPLACE FUNCTION public.my_shop_type()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.shop_type_of(p.id, p.store_name, p.store_description) FROM public.profiles p WHERE p.id = auth.uid()
$$;

REVOKE ALL ON FUNCTION public.browse_shops(TEXT, TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_filter_counts(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_my_shop_type(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_shop_type() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.browse_shops(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_filter_counts(TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_my_shop_type(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_shop_type() TO authenticated;
