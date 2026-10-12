-- Announcements can carry a Hausa version; the app shows it to people who chose Hausa.
CREATE OR REPLACE FUNCTION public.admin_broadcast_notification(
  p_title TEXT,
  p_message TEXT,
  p_action_url TEXT,
  p_audience TEXT,
  p_title_ha TEXT,
  p_message_ha TEXT
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
  v_meta JSONB := '{}'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can send announcements';
  END IF;
  IF char_length(btrim(COALESCE(p_title, ''))) < 2 OR char_length(btrim(COALESCE(p_message, ''))) < 2 THEN
    RAISE EXCEPTION 'Write a title and a message';
  END IF;
  IF p_audience NOT IN ('everyone', 'customers', 'sellers') THEN
    RAISE EXCEPTION 'Unknown audience';
  END IF;
  IF p_action_url IS NOT NULL AND btrim(p_action_url) <> '' AND btrim(p_action_url) !~ '^/' THEN
    RAISE EXCEPTION 'The link must be a page on Kano Kaftan, e.g. /products';
  END IF;
  IF char_length(btrim(COALESCE(p_title_ha, ''))) >= 2 AND char_length(btrim(COALESCE(p_message_ha, ''))) >= 2 THEN
    v_meta := jsonb_build_object('title_ha', left(btrim(p_title_ha), 80), 'message_ha', left(btrim(p_message_ha), 300));
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
  SELECT u.id, left(btrim(p_title), 80), left(btrim(p_message), 300), 'info', 'promotion', NULLIF(btrim(p_action_url), ''), v_meta
  FROM auth.users u
  WHERE CASE p_audience
    WHEN 'everyone' THEN true
    WHEN 'sellers' THEN public.has_role(u.id, 'vendor')
    ELSE NOT public.has_role(u.id, 'vendor')
  END;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_broadcast_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_broadcast_notification(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Hausa (and plainer English) for the business-model announcement already sent to sellers.
UPDATE public.notifications
SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
  'title_ha', 'Labari mai dadi: odar manhaja tana biyan cikakken farashinka',
  'message_ha', 'Abokin ciniki ya saya a manhaja: za ka samu 100% na farashinka. Mu sayar maka ta hirar mu: farashinka ban da 10%. Kai da kanka ka kulla ciniki: duka naka. Abokin ciniki ne ke biyan kudin kai kaya. Taba don ganin yadda yake aiki.'
),
    message = 'Customer buys in the app: you get 100% of your price. We sell it for you in our chat: your price minus 10%. You close the deal yourself: all yours. Customers pay the delivery fee. Tap to see how it works.'
WHERE metadata ->> 'kind' = 'business_model_2026_10';
