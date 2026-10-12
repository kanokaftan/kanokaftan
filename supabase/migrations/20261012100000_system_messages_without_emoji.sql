-- System chat messages in plain words ("Missed voice call", "Is this available? …"), no emoji.
DO $$
DECLARE
  v_fn TEXT;
  v_def TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'public.end_call(uuid, text)',
    'public.send_product_card(uuid, uuid)',
    'public.request_protected_purchase(uuid)'
  ] LOOP
    v_def := pg_get_functiondef(v_fn::regprocedure);
    v_def := replace(v_def, 'format(''%s %s %s call'', v_icon,', 'format(''%s %s call'',');
    v_def := regexp_replace(v_def, '(📷|🎤|📞|📹|🛍️|🛍)\s?', '', 'g');
    EXECUTE v_def;
  END LOOP;
END $$;
