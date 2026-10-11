-- Admin alerts, each one switchable per admin:
--   * a notification the moment a new customer signs up
--   * a short "who opened the site" summary every 15 minutes (or hourly):
--     how many, on which devices, from where, most viewed page and shop
--   * a nightly report at 9pm (Nigerian time)
-- They are ordinary notifications, so they also arrive as phone pushes.

CREATE TABLE IF NOT EXISTS public.admin_alert_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  signups BOOLEAN NOT NULL DEFAULT true,
  visits TEXT NOT NULL DEFAULT '15min' CHECK (visits IN ('off', '15min', 'hourly')),
  daily_report BOOLEAN NOT NULL DEFAULT true,
  visits_last_sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_alert_settings ENABLE ROW LEVEL SECURITY;

-- Own row only, and only for accounts with the admin role (no unlock needed to change alert choices).
CREATE POLICY "Admins read their alert settings" ON public.admin_alert_settings
  FOR SELECT USING (user_id = (SELECT auth.uid()));
CREATE POLICY "Admins create their alert settings" ON public.admin_alert_settings
  FOR INSERT WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'admin')
  );
CREATE POLICY "Admins update their alert settings" ON public.admin_alert_settings
  FOR UPDATE USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = (SELECT auth.uid()) AND ur.role = 'admin')
  );

CREATE TRIGGER update_admin_alert_settings_updated_at
  BEFORE UPDATE ON public.admin_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

/** Lagos is UTC+1 all year. */
CREATE OR REPLACE FUNCTION public.lagos_today_start()
RETURNS TIMESTAMPTZ LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT date_trunc('day', now() AT TIME ZONE 'Africa/Lagos') AT TIME ZONE 'Africa/Lagos'
$$;

/** "/" -> "Home", "/products/blue-kaftan" -> "Blue Kaftan", "/shop/royal" -> "Royal House shop". */
CREATE OR REPLACE FUNCTION public.analytics_page_label(p_path TEXT)
RETURNS TEXT
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_slug TEXT := split_part(p_path, '/', 3);
  v_name TEXT;
BEGIN
  IF p_path IS NULL THEN RETURN NULL; END IF;
  IF p_path = '/' THEN RETURN 'Home'; END IF;
  IF p_path LIKE '/products/%' AND v_slug <> '' THEN
    SELECT name INTO v_name FROM public.products WHERE slug = v_slug;
    RETURN COALESCE(v_name, initcap(replace(v_slug, '-', ' ')));
  END IF;
  IF p_path LIKE '/shop/%' AND v_slug <> '' THEN
    SELECT store_name INTO v_name FROM public.profiles WHERE store_slug = v_slug;
    RETURN COALESCE(v_name, initcap(replace(v_slug, '-', ' '))) || ' shop';
  END IF;
  RETURN CASE p_path
    WHEN '/products' THEN 'All products' WHEN '/shops' THEN 'Shops' WHEN '/cart' THEN 'Cart'
    WHEN '/checkout' THEN 'Checkout' WHEN '/sell' THEN 'Sell on Kano Kaftan' WHEN '/auth' THEN 'Sign in'
    ELSE p_path END;
END;
$$;

/** "3 iPhone, 2 Android, 1 computer" for the sessions/visitors given. */
CREATE OR REPLACE FUNCTION public.analytics_device_summary(p_os TEXT[])
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT string_agg(n || ' ' || label, ', ' ORDER BY n DESC, label)
  FROM (
    SELECT CASE
             WHEN os = 'iOS' THEN 'iPhone/iPad'
             WHEN os = 'Android' THEN 'Android'
             WHEN os IN ('Windows', 'macOS', 'Linux', 'ChromeOS') THEN 'computer'
             ELSE 'other'
           END AS label,
           count(*) AS n
    FROM unnest(p_os) AS os
    GROUP BY 1
  ) d
$$;

-- ---------------------------------------------------------------------------
-- New sign-up -> notify admins straight away.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_admins_new_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_who TEXT := COALESCE(NULLIF(btrim(NEW.full_name), ''), 'Someone');
  v_today INTEGER;
BEGIN
  SELECT count(*) INTO v_today FROM public.profiles WHERE created_at >= public.lagos_today_start();

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
  SELECT ur.user_id,
         'New sign-up',
         v_who || CASE WHEN COALESCE(NEW.email, '') <> '' THEN ' (' || NEW.email || ')' ELSE '' END
           || ' just joined Kano Kaftan. ' || v_today || CASE WHEN v_today = 1 THEN ' sign-up' ELSE ' sign-ups' END || ' today.',
         'success', 'system', '/admin/users',
         jsonb_build_object('kind', 'admin_signup', 'user_id', NEW.id)
  FROM public.user_roles ur
  LEFT JOIN public.admin_alert_settings s ON s.user_id = ur.user_id
  WHERE ur.role = 'admin' AND ur.user_id <> NEW.id AND COALESCE(s.signups, true);

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- An alert must never stop someone from signing up.
  RAISE WARNING 'notify_admins_new_signup failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE TRIGGER notify_admins_new_signup
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_admins_new_signup();

