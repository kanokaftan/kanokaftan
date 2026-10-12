-- Followers, shop likes and reviews.
--   * Customers can like a shop (heart), alongside following it.
--   * Sellers see who follows and who liked their shop, and get a notification.
--   * Customers review what they bought once it is delivered; sellers reply.
--   * Reviews are locked down: a review must be for the product actually bought,
--     a seller can only write the reply, and a customer can't fake the reply.

-- ── Shop likes ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_likes (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, vendor_id),
  CHECK (user_id <> vendor_id)
);
CREATE INDEX IF NOT EXISTS shop_likes_vendor_idx ON public.shop_likes (vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS shop_follows_vendor_created_idx ON public.shop_follows (vendor_id, created_at DESC);

ALTER TABLE public.shop_likes ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shop_likes' AND policyname = 'Users can see the shops they like') THEN
    CREATE POLICY "Users can see the shops they like" ON public.shop_likes FOR SELECT USING (user_id = auth.uid());
  END IF;
END $$;
-- Likes are added and removed only through set_shop_like().
REVOKE INSERT, UPDATE, DELETE ON public.shop_likes FROM anon, authenticated;

/** Like or unlike a shop. Returns the new state and the shop's like count. */
CREATE OR REPLACE FUNCTION public.set_shop_like(p_vendor_id UUID, p_like BOOLEAN)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Please sign in to like shops';
  END IF;
  IF v_user = p_vendor_id THEN
    RAISE EXCEPTION 'You can''t like your own shop';
  END IF;
  IF NOT public.has_role(p_vendor_id, 'vendor') THEN
    RAISE EXCEPTION 'Shop not found';
  END IF;

  IF p_like THEN
    INSERT INTO public.shop_likes (user_id, vendor_id) VALUES (v_user, p_vendor_id) ON CONFLICT DO NOTHING;
  ELSE
    DELETE FROM public.shop_likes WHERE user_id = v_user AND vendor_id = p_vendor_id;
  END IF;

  RETURN jsonb_build_object(
    'liked', p_like,
    'like_count', (SELECT count(*) FROM public.shop_likes WHERE vendor_id = p_vendor_id)
  );
END;
$$;

/** Follower and like counts for a shop, plus whether the viewer follows / likes it. */
CREATE OR REPLACE FUNCTION public.get_shop_social(p_vendor_id UUID)
RETURNS TABLE (follower_count BIGINT, like_count BIGINT, i_follow BOOLEAN, i_like BOOLEAN)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.shop_follows WHERE vendor_id = p_vendor_id),
    (SELECT count(*) FROM public.shop_likes WHERE vendor_id = p_vendor_id),
    COALESCE((SELECT true FROM public.shop_follows WHERE vendor_id = p_vendor_id AND user_id = auth.uid()), false),
    COALESCE((SELECT true FROM public.shop_likes WHERE vendor_id = p_vendor_id AND user_id = auth.uid()), false)
$$;

-- ── Tell the seller about new followers and likes ─────────────────────────
/** The name a seller sees for a customer: first name, else a friendly default. */
CREATE OR REPLACE FUNCTION public.shopper_display_name(p_user_id UUID)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT NULLIF(btrim(COALESCE(NULLIF(store_name, ''), full_name)), '') FROM public.profiles WHERE id = p_user_id),
    'A shopper'
  )
$$;

/** One alert per person per kind per day, so follow/unfollow taps don't spam the seller. */
CREATE OR REPLACE FUNCTION public.shop_fan_alert_window()
RETURNS interval LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT interval '1 day' $$;

