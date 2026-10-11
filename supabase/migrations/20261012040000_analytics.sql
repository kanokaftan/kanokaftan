-- First-party analytics: visits, traffic sources, devices, what people look
-- at and the shopping funnel. Events are written only through track_events()
-- (validated, capped) and read only by admins (and by each seller for their
-- own shop through vendor_analytics()).

CREATE TABLE IF NOT EXISTS public.analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  event TEXT NOT NULL,
  -- Random ids kept on the device: visitor (long-lived) and visit (30 min idle).
  visitor_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  user_id UUID,
  path TEXT,
  -- Where the visit came from (Google, Instagram, WhatsApp, Direct...); sent with every event of the visit.
  source TEXT,
  referrer TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  device TEXT,
  os TEXT,
  browser TEXT,
  standalone BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT,
  language TEXT,
  product_id UUID,
  vendor_id UUID,
  search TEXT,
  value NUMERIC
);

CREATE INDEX IF NOT EXISTS analytics_events_created_idx ON public.analytics_events (created_at);
CREATE INDEX IF NOT EXISTS analytics_events_event_created_idx ON public.analytics_events (event, created_at);
CREATE INDEX IF NOT EXISTS analytics_events_visitor_idx ON public.analytics_events (visitor_id, created_at);
CREATE INDEX IF NOT EXISTS analytics_events_session_idx ON public.analytics_events (session_id);
CREATE INDEX IF NOT EXISTS analytics_events_vendor_idx ON public.analytics_events (vendor_id, created_at) WHERE vendor_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS analytics_events_product_idx ON public.analytics_events (product_id) WHERE product_id IS NOT NULL;

ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can read analytics" ON public.analytics_events
  FOR SELECT USING (public.has_role((SELECT auth.uid()), 'admin'));

/** Most events accepted per minute across the whole site (stops a flood). */
CREATE OR REPLACE FUNCTION public.analytics_minute_cap()
RETURNS integer LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT 6000 $$;

CREATE OR REPLACE FUNCTION public.analytics_uuid(p_value TEXT)
RETURNS UUID LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE WHEN p_value ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_value::uuid END
$$;

CREATE OR REPLACE FUNCTION public.track_events(p_events JSONB)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  e JSONB;
  v_product UUID;
  v_vendor UUID;
  v_value TEXT;
BEGIN
  IF p_events IS NULL OR jsonb_typeof(p_events) <> 'array' THEN RETURN; END IF;
  IF (SELECT count(*) FROM public.analytics_events WHERE created_at > now() - interval '1 minute')
     >= public.analytics_minute_cap() THEN
    RETURN;
  END IF;

  FOR e IN SELECT value FROM jsonb_array_elements(p_events) LIMIT 25 LOOP
    CONTINUE WHEN jsonb_typeof(e) <> 'object';
    CONTINUE WHEN NOT (COALESCE(e->>'event', '') = ANY (ARRAY[
      'page_view', 'product_view', 'shop_view', 'add_to_cart', 'checkout_start', 'purchase', 'search', 'wishlist_add', 'share'
    ]));
    CONTINUE WHEN COALESCE(e->>'visitor_id', '') !~ '^[A-Za-z0-9_-]{8,64}$'
               OR COALESCE(e->>'session_id', '') !~ '^[A-Za-z0-9_-]{8,64}$';

    v_product := public.analytics_uuid(e->>'product_id');
    v_vendor := public.analytics_uuid(e->>'vendor_id');
    IF v_vendor IS NULL AND v_product IS NOT NULL THEN
      SELECT p.vendor_id INTO v_vendor FROM public.products p WHERE p.id = v_product;
    END IF;
    v_value := e->>'value';

    INSERT INTO public.analytics_events (
      event, visitor_id, session_id, user_id, path, source, referrer, utm_source, utm_medium, utm_campaign,
      device, os, browser, standalone, timezone, language, product_id, vendor_id, search, value
    ) VALUES (
      e->>'event', e->>'visitor_id', e->>'session_id', auth.uid(),
      left(e->>'path', 300), left(e->>'source', 40), left(lower(e->>'referrer'), 120),
      left(lower(e->>'utm_source'), 80), left(lower(e->>'utm_medium'), 80), left(e->>'utm_campaign', 120),
      left(e->>'device', 20), left(e->>'os', 30), left(e->>'browser', 30),
      COALESCE(e->>'standalone', '') = 'true',
      left(e->>'timezone', 60), left(e->>'language', 20),
      v_product, v_vendor,
      NULLIF(left(lower(btrim(e->>'search')), 80), ''),
      CASE WHEN v_value ~ '^\d{1,12}(\.\d{1,2})?$' THEN v_value::numeric END
    );
  END LOOP;
