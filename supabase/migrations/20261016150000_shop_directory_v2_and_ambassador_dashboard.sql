-- Shop directory v2 and ambassador dashboards.
--
-- 1. shop_stats: product / follower / sales / rating totals kept in a table and
--    refreshed every 10 minutes, so the directory doesn't recount every shop's
--    orders and reviews on each page load (matters at 1,000+ shops).
-- 2. shop_directory(): adds "Near me" (distance from the shopper), a town
--    filter and sort options. Distances are only shown as exact when the seller
--    saved their exact spot (store_address.location_precise); shops placed at a
--    town centre sort by town but never claim a distance.
-- 3. admin_set_shop_type(): admins can correct Tailor / Seller.
-- 4. Ambassador dashboard: an ambassador signs in with the email the admin
--    registered (linked automatically) or is linked by an admin, then sees
--    their link, sellers and earnings.
--
-- Nothing here drops or deletes: new functions get new names.

SET lock_timeout = '10s';

-- ---------------------------------------------------------------------------
-- 1. Cached shop totals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.shop_stats (
  vendor_id UUID PRIMARY KEY,
  product_count BIGINT NOT NULL DEFAULT 0,
  follower_count BIGINT NOT NULL DEFAULT 0,
  items_sold BIGINT NOT NULL DEFAULT 0,
  rating NUMERIC,
  review_count BIGINT NOT NULL DEFAULT 0,
  refreshed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.shop_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can see shop stats" ON public.shop_stats;
CREATE POLICY "Anyone can see shop stats" ON public.shop_stats FOR SELECT USING (true);

CREATE OR REPLACE FUNCTION public.refresh_shop_stats()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  INSERT INTO public.shop_stats (vendor_id, product_count, follower_count, items_sold, rating, review_count, refreshed_at)
  SELECT s.id, s.product_count, s.follower_count, s.items_sold, s.rating, s.review_count, now()
  FROM public.shop_summaries() s
  ON CONFLICT (vendor_id) DO UPDATE SET
    product_count = EXCLUDED.product_count,
    follower_count = EXCLUDED.follower_count,
    items_sold = EXCLUDED.items_sold,
    rating = EXCLUDED.rating,
    review_count = EXCLUDED.review_count,
    refreshed_at = EXCLUDED.refreshed_at;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.refresh_shop_stats() FROM PUBLIC, anon, authenticated;

-- Run once now, then every 10 minutes.
SELECT public.refresh_shop_stats();
SELECT cron.schedule('shop-stats-refresh', '*/10 * * * *', 'SELECT public.refresh_shop_stats()');

-- ---------------------------------------------------------------------------
-- 2. Directory with location, towns and sorting
-- ---------------------------------------------------------------------------

/** Tidy town name for grouping: "  sabon gari east " -> "Sabon Gari East". */
CREATE OR REPLACE FUNCTION public.shop_town(p_store_address JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(initcap(btrim(regexp_replace(COALESCE(p_store_address ->> 'city', ''), '\s+', ' ', 'g'))), '')
$$;

/** Shops in the directory with their cached totals, type and location. */
CREATE OR REPLACE FUNCTION public.directory_shops()
RETURNS TABLE (
  id UUID, store_name TEXT, store_slug TEXT, store_description TEXT, avatar_url TEXT, store_banner_url TEXT,
  is_verified BOOLEAN, verification_tier TEXT, city TEXT, state TEXT, joined_at TIMESTAMPTZ,
  product_count BIGINT, follower_count BIGINT, items_sold BIGINT, rating NUMERIC, review_count BIGINT,
  shop_type TEXT, latitude NUMERIC, longitude NUMERIC, location_precise BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.store_name, p.store_slug, p.store_description, p.avatar_url, p.store_banner_url,
         p.is_verified, CASE WHEN p.is_verified THEN p.verification_tier END,
         public.shop_town(p.store_address), p.store_address ->> 'state', p.created_at,
         st.product_count, st.follower_count, st.items_sold, st.rating, st.review_count,
         public.shop_type_of(p.id, p.store_name, p.store_description),
         CASE WHEN (p.store_address ->> 'latitude') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (p.store_address ->> 'latitude')::NUMERIC END,
         CASE WHEN (p.store_address ->> 'longitude') ~ '^-?[0-9]+(\.[0-9]+)?$' THEN (p.store_address ->> 'longitude')::NUMERIC END,
         COALESCE((p.store_address ->> 'location_precise')::BOOLEAN, false)
  FROM public.profiles p
  JOIN public.shop_stats st ON st.vendor_id = p.id
  WHERE p.store_name IS NOT NULL
    AND st.product_count > 0
    AND public.has_role(p.id, 'vendor')
$$;

REVOKE ALL ON FUNCTION public.directory_shops() FROM PUBLIC, anon, authenticated;

/**
 * The Shops page.
 *   p_badge: all | gold | verified | unverified    p_type: all | tailor | seller
 *   p_town:  a town from shop_towns(), or NULL
 *   p_sort:  recommended | near | followers | newest | rating
 *   p_lat / p_lng: the shopper's position, for "near" and the distance shown.
 * distance_km is only returned for shops that saved their exact spot.
 */
CREATE OR REPLACE FUNCTION public.shop_directory(
  p_search TEXT DEFAULT NULL,
  p_badge TEXT DEFAULT 'all',
  p_type TEXT DEFAULT 'all',
  p_town TEXT DEFAULT NULL,
  p_sort TEXT DEFAULT 'recommended',
  p_lat NUMERIC DEFAULT NULL,
  p_lng NUMERIC DEFAULT NULL,
  p_limit INTEGER DEFAULT 30,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID, store_name TEXT, store_slug TEXT, store_description TEXT, avatar_url TEXT, store_banner_url TEXT,
  is_verified BOOLEAN, verification_tier TEXT, city TEXT, state TEXT, joined_at TIMESTAMPTZ,
  product_count BIGINT, follower_count BIGINT, items_sold BIGINT, rating NUMERIC, review_count BIGINT,
  shop_type TEXT, location_precise BOOLEAN, distance_km NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
    -- Near me: closest first (town-centre shops count by their town); shops with no location last.
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
$$;

/** Chip numbers: badge counts within the chosen type and town; type counts within the chosen badge and town. */
CREATE OR REPLACE FUNCTION public.shop_directory_counts(
  p_search TEXT DEFAULT NULL,
  p_badge TEXT DEFAULT 'all',
  p_type TEXT DEFAULT 'all',
  p_town TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH s AS (
    SELECT d.*,
      (COALESCE(p_type, 'all') = 'all' OR d.shop_type = p_type) AS in_type,
      (COALESCE(p_badge, 'all') = 'all'
        OR (p_badge = 'gold' AND d.verification_tier = 'gold')
        OR (p_badge = 'verified' AND d.is_verified)
        OR (p_badge = 'unverified' AND NOT d.is_verified)) AS in_badge
    FROM public.directory_shops() d
    WHERE (p_search IS NULL OR btrim(p_search) = ''
           OR d.store_name ILIKE '%' || btrim(p_search) || '%'
           OR d.city ILIKE '%' || btrim(p_search) || '%')
      AND (p_town IS NULL OR btrim(p_town) = '' OR lower(d.city) = lower(btrim(p_town)))
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.directory_shops()),
    'all', count(*) FILTER (WHERE in_type),
    'gold', count(*) FILTER (WHERE in_type AND verification_tier = 'gold'),
    'verified', count(*) FILTER (WHERE in_type AND is_verified),
    'unverified', count(*) FILTER (WHERE in_type AND NOT is_verified),
    'everyone', count(*) FILTER (WHERE in_badge),
    'tailor', count(*) FILTER (WHERE in_badge AND shop_type = 'tailor'),
    'seller', count(*) FILTER (WHERE in_badge AND shop_type = 'seller')
  )
  FROM s
$$;

/** Towns that have shops, busiest first, for the town filter. */
CREATE OR REPLACE FUNCTION public.shop_towns()
RETURNS TABLE (town TEXT, shops BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT d.city, count(*)
  FROM public.directory_shops() d
  WHERE d.city IS NOT NULL
  GROUP BY d.city
  ORDER BY count(*) DESC, d.city
  LIMIT 50
$$;

REVOKE ALL ON FUNCTION public.shop_directory(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_directory_counts(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.shop_towns() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_directory(TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, NUMERIC, INTEGER, INTEGER) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_directory_counts(TEXT, TEXT, TEXT, TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.shop_towns() TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Admin: correct a shop's type
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admin_set_shop_type(p_vendor_id UUID, p_type TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can change a shop''s type';
  END IF;
  IF p_type NOT IN ('tailor', 'seller') THEN
    RAISE EXCEPTION 'Choose tailor or seller';
  END IF;
  INSERT INTO public.shop_types (vendor_id, shop_type) VALUES (p_vendor_id, p_type)
  ON CONFLICT (vendor_id) DO UPDATE SET shop_type = EXCLUDED.shop_type, updated_at = now();
  RETURN p_type;
END;
$$;

/** Admin: a shop's current type (chosen or guessed). */
CREATE OR REPLACE FUNCTION public.admin_shop_type(p_vendor_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can see this';
  END IF;
  RETURN (SELECT public.shop_type_of(p.id, p.store_name, p.store_description) FROM public.profiles p WHERE p.id = p_vendor_id);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_shop_type(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_shop_type(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_shop_type(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_shop_type(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- 4. Ambassador dashboard
-- ---------------------------------------------------------------------------

ALTER TABLE public.ambassadors ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE;

/**
 * Admin: link an ambassador to an app account by email or phone.
 * Pass NULL to unlink.
 */
CREATE OR REPLACE FUNCTION public.admin_link_ambassador_account(p_ambassador_id UUID, p_email_or_phone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_needle TEXT := btrim(COALESCE(p_email_or_phone, ''));
  v_digits TEXT := right(regexp_replace(v_needle, '\D', '', 'g'), 10);
  v_user public.profiles%ROWTYPE;
  v_matches INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can link ambassador accounts';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.ambassadors WHERE id = p_ambassador_id) THEN
    RAISE EXCEPTION 'Ambassador not found';
  END IF;

  IF v_needle = '' THEN
    UPDATE public.ambassadors SET user_id = NULL WHERE id = p_ambassador_id;
    RETURN jsonb_build_object('linked', false);
  END IF;

  IF position('@' in v_needle) > 0 THEN
    SELECT * INTO v_user FROM public.profiles WHERE lower(email) = lower(v_needle) LIMIT 1;
  ELSIF char_length(v_digits) = 10 THEN
    SELECT count(*) INTO v_matches FROM public.profiles WHERE right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10) = v_digits;
    IF v_matches > 1 THEN
      RAISE EXCEPTION 'More than one account uses that phone number. Use their email instead.';
    END IF;
    SELECT * INTO v_user FROM public.profiles WHERE right(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), 10) = v_digits LIMIT 1;
  ELSE
    RAISE EXCEPTION 'Enter the email or phone number they signed up with';
  END IF;

  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'No account found with %. Ask them to create a free account first.', v_needle;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ambassadors WHERE user_id = v_user.id AND id <> p_ambassador_id) THEN
    RAISE EXCEPTION 'That account is already linked to another ambassador';
  END IF;

  UPDATE public.ambassadors SET user_id = v_user.id WHERE id = p_ambassador_id;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
  VALUES (v_user.id, 'Your ambassador dashboard is ready',
          'See the sellers you invited and your earnings any time.', 'success', 'system', '/ambassador');

  RETURN jsonb_build_object('linked', true, 'name', NULLIF(v_user.full_name, ''), 'email', v_user.email);
END;
$$;

/**
 * The signed-in user's ambassador record. If none is linked yet, an active,
 * unlinked ambassador registered with the same (sign-in) email is linked now.
 */
CREATE OR REPLACE FUNCTION public.my_ambassador_id()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_id UUID;
  v_email TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT id INTO v_id FROM public.ambassadors WHERE user_id = v_uid;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  -- The sign-in email is confirmed by Supabase Auth, so it is safe to match on.
  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_uid AND email_confirmed_at IS NOT NULL;
  IF v_email IS NULL THEN
    RETURN NULL;
  END IF;
  UPDATE public.ambassadors SET user_id = v_uid
  WHERE id = (SELECT a.id FROM public.ambassadors a WHERE a.user_id IS NULL AND a.is_active AND lower(a.email) = v_email LIMIT 1)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

/** Everything the ambassador's own page shows. Sellers' phone numbers are not included. */
CREATE OR REPLACE FUNCTION public.my_ambassador_dashboard()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := public.my_ambassador_id();
  v_amb public.ambassadors%ROWTYPE;
  v_reward NUMERIC;
BEGIN
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT * INTO v_amb FROM public.ambassadors WHERE id = v_id;
  SELECT ambassador_seller_reward INTO v_reward FROM public.platform_settings WHERE id = 1;

  RETURN jsonb_build_object(
    'code', v_amb.code,
    'full_name', v_amb.full_name,
    'is_active', v_amb.is_active,
    'link_visits', v_amb.link_visits,
    'reward_per_seller', COALESCE(v_reward, 0),
    'payout_account', CASE WHEN v_amb.account_number IS NOT NULL
      THEN concat_ws(' ', v_amb.bank_name, '••••' || right(v_amb.account_number, 4)) END,
    'totals', (
      SELECT jsonb_build_object(
        'sign_ups', count(*) FILTER (WHERE r.status <> 'rejected'),
        'approved', count(*) FILTER (WHERE r.status IN ('approved', 'earned', 'paid')),
        'selling', count(*) FILTER (WHERE r.status IN ('earned', 'paid')),
        'owed', COALESCE(sum(r.reward_amount) FILTER (WHERE r.status = 'earned'), 0),
        'paid', COALESCE(sum(r.reward_amount) FILTER (WHERE r.status = 'paid'), 0)
      )
      FROM public.seller_referrals r WHERE r.ambassador_id = v_id
    ),
    'sellers', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'shop_name', COALESCE(NULLIF(p.store_name, ''), va.shop_name, 'New shop'),
        'shop_slug', CASE WHEN r.status IN ('approved', 'earned', 'paid') THEN p.store_slug END,
        'owner_first_name', split_part(btrim(COALESCE(NULLIF(p.full_name, ''), va.full_name, '')), ' ', 1),
        'status', r.status,
        'reward_amount', r.reward_amount,
        'joined_at', r.created_at,
        'approved_at', r.approved_at,
        'earned_at', r.earned_at,
        'paid_at', r.paid_at
      ) ORDER BY r.created_at DESC)
      FROM public.seller_referrals r
      LEFT JOIN public.profiles p ON p.id = r.seller_id
      LEFT JOIN public.vendor_applications va ON va.user_id = r.seller_id
      WHERE r.ambassador_id = v_id
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_link_ambassador_account(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_ambassador_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_ambassador_dashboard() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_link_ambassador_account(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_ambassador_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_ambassador_dashboard() TO authenticated;

-- The admin list also shows whether each ambassador has a linked account.
CREATE OR REPLACE FUNCTION public.admin_ambassador_accounts()
RETURNS TABLE (ambassador_id UUID, user_id UUID, account_email TEXT, account_name TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can see this';
  END IF;
  RETURN QUERY
  SELECT a.id, a.user_id, p.email, NULLIF(p.full_name, '')
  FROM public.ambassadors a LEFT JOIN public.profiles p ON p.id = a.user_id
  WHERE a.user_id IS NOT NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_ambassador_accounts() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_ambassador_accounts() TO authenticated;