CREATE OR REPLACE FUNCTION public.notify_vendor_of_new_fan()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind TEXT := CASE WHEN TG_TABLE_NAME = 'shop_likes' THEN 'like' ELSE 'follow' END;
  v_name TEXT := public.shopper_display_name(NEW.user_id);
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.notifications
    WHERE user_id = NEW.vendor_id
      AND metadata ->> 'fan_kind' = v_kind
      AND metadata ->> 'fan_id' = NEW.user_id::text
      AND created_at > now() - public.shop_fan_alert_window()
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
  VALUES (
    NEW.vendor_id,
    CASE v_kind WHEN 'like' THEN 'Someone liked your shop' ELSE 'New follower' END,
    CASE v_kind WHEN 'like' THEN format('%s liked your shop', v_name) ELSE format('%s started following your shop', v_name) END,
    'success', 'general',
    CASE v_kind WHEN 'like' THEN '/vendor/fans?tab=likes' ELSE '/vendor/fans?tab=followers' END,
    jsonb_build_object('fan_kind', v_kind, 'fan_id', NEW.user_id)
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never stop a follow or like because the alert failed.
  RAISE WARNING 'notify_vendor_of_new_fan failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER shop_follows_notify_vendor
  AFTER INSERT ON public.shop_follows
  FOR EACH ROW EXECUTE FUNCTION public.notify_vendor_of_new_fan();
CREATE OR REPLACE TRIGGER shop_likes_notify_vendor
  AFTER INSERT ON public.shop_likes
  FOR EACH ROW EXECUTE FUNCTION public.notify_vendor_of_new_fan();

-- ── Seller: who follows / likes my shop ───────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_shop_fans(p_kind TEXT, p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  user_id UUID,
  name TEXT,
  avatar_url TEXT,
  since TIMESTAMPTZ,
  follows BOOLEAN,
  likes BOOLEAN,
  orders_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID := auth.uid();
BEGIN
  IF v_vendor IS NULL OR NOT public.has_role(v_vendor, 'vendor') THEN
    RAISE EXCEPTION 'Sellers only';
  END IF;
  IF p_kind NOT IN ('followers', 'likes') THEN
    RAISE EXCEPTION 'Unknown list %', p_kind;
  END IF;

  RETURN QUERY
  WITH fans AS (
    SELECT f.user_id, f.created_at FROM public.shop_follows f WHERE p_kind = 'followers' AND f.vendor_id = v_vendor
    UNION ALL
    SELECT l.user_id, l.created_at FROM public.shop_likes l WHERE p_kind = 'likes' AND l.vendor_id = v_vendor
  )
  SELECT
    fans.user_id,
    public.shopper_display_name(fans.user_id),
    p.avatar_url,
    fans.created_at,
    EXISTS (SELECT 1 FROM public.shop_follows f WHERE f.vendor_id = v_vendor AND f.user_id = fans.user_id),
    EXISTS (SELECT 1 FROM public.shop_likes l WHERE l.vendor_id = v_vendor AND l.user_id = fans.user_id),
    (SELECT count(DISTINCT o.id) FROM public.orders o JOIN public.order_items oi ON oi.order_id = o.id
      WHERE o.user_id = fans.user_id AND oi.vendor_id = v_vendor AND o.payment_status = 'paid')
  FROM fans
  LEFT JOIN public.profiles p ON p.id = fans.user_id
  ORDER BY fans.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

/** Headline numbers for the seller's "Your fans" card. */
CREATE OR REPLACE FUNCTION public.get_my_shop_fan_summary()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID := auth.uid();
BEGIN
  IF v_vendor IS NULL OR NOT public.has_role(v_vendor, 'vendor') THEN
    RAISE EXCEPTION 'Sellers only';
  END IF;
  RETURN jsonb_build_object(
    'followers', (SELECT count(*) FROM public.shop_follows WHERE vendor_id = v_vendor),
    'followers_week', (SELECT count(*) FROM public.shop_follows WHERE vendor_id = v_vendor AND created_at > now() - interval '7 days'),
    'likes', (SELECT count(*) FROM public.shop_likes WHERE vendor_id = v_vendor),
    'likes_week', (SELECT count(*) FROM public.shop_likes WHERE vendor_id = v_vendor AND created_at > now() - interval '7 days'),
    'reviews', (SELECT count(*) FROM public.reviews r JOIN public.products p ON p.id = r.product_id
                WHERE p.vendor_id = v_vendor AND r.is_approved),
    'rating', (SELECT round(avg(r.rating)::numeric, 1) FROM public.reviews r JOIN public.products p ON p.id = r.product_id
               WHERE p.vendor_id = v_vendor AND r.is_approved),
    'awaiting_reply', (SELECT count(*) FROM public.reviews r JOIN public.products p ON p.id = r.product_id
                       WHERE p.vendor_id = v_vendor AND r.is_approved AND r.seller_reply IS NULL)
  );
END;
$$;

-- ── Reviews: who may write what ───────────────────────────────────────────
-- Buyers can review as soon as the order is delivered (the old rule waited for
-- "completed", which only happens after the buyer confirms or the hold ends).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'reviews' AND policyname = 'Users can review delivered purchases') THEN
    CREATE POLICY "Users can review delivered purchases"
    ON public.reviews FOR INSERT
    WITH CHECK (
      auth.uid() = user_id AND
      EXISTS (
        SELECT 1 FROM public.order_items oi
        JOIN public.orders o ON o.id = oi.order_id
        WHERE oi.id = order_item_id AND o.user_id = auth.uid() AND o.status IN ('delivered', 'completed')
      )
    );
  END IF;
END $$;

/** Longest review or reply we keep. */
CREATE OR REPLACE FUNCTION public.review_text_limit()
RETURNS INTEGER LANGUAGE sql IMMUTABLE SET search_path = public AS $$ SELECT 2000 $$;

CREATE OR REPLACE FUNCTION public.guard_review_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_actor UUID := auth.uid();
BEGIN
  -- Server-side jobs and admins are trusted.
  IF v_actor IS NULL OR public.has_role(v_actor, 'admin') THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.order_items oi JOIN public.orders o ON o.id = oi.order_id
      WHERE oi.id = NEW.order_item_id AND oi.product_id = NEW.product_id AND o.user_id = v_actor
    ) THEN
      RAISE EXCEPTION 'You can only review items you bought';
    END IF;
    IF EXISTS (SELECT 1 FROM public.reviews WHERE user_id = v_actor AND product_id = NEW.product_id) THEN
      RAISE EXCEPTION 'You have already reviewed this item';
    END IF;
    NEW.user_id := v_actor;
    NEW.seller_reply := NULL;
    NEW.seller_replied_at := NULL;
    NEW.is_approved := true;
    NEW.review_text := left(NULLIF(btrim(NEW.review_text), ''), public.review_text_limit());
    RETURN NEW;
  END IF;

  -- UPDATE
  IF v_actor = OLD.user_id THEN
    -- The buyer may change their stars, words, photos and fit notes only.
    NEW.user_id := OLD.user_id;
    NEW.product_id := OLD.product_id;
    NEW.order_item_id := OLD.order_item_id;
    NEW.seller_reply := OLD.seller_reply;
    NEW.seller_replied_at := OLD.seller_replied_at;
    NEW.is_approved := OLD.is_approved;
    NEW.created_at := OLD.created_at;
    NEW.review_text := left(NULLIF(btrim(NEW.review_text), ''), public.review_text_limit());
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.products p WHERE p.id = OLD.product_id AND p.vendor_id = v_actor) THEN
    -- The seller may only write the reply.
    NEW.seller_reply := left(NULLIF(btrim(NEW.seller_reply), ''), public.review_text_limit());
    NEW.seller_replied_at := CASE WHEN NEW.seller_reply IS NULL THEN NULL
                                  WHEN NEW.seller_reply IS DISTINCT FROM OLD.seller_reply THEN now()
                                  ELSE OLD.seller_replied_at END;
    NEW.user_id := OLD.user_id;
    NEW.product_id := OLD.product_id;
    NEW.order_item_id := OLD.order_item_id;
    NEW.rating := OLD.rating;
    NEW.review_text := OLD.review_text;
    NEW.photos := OLD.photos;
    NEW.fit_feedback := OLD.fit_feedback;
    NEW.would_recommend := OLD.would_recommend;
    NEW.is_approved := OLD.is_approved;
    NEW.created_at := OLD.created_at;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'You can''t change this review';
