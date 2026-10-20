-- Shops page: every approved shop appears, not only shops with products.
-- Shops with no products yet are listed after the others. Product counts are
-- live (new shops show up as soon as they're approved, not after the
-- 10-minute stats refresh); followers, sales and ratings still come from
-- shop_stats.

CREATE OR REPLACE FUNCTION public.directory_shops()
RETURNS TABLE(id uuid, store_name text, store_slug text, store_description text, avatar_url text, store_banner_url text,
              is_verified boolean, verification_tier text, city text, state text, joined_at timestamp with time zone,
              product_count bigint, follower_count bigint, items_sold bigint, rating numeric, review_count bigint,
              shop_type text, latitude numeric, longitude numeric, location_precise boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.store_name, p.store_slug, p.store_description, p.avatar_url, p.store_banner_url,
         p.is_verified, CASE WHEN p.is_verified THEN p.verification_tier END,
         public.shop_town(p.store_address), p.store_address ->> 'state', p.created_at,
         (SELECT count(*) FROM public.products pr WHERE pr.vendor_id = p.id AND pr.is_active),
         COALESCE(st.follower_count, 0), COALESCE(st.items_sold, 0), st.rating, COALESCE(st.review_count, 0),
         public.shop_type_of(p.id, p.store_name, p.store_description),
         CASE WHEN (p.store_address ->> 'latitude') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (p.store_address ->> 'latitude')::NUMERIC END,
         CASE WHEN (p.store_address ->> 'longitude') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (p.store_address ->> 'longitude')::NUMERIC END,
         COALESCE((p.store_address ->> 'location_precise')::BOOLEAN, false)
  FROM public.profiles p
  LEFT JOIN public.shop_stats st ON st.vendor_id = p.id
  WHERE p.store_name IS NOT NULL
    AND public.has_role(p.id, 'vendor')
$function$;

CREATE OR REPLACE FUNCTION public.shop_directory(p_search text DEFAULT NULL::text, p_badge text DEFAULT 'all'::text, p_type text DEFAULT 'all'::text,
  p_town text DEFAULT NULL::text, p_sort text DEFAULT 'recommended'::text, p_lat numeric DEFAULT NULL::numeric, p_lng numeric DEFAULT NULL::numeric,
  p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid, store_name text, store_slug text, store_description text, avatar_url text, store_banner_url text, is_verified boolean,
              verification_tier text, city text, state text, joined_at timestamp with time zone, product_count bigint, follower_count bigint,
              items_sold bigint, rating numeric, review_count bigint, shop_type text, location_precise boolean, distance_km numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  WITH s AS (
    SELECT d.*,
      CASE WHEN p_lat IS NOT NULL AND p_lng IS NOT NULL AND d.latitude IS NOT NULL AND d.longitude IS NOT NULL
           THEN public.distance_km(p_lat, p_lng, d.latitude, d.longitude) END AS raw_distance
    FROM public.directory_shops() d
    WHERE (p_search IS NULL OR btrim(p_search) = ''
           OR d.store_name ILIKE '%' || btrim(p_search) || '%'
           OR d.city ILIKE '%' || btrim(p_search) || '%')
      AND (COALESCE(p_badge, 'all') = 'all'
           OR (p_badge = 'gold' AND d.verification_tier = 'gold')
           OR (p_badge = 'verified' AND d.is_verified)
           OR (p_badge = 'unverified' AND NOT d.is_verified))
      AND (COALESCE(p_type, 'all') = 'all' OR d.shop_type = p_type)
      AND (p_town IS NULL OR btrim(p_town) = '' OR lower(d.city) = lower(btrim(p_town)))
  )
  SELECT s.id, s.store_name, s.store_slug, s.store_description, s.avatar_url, s.store_banner_url,
         s.is_verified, s.verification_tier, s.city, s.state, s.joined_at,
         s.product_count, s.follower_count, s.items_sold, s.rating, s.review_count,
         s.shop_type, s.location_precise,
         CASE WHEN s.location_precise THEN round(s.raw_distance, 1) END
  FROM s
  ORDER BY
    (s.product_count > 0) DESC,
    CASE WHEN p_sort = 'near' THEN s.raw_distance END ASC NULLS LAST,
    CASE WHEN p_sort = 'near' AND s.location_precise THEN 0 ELSE 1 END,
    CASE WHEN p_sort = 'followers' THEN s.follower_count END DESC NULLS LAST,
    CASE WHEN p_sort = 'newest' THEN s.joined_at END DESC NULLS LAST,
    CASE WHEN p_sort = 'rating' THEN s.rating END DESC NULLS LAST,
    CASE WHEN p_sort = 'rating' THEN s.review_count END DESC NULLS LAST,
    (s.verification_tier = 'gold') DESC NULLS LAST, s.is_verified DESC,
    s.follower_count DESC, s.items_sold DESC, s.product_count DESC, s.store_name
  LIMIT LEAST(GREATEST(p_limit, 1), 60)
  OFFSET GREATEST(p_offset, 0)
$function$;