END;
$$;
REVOKE ALL ON FUNCTION public.track_events(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_events(JSONB) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin report for a date range (times in Lagos). Hourly buckets for ranges
-- up to two days, daily otherwise. Compares headline numbers with the
-- previous period of the same length.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_analytics(p_from TIMESTAMPTZ, p_to TIMESTAMPTZ)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tz CONSTANT TEXT := 'Africa/Lagos';
  v_unit TEXT;
  v_step INTERVAL;
  v_prev_from TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_from IS NULL OR p_to IS NULL OR p_to <= p_from THEN RAISE EXCEPTION 'Invalid date range'; END IF;
  IF p_to - p_from > interval '400 days' THEN RAISE EXCEPTION 'Choose a range of 400 days or less'; END IF;

  v_unit := CASE WHEN p_to - p_from <= interval '2 days' THEN 'hour' ELSE 'day' END;
  v_step := CASE WHEN v_unit = 'hour' THEN interval '1 hour' ELSE interval '1 day' END;
  v_prev_from := p_from - (p_to - p_from);

  WITH ev AS (
    SELECT * FROM public.analytics_events WHERE created_at >= p_from AND created_at < p_to
  ),
  sessions AS (
    SELECT session_id,
           min(visitor_id) AS visitor_id,
           min(created_at) AS started_at,
           max(created_at) AS ended_at,
           count(*) FILTER (WHERE event = 'page_view') AS pages,
           (array_agg(COALESCE(source, 'Direct') ORDER BY created_at))[1] AS source,
           (array_agg(referrer ORDER BY created_at) FILTER (WHERE referrer IS NOT NULL))[1] AS referrer,
           (array_agg(utm_campaign ORDER BY created_at) FILTER (WHERE utm_campaign IS NOT NULL))[1] AS campaign,
           (array_agg(path ORDER BY created_at) FILTER (WHERE event = 'page_view'))[1] AS landing,
           (array_agg(device ORDER BY created_at))[1] AS device,
           (array_agg(os ORDER BY created_at))[1] AS os,
           (array_agg(browser ORDER BY created_at))[1] AS browser,
           bool_or(standalone) AS standalone,
           bool_or(event = 'product_view') AS viewed_product,
           bool_or(event = 'add_to_cart') AS added_to_cart,
           bool_or(event = 'checkout_start') AS started_checkout,
           bool_or(event = 'purchase') AS purchased
    FROM ev GROUP BY session_id
  ),
  visitors AS (
    SELECT visitor_id, (array_agg(timezone ORDER BY created_at))[1] AS timezone FROM ev GROUP BY visitor_id
  ),
  paid_orders AS (
    SELECT created_at, total FROM public.orders
    WHERE created_at >= p_from AND created_at < p_to AND payment_status = 'paid'
  ),
  buckets AS (
    SELECT generate_series(
      date_trunc(v_unit, p_from AT TIME ZONE v_tz),
      date_trunc(v_unit, (p_to - interval '1 second') AT TIME ZONE v_tz),
      v_step
    ) AS bucket
  )
  SELECT jsonb_build_object(
    'unit', v_unit,
    'summary', jsonb_build_object(
      'visitors', (SELECT count(*) FROM visitors),
      'new_visitors', (SELECT count(*) FROM visitors v WHERE NOT EXISTS (
        SELECT 1 FROM public.analytics_events a WHERE a.visitor_id = v.visitor_id AND a.created_at < p_from)),
      'sessions', (SELECT count(*) FROM sessions),
      'page_views', (SELECT count(*) FROM ev WHERE event = 'page_view'),
      'bounce_rate', (SELECT round(100.0 * count(*) FILTER (WHERE pages <= 1) / NULLIF(count(*), 0), 1) FROM sessions),
      'avg_session_seconds', (SELECT round(avg(extract(epoch FROM ended_at - started_at))) FROM sessions WHERE pages > 1),
      'pages_per_session', (SELECT round(avg(pages)::numeric, 1) FROM sessions),
      'signups', (SELECT count(*) FROM public.profiles WHERE created_at >= p_from AND created_at < p_to),
      'orders', (SELECT count(*) FROM public.orders WHERE created_at >= p_from AND created_at < p_to),
      'paid_orders', (SELECT count(*) FROM paid_orders),
      'revenue', (SELECT COALESCE(sum(total), 0) FROM paid_orders),
      'conversion_rate', (SELECT round(100.0 * (SELECT count(*) FROM paid_orders) / NULLIF(count(*), 0), 2) FROM sessions)
    ),
    'previous', jsonb_build_object(
      'visitors', (SELECT count(DISTINCT visitor_id) FROM public.analytics_events WHERE created_at >= v_prev_from AND created_at < p_from),
      'sessions', (SELECT count(DISTINCT session_id) FROM public.analytics_events WHERE created_at >= v_prev_from AND created_at < p_from),
      'page_views', (SELECT count(*) FROM public.analytics_events WHERE event = 'page_view' AND created_at >= v_prev_from AND created_at < p_from),
      'paid_orders', (SELECT count(*) FROM public.orders WHERE payment_status = 'paid' AND created_at >= v_prev_from AND created_at < p_from),
      'revenue', (SELECT COALESCE(sum(total), 0) FROM public.orders WHERE payment_status = 'paid' AND created_at >= v_prev_from AND created_at < p_from),
      'signups', (SELECT count(*) FROM public.profiles WHERE created_at >= v_prev_from AND created_at < p_from)
    ),
    'series', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'at', to_char(b.bucket, 'YYYY-MM-DD"T"HH24:MI'),
        'visitors', (SELECT count(DISTINCT visitor_id) FROM ev WHERE date_trunc(v_unit, ev.created_at AT TIME ZONE v_tz) = b.bucket),
        'page_views', (SELECT count(*) FROM ev WHERE ev.event = 'page_view' AND date_trunc(v_unit, ev.created_at AT TIME ZONE v_tz) = b.bucket),
        'orders', (SELECT count(*) FROM paid_orders o WHERE date_trunc(v_unit, o.created_at AT TIME ZONE v_tz) = b.bucket),
        'revenue', (SELECT COALESCE(sum(total), 0) FROM paid_orders o WHERE date_trunc(v_unit, o.created_at AT TIME ZONE v_tz) = b.bucket)
      ) ORDER BY b.bucket), '[]'::jsonb)
      FROM buckets b
    ),
    'funnel', (
      SELECT jsonb_build_object(
        'sessions', count(*),
        'viewed_product', count(*) FILTER (WHERE viewed_product),
        'added_to_cart', count(*) FILTER (WHERE added_to_cart),
        'started_checkout', count(*) FILTER (WHERE started_checkout),
        'purchased', count(*) FILTER (WHERE purchased)
      ) FROM sessions
    ),
    'sources', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'sessions')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('name', source, 'sessions', count(*), 'visitors', count(DISTINCT visitor_id),
                                  'purchases', count(*) FILTER (WHERE purchased)) AS r
        FROM sessions GROUP BY source
      ) s
    ),
    'referrers', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'sessions')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('name', referrer, 'sessions', count(*)) AS r
        FROM sessions WHERE referrer IS NOT NULL GROUP BY referrer ORDER BY count(*) DESC LIMIT 10
      ) s
    ),
    'campaigns', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'sessions')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('name', campaign, 'sessions', count(*), 'purchases', count(*) FILTER (WHERE purchased)) AS r
        FROM sessions WHERE campaign IS NOT NULL GROUP BY campaign ORDER BY count(*) DESC LIMIT 10
      ) s
    ),
    'pages', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'views')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('name', path, 'views', count(*), 'visitors', count(DISTINCT visitor_id)) AS r
        FROM ev WHERE event = 'page_view' AND path IS NOT NULL GROUP BY path ORDER BY count(*) DESC LIMIT 15
      ) s
    ),
    'landing_pages', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'sessions')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('name', landing, 'sessions', count(*),
                                  'bounce_rate', round(100.0 * count(*) FILTER (WHERE pages <= 1) / count(*), 1)) AS r
        FROM sessions WHERE landing IS NOT NULL GROUP BY landing ORDER BY count(*) DESC LIMIT 10
      ) s
    ),
    'products', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'views')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('id', p.id, 'name', p.name, 'slug', p.slug,
                                  'views', count(*) FILTER (WHERE ev.event = 'product_view'),
                                  'add_to_cart', count(*) FILTER (WHERE ev.event = 'add_to_cart'),
                                  'wishlist', count(*) FILTER (WHERE ev.event = 'wishlist_add')) AS r
        FROM ev JOIN public.products p ON p.id = ev.product_id
        GROUP BY p.id, p.name, p.slug
        ORDER BY count(*) FILTER (WHERE ev.event = 'product_view') DESC LIMIT 10
      ) s
    ),
    'shops', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'views')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('id', pr.id, 'name', COALESCE(pr.store_name, pr.full_name, 'Shop'), 'slug', pr.store_slug,
                                  'views', count(*) FILTER (WHERE ev.event = 'shop_view'),
                                  'product_views', count(*) FILTER (WHERE ev.event = 'product_view'),
                                  'visitors', count(DISTINCT ev.visitor_id)) AS r
        FROM ev JOIN public.profiles pr ON pr.id = ev.vendor_id
        WHERE ev.event IN ('shop_view', 'product_view')
        GROUP BY pr.id, pr.store_name, pr.full_name, pr.store_slug
        ORDER BY count(*) DESC LIMIT 10
      ) s
    ),
    'searches', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'count')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('name', search, 'count', count(*)) AS r
        FROM ev WHERE event = 'search' AND search IS NOT NULL GROUP BY search ORDER BY count(*) DESC LIMIT 15
      ) s
    ),
    'devices', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'sessions', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(device, 'Unknown') AS name, count(*) AS n FROM sessions GROUP BY 1) s
    ),
    'os', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'sessions', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(os, 'Unknown') AS name, count(*) AS n FROM sessions GROUP BY 1) s
    ),
    'browsers', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'sessions', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(browser, 'Unknown') AS name, count(*) AS n FROM sessions GROUP BY 1) s
    ),
    'app', (
      SELECT jsonb_build_object('app', count(*) FILTER (WHERE standalone), 'browser', count(*) FILTER (WHERE NOT standalone))
      FROM sessions
    ),
    'timezones', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'visitors', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(timezone, 'Unknown') AS name, count(*) AS n FROM visitors GROUP BY 1 ORDER BY 2 DESC LIMIT 12) s
    ),
    'hours', (
      SELECT jsonb_agg(jsonb_build_object('hour', h, 'page_views',
        (SELECT count(*) FROM ev WHERE ev.event = 'page_view' AND extract(hour FROM ev.created_at AT TIME ZONE v_tz) = h)) ORDER BY h)
      FROM generate_series(0, 23) AS h
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_analytics(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_analytics(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

/** Who is on the site right now (active in the last 5 minutes). */
CREATE OR REPLACE FUNCTION public.admin_live_visitors()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  WITH latest AS (
    SELECT DISTINCT ON (visitor_id) visitor_id, path, source, device, created_at
    FROM public.analytics_events
    WHERE created_at > now() - interval '5 minutes'
    ORDER BY visitor_id, created_at DESC
  )
  SELECT jsonb_build_object(
    'visitors', (SELECT count(*) FROM latest),
    'pages', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', path, 'visitors', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(path, '/') AS path, count(*) AS n FROM latest GROUP BY 1 ORDER BY 2 DESC LIMIT 8) s
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_live_visitors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_live_visitors() TO authenticated;

-- ---------------------------------------------------------------------------
-- A seller's own numbers: visits to their shop and products, last N days.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.vendor_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tz CONSTANT TEXT := 'Africa/Lagos';
  v_vendor UUID := auth.uid();
  v_days INTEGER := LEAST(GREATEST(COALESCE(p_days, 30), 1), 365);
  v_from TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  IF v_vendor IS NULL OR NOT public.has_role(v_vendor, 'vendor') THEN RAISE EXCEPTION 'Sellers only'; END IF;
  v_from := date_trunc('day', now() AT TIME ZONE v_tz) AT TIME ZONE v_tz - make_interval(days => v_days - 1);

  WITH ev AS (
    SELECT * FROM public.analytics_events WHERE vendor_id = v_vendor AND created_at >= v_from
  )
  SELECT jsonb_build_object(
    'days', v_days,
    'visitors', (SELECT count(DISTINCT visitor_id) FROM ev),
    'shop_views', (SELECT count(*) FROM ev WHERE event = 'shop_view'),
    'product_views', (SELECT count(*) FROM ev WHERE event = 'product_view'),
    'add_to_cart', (SELECT count(*) FROM ev WHERE event = 'add_to_cart'),
    'wishlist', (SELECT count(*) FROM ev WHERE event = 'wishlist_add'),
    'series', (
      SELECT jsonb_agg(jsonb_build_object(
        'at', to_char(d, 'YYYY-MM-DD'),
        'views', (SELECT count(*) FROM ev WHERE ev.event IN ('shop_view', 'product_view')
                  AND date_trunc('day', ev.created_at AT TIME ZONE v_tz) = d),
        'visitors', (SELECT count(DISTINCT visitor_id) FROM ev WHERE date_trunc('day', ev.created_at AT TIME ZONE v_tz) = d)
      ) ORDER BY d)
      FROM generate_series(date_trunc('day', v_from AT TIME ZONE v_tz), date_trunc('day', now() AT TIME ZONE v_tz), interval '1 day') AS d
    ),
    'sources', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', name, 'visitors', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(source, 'Direct') AS name, count(DISTINCT visitor_id) AS n FROM ev GROUP BY 1 ORDER BY 2 DESC LIMIT 6) s
    ),
    'products', (
      SELECT COALESCE(jsonb_agg(r ORDER BY (r->>'views')::int DESC), '[]'::jsonb) FROM (
        SELECT jsonb_build_object('id', p.id, 'name', p.name, 'slug', p.slug,
                                  'views', count(*) FILTER (WHERE ev.event = 'product_view'),
                                  'add_to_cart', count(*) FILTER (WHERE ev.event = 'add_to_cart')) AS r
        FROM ev JOIN public.products p ON p.id = ev.product_id
        GROUP BY p.id, p.name, p.slug
        ORDER BY count(*) FILTER (WHERE ev.event = 'product_view') DESC LIMIT 5
      ) s
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_analytics(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.vendor_analytics(INTEGER) TO authenticated;
