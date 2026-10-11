-- Admins can read (never write) every customer <-> seller chat, and get a
-- one-call summary of a seller or a customer for the admin detail pages.
-- Sending stays limited to participants (and admins in support chats), and
-- read receipts are untouched because admins only ever SELECT.

CREATE POLICY "Admins can view all conversations" ON public.conversations
  FOR SELECT USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can view all messages" ON public.messages
  FOR SELECT USING (public.has_role((SELECT auth.uid()), 'admin'));

CREATE POLICY "Admins can view all message reactions" ON public.message_reactions
  FOR SELECT USING (public.has_role((SELECT auth.uid()), 'admin'));

-- Photos and voice notes in those chats (read only; uploads keep their own rule).
CREATE POLICY "Admins can view chat media" ON storage.objects
  FOR SELECT USING (bucket_id = 'chat-media' AND public.has_role((SELECT auth.uid()), 'admin'));

-- ---------------------------------------------------------------------------
-- Chats for one seller and/or one customer, newest first.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_list_conversations(p_vendor_id UUID DEFAULT NULL, p_customer_id UUID DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  kind TEXT,
  customer_id UUID,
  customer_name TEXT,
  customer_avatar TEXT,
  vendor_id UUID,
  vendor_name TEXT,
  vendor_avatar TEXT,
  product_name TEXT,
  last_message_at TIMESTAMPTZ,
  last_message_preview TEXT,
  last_sender_id UUID,
  message_count BIGINT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  IF p_vendor_id IS NULL AND p_customer_id IS NULL THEN RAISE EXCEPTION 'Choose a seller or a customer'; END IF;

  RETURN QUERY
  SELECT c.id, c.kind,
         c.customer_id,
         COALESCE(NULLIF(btrim(cu.full_name), ''), cu.email, 'Customer'),
         cu.avatar_url,
         c.vendor_id,
         CASE WHEN c.kind = 'support' THEN 'Kano Kaftan support' ELSE COALESCE(v.store_name, v.full_name, 'Shop') END,
         v.avatar_url,
         pr.name,
         c.last_message_at,
         c.last_message_preview,
         c.last_sender_id,
         (SELECT count(*) FROM public.messages m WHERE m.conversation_id = c.id),
         c.created_at
  FROM public.conversations c
  LEFT JOIN public.profiles cu ON cu.id = c.customer_id
  LEFT JOIN public.profiles v ON v.id = c.vendor_id
  LEFT JOIN public.products pr ON pr.id = c.product_id
  WHERE (p_vendor_id IS NULL OR (c.vendor_id = p_vendor_id AND c.kind = 'vendor'))
    AND (p_customer_id IS NULL OR c.customer_id = p_customer_id)
    AND c.last_message_at IS NOT NULL
  ORDER BY c.last_message_at DESC
  LIMIT 300;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_list_conversations(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_conversations(UUID, UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Everything about one seller in numbers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_vendor_overview(p_vendor_id UUID)
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

  WITH items AS (
    SELECT oi.*, o.payment_status, o.status AS order_status, o.created_at AS ordered_at
    FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
    WHERE oi.vendor_id = p_vendor_id
  )
  SELECT jsonb_build_object(
    'products', (SELECT count(*) FROM public.products WHERE vendor_id = p_vendor_id),
    'active_products', (SELECT count(*) FROM public.products WHERE vendor_id = p_vendor_id AND is_active),
    'out_of_stock', (SELECT count(*) FROM public.products WHERE vendor_id = p_vendor_id AND is_active AND stock_quantity <= 0),
    'orders', (SELECT count(DISTINCT order_id) FROM items),
    'paid_orders', (SELECT count(DISTINCT order_id) FROM items WHERE payment_status = 'paid'),
    'items_sold', (SELECT COALESCE(sum(quantity), 0) FROM items WHERE payment_status = 'paid'),
    'gross_sales', (SELECT COALESCE(sum(total_price), 0) FROM items WHERE payment_status = 'paid'),
    'last_order_at', (SELECT max(ordered_at) FROM items),
    'paid_out', (SELECT COALESCE(sum(amount), 0) FROM public.payouts WHERE vendor_id = p_vendor_id AND status = 'paid'),
    'payout_pending', (SELECT COALESCE(sum(amount), 0) FROM public.payouts
                       WHERE vendor_id = p_vendor_id AND status IN ('held', 'pending', 'processing', 'on_hold', 'failed')),
    'commission_earned', (SELECT COALESCE(sum(commission_amount), 0) FROM public.payouts WHERE vendor_id = p_vendor_id AND status <> 'cancelled'),
    'chats', (SELECT count(*) FROM public.conversations WHERE vendor_id = p_vendor_id AND kind = 'vendor' AND last_message_at IS NOT NULL),
    'chat_customers', (SELECT count(DISTINCT customer_id) FROM public.conversations WHERE vendor_id = p_vendor_id AND kind = 'vendor' AND last_message_at IS NOT NULL),
    'followers', (SELECT count(*) FROM public.shop_follows WHERE vendor_id = p_vendor_id),
    'reviews', (SELECT count(*) FROM public.reviews r JOIN public.products p ON p.id = r.product_id WHERE p.vendor_id = p_vendor_id),
    'rating', (SELECT round(avg(r.rating)::numeric, 1) FROM public.reviews r JOIN public.products p ON p.id = r.product_id WHERE p.vendor_id = p_vendor_id),
    'visitors_30d', (SELECT count(DISTINCT visitor_id) FROM public.analytics_events WHERE vendor_id = p_vendor_id AND created_at > now() - interval '30 days'),
    'views_30d', (SELECT count(*) FROM public.analytics_events WHERE vendor_id = p_vendor_id AND event IN ('shop_view', 'product_view') AND created_at > now() - interval '30 days'),
    'payout_account', (SELECT jsonb_build_object('bank_name', bank_name, 'account_name', account_name,
                                                 'account_number_last4', right(account_number, 4))
                       FROM public.vendor_payout_accounts WHERE vendor_id = p_vendor_id),
    'application', (SELECT jsonb_build_object('status', status, 'city', city, 'state', state, 'phone', phone,
                                              'description', description, 'created_at', created_at, 'reviewed_at', reviewed_at)
                    FROM public.vendor_applications WHERE user_id = p_vendor_id)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_vendor_overview(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_vendor_overview(UUID) TO authenticated;

-- ---------------------------------------------------------------------------
-- Everything about one customer in numbers.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.admin_customer_overview(p_user_id UUID)
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

  SELECT jsonb_build_object(
    'orders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id),
    'paid_orders', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND payment_status = 'paid'),
    'total_spent', (SELECT COALESCE(sum(total), 0) FROM public.orders WHERE user_id = p_user_id AND payment_status = 'paid'),
    'last_order_at', (SELECT max(created_at) FROM public.orders WHERE user_id = p_user_id),
    'open_disputes', (SELECT count(*) FROM public.orders WHERE user_id = p_user_id AND dispute_status = 'open'),
    'chats', (SELECT count(*) FROM public.conversations WHERE customer_id = p_user_id AND last_message_at IS NOT NULL),
    'wishlist', (SELECT count(*) FROM public.wishlists WHERE user_id = p_user_id),
    'following', (SELECT count(*) FROM public.shop_follows WHERE user_id = p_user_id),
    'reviews', (SELECT count(*) FROM public.reviews WHERE user_id = p_user_id),
    'recent_orders', (SELECT COALESCE(jsonb_agg(jsonb_build_object('id', id, 'total', total, 'status', status,
                                                                   'payment_status', payment_status, 'created_at', created_at)
                                                ORDER BY created_at DESC), '[]'::jsonb)
                      FROM (SELECT id, total, status, payment_status, created_at FROM public.orders
                            WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 10) o)
  ) INTO v_result;
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_customer_overview(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_customer_overview(UUID) TO authenticated;
