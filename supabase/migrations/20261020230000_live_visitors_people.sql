-- Analytics "On site now": who each visitor is (account name, email, role) or
-- "Guest", the page they're on, their device, how long they've been on this
-- visit and how many pages they've looked at.

CREATE OR REPLACE FUNCTION public.admin_live_visitors()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  WITH latest AS (
    SELECT DISTINCT ON (visitor_id) visitor_id, session_id, user_id, path, source, device, os, browser, standalone, timezone, created_at
    FROM public.analytics_events
    WHERE created_at > now() - interval '5 minutes'
    ORDER BY visitor_id, created_at DESC
  ), people AS (
    SELECT l.*,
           -- Signed in now, or earlier today on this device.
           COALESCE(l.user_id, (SELECT e.user_id FROM public.analytics_events e
                                WHERE e.visitor_id = l.visitor_id AND e.user_id IS NOT NULL AND e.created_at > now() - interval '1 day'
                                ORDER BY e.created_at DESC LIMIT 1)) AS account_id,
           (SELECT min(e.created_at) FROM public.analytics_events e WHERE e.session_id = l.session_id AND e.created_at > now() - interval '1 day') AS visit_started,
           (SELECT count(*) FROM public.analytics_events e
            WHERE e.session_id = l.session_id AND e.event = 'page_view' AND e.created_at > now() - interval '1 day') AS pages_seen
    FROM latest l
  )
  SELECT jsonb_build_object(
    'visitors', (SELECT count(*) FROM latest),
    'pages', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object('name', path, 'visitors', n) ORDER BY n DESC), '[]'::jsonb)
      FROM (SELECT COALESCE(path, '/') AS path, count(*) AS n FROM latest GROUP BY 1 ORDER BY 2 DESC LIMIT 8) s
    ),
    'people', (
      SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'visitor_id', pp.visitor_id,
        'user_id', pp.account_id,
        'name', NULLIF(btrim(pr.full_name), ''),
        'email', pr.email,
        'avatar_url', pr.avatar_url,
        'store_name', pr.store_name,
        'role', CASE
                  WHEN pp.account_id IS NULL THEN 'guest'
                  WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = pp.account_id AND r.role::TEXT = 'admin') THEN 'admin'
                  WHEN EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = pp.account_id AND r.role::TEXT = 'vendor') THEN 'seller'
                  WHEN EXISTS (SELECT 1 FROM public.logistics_members m WHERE m.user_id = pp.account_id) THEN 'delivery'
                  ELSE 'buyer' END,
        'path', COALESCE(pp.path, '/'),
        'source', pp.source,
        'device', pp.device, 'os', pp.os, 'browser', pp.browser, 'app', pp.standalone, 'timezone', pp.timezone,
        'last_seen', pp.created_at,
        'visit_started', pp.visit_started,
        'pages_seen', pp.pages_seen
      ) ORDER BY (pp.account_id IS NULL), pp.created_at DESC), '[]'::jsonb)
      FROM (SELECT * FROM people ORDER BY created_at DESC LIMIT 100) pp
      LEFT JOIN public.profiles pr ON pr.id = pp.account_id
    )
  ) INTO v_result;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_live_visitors() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_live_visitors() TO authenticated;