END;
$$;

CREATE OR REPLACE TRIGGER reviews_guard_changes
  BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.guard_review_changes();

-- ── Review alerts ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.notify_review_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_product RECORD;
BEGIN
  SELECT p.name, p.slug, p.vendor_id, COALESCE(NULLIF(v.store_name, ''), 'The seller') AS store
  INTO v_product
  FROM public.products p LEFT JOIN public.profiles v ON v.id = p.vendor_id
  WHERE p.id = NEW.product_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    VALUES (
      v_product.vendor_id,
      format('New %s-star review', NEW.rating),
      format('%s on %s%s', public.shopper_display_name(NEW.user_id), v_product.name,
             COALESCE(': "' || left(NEW.review_text, 80) || CASE WHEN length(NEW.review_text) > 80 THEN '…' ELSE '' END || '"', '')),
      CASE WHEN NEW.rating >= 4 THEN 'success' ELSE 'info' END,
      'review',
      '/vendor/reviews',
      jsonb_build_object('review_id', NEW.id, 'product_id', NEW.product_id)
    );
  ELSIF NEW.seller_reply IS NOT NULL AND NEW.seller_reply IS DISTINCT FROM OLD.seller_reply THEN
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url, metadata)
    VALUES (
      NEW.user_id,
      format('%s replied to your review', v_product.store),
      left(NEW.seller_reply, 120),
      'info', 'review',
      '/products/' || v_product.slug,
      jsonb_build_object('review_id', NEW.id, 'product_id', NEW.product_id)
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_review_activity failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER reviews_notify_activity
  AFTER INSERT OR UPDATE OF seller_reply ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.notify_review_activity();

-- ── Buyer: what can I review? ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_reviewable_items(p_vendor_id UUID DEFAULT NULL, p_product_id UUID DEFAULT NULL)
RETURNS TABLE (
  order_item_id UUID,
  order_id UUID,
  product_id UUID,
  product_name TEXT,
  product_slug TEXT,
  image_url TEXT,
  vendor_id UUID,
  store_name TEXT,
  variant TEXT,
  delivered_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (oi.product_id)
    oi.id, o.id, oi.product_id, COALESCE(p.name, oi.product_name), p.slug,
    (SELECT pi.url FROM public.product_images pi WHERE pi.product_id = oi.product_id
      ORDER BY pi.is_primary DESC NULLS LAST, pi.display_order NULLS LAST LIMIT 1),
    oi.vendor_id, v.store_name,
    COALESCE(oi.variant_name, NULLIF(concat_ws(' · ', oi.size, oi.color), '')),
    COALESCE(o.confirmed_at, o.updated_at)
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  JOIN public.products p ON p.id = oi.product_id
  LEFT JOIN public.profiles v ON v.id = oi.vendor_id
  WHERE o.user_id = auth.uid()
    AND o.status IN ('delivered', 'completed')
    AND (p_vendor_id IS NULL OR oi.vendor_id = p_vendor_id)
    AND (p_product_id IS NULL OR oi.product_id = p_product_id)
    AND NOT EXISTS (SELECT 1 FROM public.reviews r WHERE r.user_id = auth.uid() AND r.product_id = oi.product_id)
  ORDER BY oi.product_id, o.updated_at DESC
$$;

-- ── Seller: my reviews, and replying ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_shop_reviews(p_limit INTEGER DEFAULT 100, p_offset INTEGER DEFAULT 0)
RETURNS TABLE (
  id UUID,
  rating INTEGER,
  review_text TEXT,
  photos JSONB,
  fit_feedback TEXT,
  would_recommend BOOLEAN,
  seller_reply TEXT,
  seller_replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  reviewer_name TEXT,
  reviewer_avatar TEXT,
  product_id UUID,
  product_name TEXT,
  product_slug TEXT,
  product_image TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_vendor UUID := auth.uid();
BEGIN
  IF v_vendor IS NULL OR NOT public.has_role(v_vendor, 'vendor') THEN
    RAISE EXCEPTION 'Sellers only';
  END IF;
  RETURN QUERY
  SELECT r.id, r.rating, r.review_text, r.photos, r.fit_feedback, r.would_recommend,
         r.seller_reply, r.seller_replied_at, r.created_at,
         public.shopper_display_name(r.user_id), u.avatar_url,
         p.id, p.name, p.slug,
         (SELECT pi.url FROM public.product_images pi WHERE pi.product_id = p.id
           ORDER BY pi.is_primary DESC NULLS LAST, pi.display_order NULLS LAST LIMIT 1)
  FROM public.reviews r
  JOIN public.products p ON p.id = r.product_id
  LEFT JOIN public.profiles u ON u.id = r.user_id
  WHERE p.vendor_id = v_vendor AND r.is_approved
  ORDER BY (r.seller_reply IS NULL) DESC, r.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200)
  OFFSET GREATEST(p_offset, 0);
END;
$$;

CREATE OR REPLACE FUNCTION public.reply_to_review(p_review_id UUID, p_reply TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.reviews r JOIN public.products p ON p.id = r.product_id
    WHERE r.id = p_review_id AND p.vendor_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Review not found';
  END IF;
  -- guard_review_changes() trims the text and stamps the time.
  UPDATE public.reviews SET seller_reply = p_reply WHERE id = p_review_id;
END;
$$;

-- ── Access ────────────────────────────────────────────────────────────────
REVOKE EXECUTE ON FUNCTION public.notify_vendor_of_new_fan() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_review_activity() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_review_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.shopper_display_name(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.set_shop_like(UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_shop_fans(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_shop_fan_summary() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_reviewable_items(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_shop_reviews(INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.reply_to_review(UUID, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.set_shop_like(UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shop_social(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_shop_fans(TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_shop_fan_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_reviewable_items(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_shop_reviews(INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reply_to_review(UUID, TEXT) TO authenticated;