-- ---------------------------------------------------------------------------
-- Visitor summaries: new visits since the admin's last alert.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_admin_visit_alerts()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_since TIMESTAMPTZ;
  v_visits INTEGER;
  v_os TEXT[];
  v_source TEXT;
  v_page TEXT;
  v_shop TEXT;
  v_sent INTEGER := 0;
BEGIN
  FOR r IN
    SELECT ur.user_id, COALESCE(s.visits, '15min') AS visits, s.visits_last_sent_at
    FROM public.user_roles ur
    LEFT JOIN public.admin_alert_settings s ON s.user_id = ur.user_id
    WHERE ur.role = 'admin'
  LOOP
    CONTINUE WHEN r.visits = 'off';
    -- Hourly: wait until about an hour has passed since the last summary.
    CONTINUE WHEN r.visits = 'hourly' AND r.visits_last_sent_at > now() - interval '55 minutes';

    -- Never look back more than 2 hours (e.g. right after switching alerts on).
    v_since := GREATEST(COALESCE(r.visits_last_sent_at, now() - interval '15 minutes'), now() - interval '2 hours');

    -- Visits whose first event is in the window (a visit ends after 30 idle minutes).
    WITH new_visits AS (
      SELECT session_id,
             (array_agg(os ORDER BY created_at))[1] AS os,
             (array_agg(COALESCE(source, 'Direct') ORDER BY created_at))[1] AS source
      FROM public.analytics_events
      WHERE created_at >= v_since - interval '30 minutes'
      GROUP BY session_id
      HAVING min(created_at) >= v_since
    )
    SELECT count(*), array_agg(os),
           (SELECT source FROM new_visits GROUP BY source ORDER BY count(*) DESC, source LIMIT 1)
    INTO v_visits, v_os, v_source
    FROM new_visits;

    INSERT INTO public.admin_alert_settings (user_id, visits_last_sent_at)
    VALUES (r.user_id, now())
    ON CONFLICT (user_id) DO UPDATE SET visits_last_sent_at = now();

    CONTINUE WHEN v_visits = 0;

    SELECT public.analytics_page_label(path) INTO v_page
    FROM public.analytics_events
    WHERE created_at >= v_since AND event = 'page_view' AND path IS NOT NULL
    GROUP BY path ORDER BY count(*) DESC, path LIMIT 1;

    SELECT COALESCE(pr.store_name, pr.full_name) INTO v_shop
    FROM public.analytics_events ev JOIN public.profiles pr ON pr.id = ev.vendor_id
    WHERE ev.created_at >= v_since AND ev.event IN ('shop_view', 'product_view')
    GROUP BY pr.id, pr.store_name, pr.full_name ORDER BY count(*) DESC LIMIT 1;

    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    VALUES (
      r.user_id,
      CASE WHEN v_visits = 1 THEN 'Someone opened Kano Kaftan' ELSE v_visits || ' people opened Kano Kaftan' END,
      'Devices: ' || COALESCE(public.analytics_device_summary(v_os), 'unknown') || '. '
        || 'From: ' || COALESCE(v_source, 'Direct') || '.'
        || COALESCE(' Most viewed: ' || v_page || '.', '')
        || COALESCE(' Top shop: ' || v_shop || '.', ''),
      'info', 'system', '/admin/analytics',
      jsonb_build_object('kind', 'admin_visits', 'visits', v_visits, 'since', v_since)
    );
    v_sent := v_sent + 1;
  END LOOP;
  RETURN v_sent;
END;
$$;
REVOKE ALL ON FUNCTION public.run_admin_visit_alerts() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Nightly report.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.run_admin_daily_report()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from TIMESTAMPTZ := public.lagos_today_start();
  v_visitors INTEGER;
  v_new INTEGER;
  v_views INTEGER;
  v_os TEXT[];
  v_page TEXT;
  v_shop TEXT;
  v_signups INTEGER;
  v_paid INTEGER;
  v_revenue NUMERIC;
  v_message TEXT;
  v_sent INTEGER;
