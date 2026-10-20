-- "Delete my account" (required by the App Store and Google Play).
--
-- account_deletion_status(user): what stops deletion right now (an order in
-- progress, an open dispute, money still to be paid to a seller, an
-- ambassador/partner role) and what will be lost (K² balance).
--
-- scrub_account(user): removes everything personal. People with no orders,
-- sales or payouts are removed completely afterwards (the edge function
-- deletes the sign-in, which cascades). People with history keep anonymous
-- order and payout records for the books ("Deleted user", no contact details)
-- and their sign-in is blocked for good.
--
-- Both run only with the service role, from the delete-account edge function.

CREATE OR REPLACE FUNCTION public.account_deletion_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blockers JSONB := '[]'::JSONB;
  v_open_orders INTEGER;
  v_open_sales INTEGER;
  v_owed NUMERIC;
  v_k2 NUMERIC;
  v_history BOOLEAN;
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role::TEXT = 'admin') THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'admin',
      'message', 'Admin accounts can''t be deleted from the app. Remove the admin role first.'));
  END IF;

  SELECT count(*) INTO v_open_orders FROM public.orders o
  WHERE o.user_id = p_user_id AND o.payment_status = 'paid'
    AND (o.status NOT IN ('completed', 'cancelled', 'refunded') OR o.dispute_status = 'open');
  IF v_open_orders > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'open_orders',
      'message', format('You have %s %s still in progress. Wait until %s delivered and confirmed (or cancelled).',
                        v_open_orders, CASE WHEN v_open_orders = 1 THEN 'order' ELSE 'orders' END,
                        CASE WHEN v_open_orders = 1 THEN 'it is' ELSE 'they are' END)));
  END IF;

  SELECT count(DISTINCT o.id) INTO v_open_sales FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.vendor_id = p_user_id AND o.payment_status = 'paid'
    AND (o.status NOT IN ('completed', 'cancelled', 'refunded') OR o.dispute_status = 'open');
  IF v_open_sales > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'open_sales',
      'message', format('Your shop has %s %s still in progress. Finish %s first.', v_open_sales,
                        CASE WHEN v_open_sales = 1 THEN 'order' ELSE 'orders' END, CASE WHEN v_open_sales = 1 THEN 'it' ELSE 'them' END)));
  END IF;

  SELECT COALESCE(sum(amount), 0) INTO v_owed FROM public.payouts
  WHERE vendor_id = p_user_id AND status IN ('held', 'on_hold', 'pending', 'processing', 'failed');
  IF v_owed > 0 THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'payouts',
      'message', format('Kano Kaftan still owes you ₦%s. We''ll pay it first; contact us if you need it sooner.', to_char(v_owed, 'FM999,999,999'))));
  END IF;

  IF EXISTS (SELECT 1 FROM public.ambassadors WHERE user_id = p_user_id)
     OR EXISTS (SELECT 1 FROM public.partner_members WHERE user_id = p_user_id) THEN
    v_blockers := v_blockers || jsonb_build_array(jsonb_build_object('code', 'programme',
      'message', 'You''re an ambassador or partner. Message Kano Kaftan so we can settle your earnings before deleting.'));
  END IF;

  v_k2 := public.customer_credit_balance(p_user_id);
  v_history := EXISTS (SELECT 1 FROM public.orders WHERE user_id = p_user_id)
            OR EXISTS (SELECT 1 FROM public.order_items WHERE vendor_id = p_user_id)
            OR EXISTS (SELECT 1 FROM public.payouts WHERE vendor_id = p_user_id);

  RETURN jsonb_build_object('can_delete', jsonb_array_length(v_blockers) = 0, 'blockers', v_blockers,
                            'k2_balance', COALESCE(v_k2, 0), 'keeps_records', v_history,
                            'has_shop', EXISTS (SELECT 1 FROM public.profiles WHERE id = p_user_id AND store_name IS NOT NULL));
END;
$$;

CREATE OR REPLACE FUNCTION public.scrub_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status JSONB := public.account_deletion_status(p_user_id);
  v_keep BOOLEAN := (v_status ->> 'keeps_records')::BOOLEAN;