BEGIN
  WITH visitors AS (
    SELECT visitor_id, (array_agg(os ORDER BY created_at))[1] AS os
    FROM public.analytics_events WHERE created_at >= v_from GROUP BY visitor_id
  )
  SELECT count(*), array_agg(os),
         count(*) FILTER (WHERE NOT EXISTS (
           SELECT 1 FROM public.analytics_events a WHERE a.visitor_id = visitors.visitor_id AND a.created_at < v_from))
  INTO v_visitors, v_os, v_new
  FROM visitors;

  SELECT count(*) INTO v_views FROM public.analytics_events WHERE created_at >= v_from AND event = 'page_view';

  SELECT public.analytics_page_label(path) INTO v_page
  FROM public.analytics_events WHERE created_at >= v_from AND event = 'page_view' AND path IS NOT NULL
  GROUP BY path ORDER BY count(*) DESC, path LIMIT 1;

  SELECT COALESCE(pr.store_name, pr.full_name) INTO v_shop
  FROM public.analytics_events ev JOIN public.profiles pr ON pr.id = ev.vendor_id
  WHERE ev.created_at >= v_from AND ev.event IN ('shop_view', 'product_view')
  GROUP BY pr.id, pr.store_name, pr.full_name ORDER BY count(*) DESC LIMIT 1;

  SELECT count(*) INTO v_signups FROM public.profiles WHERE created_at >= v_from;
  SELECT count(*), COALESCE(sum(total), 0) INTO v_paid, v_revenue
  FROM public.orders WHERE created_at >= v_from AND payment_status = 'paid';

  v_message := v_visitors || ' visitors (' || v_new || ' new), ' || v_views || ' page views.'
    || CASE WHEN v_visitors > 0 THEN ' Devices: ' || COALESCE(public.analytics_device_summary(v_os), 'unknown') || '.' ELSE '' END
    || COALESCE(' Most viewed: ' || v_page || '.', '')
    || COALESCE(' Top shop: ' || v_shop || '.', '')
    || ' Sign-ups: ' || v_signups || '. Paid orders: ' || v_paid
    || CASE WHEN v_paid > 0 THEN ' (₦' || to_char(v_revenue, 'FM999,999,999,990') || ')' ELSE '' END || '.';

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
  SELECT ur.user_id, 'Today on Kano Kaftan', v_message, 'info', 'system', '/admin/analytics',
         jsonb_build_object('kind', 'admin_daily_report', 'visitors', v_visitors, 'paid_orders', v_paid)
  FROM public.user_roles ur
  LEFT JOIN public.admin_alert_settings s ON s.user_id = ur.user_id
  WHERE ur.role = 'admin' AND COALESCE(s.daily_report, true);
  GET DIAGNOSTICS v_sent = ROW_COUNT;
  RETURN v_sent;
END;
$$;
REVOKE ALL ON FUNCTION public.run_admin_daily_report() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin dashboard "Today" overview.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_today_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_from TIMESTAMPTZ := public.lagos_today_start();
  v_result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;

  WITH ev AS (SELECT * FROM public.analytics_events WHERE created_at >= v_from),
  visitors AS (SELECT visitor_id, (array_agg(os ORDER BY created_at))[1] AS os FROM ev GROUP BY visitor_id)
  SELECT jsonb_build_object(
    'live', (SELECT count(DISTINCT visitor_id) FROM public.analytics_events WHERE created_at > now() - interval '5 minutes'),
    'visitors', (SELECT count(*) FROM visitors),
    'page_views', (SELECT count(*) FROM ev WHERE event = 'page_view'),
    'devices', (SELECT COALESCE(jsonb_agg(jsonb_build_object('name', label, 'visitors', n) ORDER BY n DESC), '[]'::jsonb) FROM (
      SELECT CASE WHEN os = 'iOS' THEN 'iPhone/iPad' WHEN os = 'Android' THEN 'Android'
                  WHEN os IN ('Windows', 'macOS', 'Linux', 'ChromeOS') THEN 'Computer' ELSE 'Other' END AS label,
             count(*) AS n
      FROM visitors GROUP BY 1) d),
    'top_page', (SELECT jsonb_build_object('path', path, 'name', public.analytics_page_label(path), 'views', count(*))
                 FROM ev WHERE event = 'page_view' AND path IS NOT NULL GROUP BY path ORDER BY count(*) DESC, path LIMIT 1),
    'top_shop', (SELECT jsonb_build_object('name', COALESCE(pr.store_name, pr.full_name, 'Shop'), 'slug', pr.store_slug, 'views', count(*))
                 FROM ev JOIN public.profiles pr ON pr.id = ev.vendor_id
                 WHERE ev.event IN ('shop_view', 'product_view')
                 GROUP BY pr.id, pr.store_name, pr.full_name, pr.store_slug ORDER BY count(*) DESC LIMIT 1),
    'signups_today', (SELECT count(*) FROM public.profiles WHERE created_at >= v_from),
    'recent_signups', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'name', full_name, 'email', email, 'created_at', created_at)
                                                 ORDER BY created_at DESC), '[]'::jsonb)
                       FROM (SELECT id, full_name, email, created_at FROM public.profiles ORDER BY created_at DESC LIMIT 5) p)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_today_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_today_overview() TO authenticated;

-- Schedules (UTC): visitor summaries every 15 minutes, report at 20:00 UTC = 9pm in Nigeria.
SELECT cron.schedule('admin-visit-alerts', '*/15 * * * *', 'SELECT public.run_admin_visit_alerts()');
SELECT cron.schedule('admin-daily-report', '0 20 * * *', 'SELECT public.run_admin_daily_report()');