BEGIN
  IF NOT (v_status ->> 'can_delete')::BOOLEAN THEN
    RETURN jsonb_build_object('ok', false, 'status', v_status);
  END IF;

  -- Personal things nobody else needs.
  DELETE FROM public.cart_items WHERE user_id = p_user_id;
  DELETE FROM public.wishlists WHERE user_id = p_user_id;
  DELETE FROM public.delivery_addresses WHERE user_id = p_user_id;
  DELETE FROM public.push_subscriptions WHERE user_id = p_user_id;
  DELETE FROM public.user_devices WHERE user_id = p_user_id;
  DELETE FROM public.customer_bank_accounts WHERE user_id = p_user_id;
  DELETE FROM public.customer_credits WHERE user_id = p_user_id;
  DELETE FROM public.customer_referral_codes WHERE user_id = p_user_id;
  DELETE FROM public.shop_follows WHERE user_id = p_user_id OR vendor_id = p_user_id;
  DELETE FROM public.shop_likes WHERE user_id = p_user_id OR vendor_id = p_user_id;
  DELETE FROM public.story_views WHERE user_id = p_user_id;
  DELETE FROM public.story_likes WHERE user_id = p_user_id;
  DELETE FROM public.vendor_stories WHERE vendor_id = p_user_id;
  DELETE FROM public.message_reactions WHERE user_id = p_user_id;
  DELETE FROM public.user_blocks WHERE blocker_id = p_user_id OR blocked_id = p_user_id;
  DELETE FROM public.notifications WHERE user_id = p_user_id;
  DELETE FROM public.reviews WHERE user_id = p_user_id;
  DELETE FROM public.logistics_members WHERE user_id = p_user_id;
  DELETE FROM public.user_trust_dismissals WHERE user_id = p_user_id;
  DELETE FROM public.user_trust_flags_cache WHERE user_id = p_user_id;
  DELETE FROM public.ambassador_applications WHERE user_id = p_user_id;
  DELETE FROM public.vendor_applications WHERE user_id = p_user_id;
  DELETE FROM public.vendor_payout_accounts WHERE vendor_id = p_user_id;
  DELETE FROM public.vendor_verification_requests WHERE vendor_id = p_user_id;
  DELETE FROM public.featured_placements WHERE vendor_id = p_user_id;
  DELETE FROM public.admin_alert_settings WHERE user_id = p_user_id;
  -- Chats and calls (messages and calls go with their conversation).
  DELETE FROM public.calls WHERE caller_id = p_user_id OR callee_id = p_user_id;
  DELETE FROM public.conversations WHERE customer_id = p_user_id OR vendor_id = p_user_id;
  UPDATE public.analytics_events SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.client_errors SET last_user_id = NULL WHERE last_user_id = p_user_id;

  IF v_keep THEN
    -- Keep orders, sales and payouts for the books, without anything that identifies the person.
    UPDATE public.orders SET shipping_address = jsonb_build_object('full_name', 'Deleted user'), notes = NULL
    WHERE user_id = p_user_id;
    UPDATE public.products SET is_active = false WHERE vendor_id = p_user_id;
    DELETE FROM public.user_roles WHERE user_id = p_user_id;
    UPDATE public.profiles
    SET full_name = 'Deleted user', email = 'deleted-' || p_user_id || '@users.kanokaftan.shop', phone = NULL, avatar_url = NULL,
        store_name = NULL, store_slug = NULL, store_description = NULL, store_address = NULL, store_banner_url = NULL,
        bank_name = NULL, account_number = NULL, account_name = NULL, is_verified = false, verification_tier = NULL,
        verified_until = NULL, shop_featured_until = NULL, last_seen_at = NULL, updated_at = now()
    WHERE id = p_user_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'mode', CASE WHEN v_keep THEN 'anonymised' ELSE 'deleted' END,
                            'has_shop', (v_status ->> 'has_shop')::BOOLEAN);
END;
$$;

REVOKE ALL ON FUNCTION public.account_deletion_status(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.account_deletion_status(UUID) TO service_role;
REVOKE ALL ON FUNCTION public.scrub_account(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.scrub_account(UUID) TO service_role;
