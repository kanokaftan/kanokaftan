-- Ambassador referral links.
--
-- An admin registers each ambassador, who gets a unique code and a link
-- (kanokaftan.shop/r/CODE). Someone who opens the link and then applies to
-- SELL on Kano Kaftan is credited to that ambassador. Customers who sign up
-- through the link are not counted.
--
-- Bonus states for each referred seller:
--   signed_up  applied through the link, waiting for admin approval
--   approved   admin approved the shop, waiting for its first completed sale
--   earned     first paid order delivered: the ambassador has earned the bonus
--   paid       an admin marked the bonus as paid
--   rejected   the application was rejected (no bonus)

SET lock_timeout = '10s';

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS ambassador_seller_reward NUMERIC(12, 2) NOT NULL DEFAULT 3000
  CHECK (ambassador_seller_reward >= 0);

COMMENT ON COLUMN public.platform_settings.ambassador_seller_reward IS 'Bonus an ambassador earns when a seller they referred makes a first completed sale.';

CREATE TABLE IF NOT EXISTS public.ambassadors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[A-Z0-9]{4,16}$'),
  full_name TEXT NOT NULL CHECK (char_length(btrim(full_name)) >= 2),
  phone TEXT,
  email TEXT,
  bank_name TEXT,
  account_number TEXT,
  account_name TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  link_visits INTEGER NOT NULL DEFAULT 0,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- No foreign keys to auth.users / profiles / orders: adding one locks those busy
-- tables on the live database. seller_id is a user id; lookups use LEFT JOINs.
CREATE TABLE IF NOT EXISTS public.seller_referrals (
  seller_id UUID PRIMARY KEY,
  ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'signed_up' CHECK (status IN ('signed_up', 'approved', 'earned', 'paid', 'rejected')),
  reward_amount NUMERIC(12, 2),
  source TEXT NOT NULL DEFAULT 'link' CHECK (source IN ('link', 'admin')),
  approved_at TIMESTAMPTZ,
  first_sale_order_id UUID,
  earned_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  paid_by UUID,
  payment_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS seller_referrals_ambassador_idx ON public.seller_referrals (ambassador_id, status);

ALTER TABLE public.ambassadors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seller_referrals ENABLE ROW LEVEL SECURITY;

-- Only admins read these tables directly; everyone else goes through the functions below.
DROP POLICY IF EXISTS "Admins can view ambassadors" ON public.ambassadors;
CREATE POLICY "Admins can view ambassadors" ON public.ambassadors FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "Admins can view seller referrals" ON public.seller_referrals;
CREATE POLICY "Admins can view seller referrals" ON public.seller_referrals FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

DROP TRIGGER IF EXISTS update_ambassadors_updated_at ON public.ambassadors;
CREATE TRIGGER update_ambassadors_updated_at BEFORE UPDATE ON public.ambassadors
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

DROP TRIGGER IF EXISTS update_seller_referrals_updated_at ON public.seller_referrals;
CREATE TRIGGER update_seller_referrals_updated_at BEFORE UPDATE ON public.seller_referrals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------------------------------------------------------------------------
-- Codes
-- ---------------------------------------------------------------------------

/** Turns whatever was typed or pasted ("amina-42 ", "Amina42") into the stored form. */
CREATE OR REPLACE FUNCTION public.normalize_ambassador_code(p_code TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(upper(regexp_replace(COALESCE(p_code, ''), '[^A-Za-z0-9]', '', 'g')), '')
$$;

/** A new unique code: up to 6 letters of the first name plus 3 random digits, e.g. AMINA482. */
CREATE OR REPLACE FUNCTION public.new_ambassador_code(p_full_name TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_base TEXT := left(upper(regexp_replace(split_part(btrim(COALESCE(p_full_name, '')), ' ', 1), '[^A-Za-z]', '', 'g')), 6);
  v_code TEXT;
BEGIN
  IF char_length(v_base) < 2 THEN
    v_base := 'KK';
  END IF;
  LOOP
    v_code := v_base || lpad((floor(random() * 1000))::INT::TEXT, 3, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.ambassadors WHERE code = v_code);
  END LOOP;
  RETURN v_code;
END;
$$;

-- ---------------------------------------------------------------------------
-- Public: the link
-- ---------------------------------------------------------------------------

/** For the seller sign-up page: who invited you (first name only), or nothing if the code is unknown. */
CREATE OR REPLACE FUNCTION public.get_ambassador_invite(p_code TEXT)
RETURNS TABLE (code TEXT, first_name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT a.code, split_part(btrim(a.full_name), ' ', 1)
  FROM public.ambassadors a
  WHERE a.code = public.normalize_ambassador_code(p_code) AND a.is_active
$$;

/** Counts a visit to an ambassador's link (the app calls it once per browser session). */
CREATE OR REPLACE FUNCTION public.record_ambassador_visit(p_code TEXT)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.ambassadors SET link_visits = link_visits + 1
  WHERE code = public.normalize_ambassador_code(p_code) AND is_active
$$;

-- ---------------------------------------------------------------------------
-- Crediting a seller to an ambassador
-- ---------------------------------------------------------------------------

/**
 * Links a seller applicant to the ambassador behind `p_code`. Only counts for
 * people who applied to sell, who are not sellers already, who have not been
 * credited before, and who are not the ambassador themselves.
 * Returns true when the referral was recorded.
 */
CREATE OR REPLACE FUNCTION public.attach_seller_referral(p_seller_id UUID, p_code TEXT, p_source TEXT DEFAULT 'link')
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ambassador public.ambassadors%ROWTYPE;
  v_profile public.profiles%ROWTYPE;
  v_app_status TEXT;
  v_digits_seller TEXT;
  v_digits_ambassador TEXT;
BEGIN
  SELECT * INTO v_ambassador FROM public.ambassadors
  WHERE code = public.normalize_ambassador_code(p_code) AND is_active;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  SELECT status INTO v_app_status FROM public.vendor_applications WHERE user_id = p_seller_id;
  IF v_app_status IS NULL THEN
    RETURN false; -- customers only: no seller application, no credit
  END IF;

  -- Someone who was already selling before the link doesn't count.
  -- (An admin may still credit them by hand.)
  IF p_source = 'link' AND (
    v_app_status = 'approved'
    OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = p_seller_id AND role = 'vendor')
  ) THEN
    RETURN false;
  END IF;

  -- No referring yourself (same email or same phone number).
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_seller_id;
  IF v_ambassador.email IS NOT NULL AND lower(btrim(v_ambassador.email)) = lower(btrim(COALESCE(v_profile.email, ''))) THEN
    RETURN false;
  END IF;
  v_digits_seller := right(regexp_replace(COALESCE(v_profile.phone, ''), '\D', '', 'g'), 10);
  v_digits_ambassador := right(regexp_replace(COALESCE(v_ambassador.phone, ''), '\D', '', 'g'), 10);
  IF char_length(v_digits_ambassador) = 10 AND v_digits_ambassador = v_digits_seller THEN
    RETURN false;
  END IF;

  INSERT INTO public.seller_referrals (seller_id, ambassador_id, source, status, approved_at)
  VALUES (
    p_seller_id, v_ambassador.id, p_source,
    CASE v_app_status WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'signed_up' END,
    CASE WHEN v_app_status = 'approved' THEN now() END
  )
  ON CONFLICT (seller_id) DO NOTHING;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_seller_referral(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

/** A signed-in customer who applies to sell after opening an ambassador's link. */
CREATE OR REPLACE FUNCTION public.claim_seller_referral(p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;
  RETURN public.attach_seller_referral(auth.uid(), p_code, 'link');
END;
$$;

-- New sign-ups from the seller page carry the code in their sign-up details.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meta JSONB := COALESCE(NEW.raw_user_meta_data, '{}'::jsonb);
  v_app JSONB := v_meta -> 'vendor_application';
  v_name TEXT := COALESCE(NULLIF(btrim(v_meta ->> 'full_name'), ''), NULLIF(btrim(v_meta ->> 'name'), ''), '');
  v_phone TEXT := NULLIF(left(btrim(COALESCE(v_meta ->> 'phone', '')), 20), '');
BEGIN
  INSERT INTO public.profiles (id, email, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.email, ''), v_name, v_phone);

  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;

  IF jsonb_typeof(v_app) = 'object'
     AND char_length(btrim(COALESCE(v_app ->> 'shop_name', ''))) >= 2 THEN
    PERFORM public.save_vendor_application(
      NEW.id,
      v_name,
      v_app ->> 'shop_name',
      COALESCE(NULLIF(btrim(v_app ->> 'phone'), ''), v_phone, ''),
      COALESCE(v_app ->> 'city', ''),
      COALESCE(v_app ->> 'state', ''),
      COALESCE(v_app ->> 'description', '')
    );

    -- A referral must never stop someone signing up.
    IF NULLIF(btrim(COALESCE(v_meta ->> 'ambassador_code', '')), '') IS NOT NULL THEN
      BEGIN
        PERFORM public.attach_seller_referral(NEW.id, v_meta ->> 'ambassador_code', 'link');
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'handle_new_user: could not record ambassador referral for %: %', NEW.id, SQLERRM;
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Progress: approval and first sale
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sync_referral_with_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved' THEN
    UPDATE public.seller_referrals SET status = 'approved', approved_at = COALESCE(approved_at, now())
    WHERE seller_id = NEW.user_id AND status IN ('signed_up', 'rejected');
  ELSIF NEW.status = 'rejected' THEN
    UPDATE public.seller_referrals SET status = 'rejected'
    WHERE seller_id = NEW.user_id AND status = 'signed_up';
  ELSIF NEW.status = 'pending' THEN
    UPDATE public.seller_referrals SET status = 'signed_up'
    WHERE seller_id = NEW.user_id AND status = 'rejected';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS vendor_applications_sync_referral ON public.vendor_applications;
CREATE TRIGGER vendor_applications_sync_referral
AFTER UPDATE OF status ON public.vendor_applications
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION public.sync_referral_with_application();

/** First paid order delivered for an approved referred seller: the ambassador earns the bonus. */
CREATE OR REPLACE FUNCTION public.mark_referral_first_sale()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reward NUMERIC;
  v_row RECORD;
BEGIN
  IF NEW.payment_status IS DISTINCT FROM 'paid' OR NEW.status NOT IN ('delivered', 'completed') THEN
    RETURN NEW;
  END IF;

  SELECT ambassador_seller_reward INTO v_reward FROM public.platform_settings WHERE id = 1;

  FOR v_row IN
    UPDATE public.seller_referrals r
    SET status = 'earned', earned_at = now(), first_sale_order_id = NEW.id, reward_amount = COALESCE(v_reward, 0)
    WHERE r.status = 'approved'
      AND r.seller_id IN (SELECT DISTINCT oi.vendor_id FROM public.order_items oi WHERE oi.order_id = NEW.id AND oi.vendor_id IS NOT NULL)
    RETURNING r.seller_id, r.ambassador_id, r.reward_amount
  LOOP
    INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
    SELECT ur.user_id, 'Ambassador bonus earned',
           format('%s earned ₦%s: %s made its first sale.',
                  (SELECT full_name FROM public.ambassadors WHERE id = v_row.ambassador_id),
                  to_char(v_row.reward_amount, 'FM999,999,990'),
                  COALESCE((SELECT store_name FROM public.profiles WHERE id = v_row.seller_id), 'A referred shop')),
           'success', 'system', '/admin/ambassadors'
    FROM public.user_roles ur WHERE ur.role = 'admin';
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_mark_referral_first_sale ON public.orders;
CREATE TRIGGER orders_mark_referral_first_sale
AFTER UPDATE OF status, payment_status ON public.orders
FOR EACH ROW WHEN (NEW.status IN ('delivered', 'completed') AND NEW.payment_status = 'paid')
EXECUTE FUNCTION public.mark_referral_first_sale();

REVOKE EXECUTE ON FUNCTION public.sync_referral_with_application() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_referral_first_sale() FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------

/** Creates (p_id NULL) or updates an ambassador. A code is generated when none is given. */
CREATE OR REPLACE FUNCTION public.admin_save_ambassador(
  p_id UUID,
  p_full_name TEXT,
  p_phone TEXT DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_bank_name TEXT DEFAULT NULL,
  p_account_number TEXT DEFAULT NULL,
  p_account_name TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_is_active BOOLEAN DEFAULT true,
  p_code TEXT DEFAULT NULL
)
RETURNS public.ambassadors
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.ambassadors%ROWTYPE;
  v_code TEXT := public.normalize_ambassador_code(p_code);
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can manage ambassadors';
  END IF;
  IF char_length(btrim(COALESCE(p_full_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Enter the ambassador''s name';
  END IF;
  IF v_code IS NOT NULL AND v_code !~ '^[A-Z0-9]{4,16}$' THEN
    RAISE EXCEPTION 'The code must be 4 to 16 letters or numbers';
  END IF;
  IF v_code IS NOT NULL AND EXISTS (SELECT 1 FROM public.ambassadors WHERE code = v_code AND id IS DISTINCT FROM p_id) THEN
    RAISE EXCEPTION 'Another ambassador already uses the code %', v_code;
  END IF;
  IF NULLIF(btrim(COALESCE(p_account_number, '')), '') IS NOT NULL AND btrim(p_account_number) !~ '^[0-9]{10}$' THEN
    RAISE EXCEPTION 'The account number must be 10 digits';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.ambassadors (code, full_name, phone, email, bank_name, account_number, account_name, notes, is_active, created_by)
    VALUES (
      COALESCE(v_code, public.new_ambassador_code(p_full_name)),
      btrim(p_full_name), NULLIF(btrim(p_phone), ''), NULLIF(lower(btrim(p_email)), ''),
      NULLIF(btrim(p_bank_name), ''), NULLIF(btrim(p_account_number), ''), NULLIF(btrim(p_account_name), ''),
      NULLIF(btrim(p_notes), ''), COALESCE(p_is_active, true), auth.uid()
    )
    RETURNING * INTO v_row;
  ELSE
    UPDATE public.ambassadors SET
      code = COALESCE(v_code, code),
      full_name = btrim(p_full_name),
      phone = NULLIF(btrim(p_phone), ''),
      email = NULLIF(lower(btrim(p_email)), ''),
      bank_name = NULLIF(btrim(p_bank_name), ''),
      account_number = NULLIF(btrim(p_account_number), ''),
      account_name = NULLIF(btrim(p_account_name), ''),
      notes = NULLIF(btrim(p_notes), ''),
      is_active = COALESCE(p_is_active, is_active)
    WHERE id = p_id
    RETURNING * INTO v_row;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Ambassador not found';
    END IF;
  END IF;

  RETURN v_row;
END;
$$;

/** One row per ambassador with their numbers, for the admin list. */
CREATE OR REPLACE FUNCTION public.admin_ambassador_overview()
RETURNS TABLE (
  id UUID, code TEXT, full_name TEXT, phone TEXT, email TEXT,
  bank_name TEXT, account_number TEXT, account_name TEXT, notes TEXT,
  is_active BOOLEAN, link_visits INTEGER, created_at TIMESTAMPTZ,
  sign_ups BIGINT, approved BIGINT, selling BIGINT,
  owed NUMERIC, paid NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can see ambassadors';
  END IF;
  RETURN QUERY
  SELECT a.id, a.code, a.full_name, a.phone, a.email,
         a.bank_name, a.account_number, a.account_name, a.notes,
         a.is_active, a.link_visits, a.created_at,
         count(r.seller_id) FILTER (WHERE r.status <> 'rejected'),
         count(r.seller_id) FILTER (WHERE r.status IN ('approved', 'earned', 'paid')),
         count(r.seller_id) FILTER (WHERE r.status IN ('earned', 'paid')),
         COALESCE(sum(r.reward_amount) FILTER (WHERE r.status = 'earned'), 0),
         COALESCE(sum(r.reward_amount) FILTER (WHERE r.status = 'paid'), 0)
  FROM public.ambassadors a
  LEFT JOIN public.seller_referrals r ON r.ambassador_id = a.id
  GROUP BY a.id
  ORDER BY a.is_active DESC, COALESCE(sum(r.reward_amount) FILTER (WHERE r.status = 'earned'), 0) DESC, a.created_at DESC;
END;
$$;

/** The sellers one ambassador brought in. */
CREATE OR REPLACE FUNCTION public.admin_ambassador_referrals(p_ambassador_id UUID)
RETURNS TABLE (
  seller_id UUID, shop_name TEXT, seller_name TEXT, seller_phone TEXT,
  status TEXT, source TEXT, reward_amount NUMERIC,
  created_at TIMESTAMPTZ, approved_at TIMESTAMPTZ, earned_at TIMESTAMPTZ, paid_at TIMESTAMPTZ, payment_note TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can see referrals';
  END IF;
  RETURN QUERY
  SELECT r.seller_id,
         COALESCE(NULLIF(p.store_name, ''), va.shop_name),
         COALESCE(NULLIF(p.full_name, ''), va.full_name),
         COALESCE(NULLIF(va.phone, ''), p.phone),
         r.status, r.source, r.reward_amount,
         r.created_at, r.approved_at, r.earned_at, r.paid_at, r.payment_note
  FROM public.seller_referrals r
  LEFT JOIN public.profiles p ON p.id = r.seller_id
  LEFT JOIN public.vendor_applications va ON va.user_id = r.seller_id
  WHERE r.ambassador_id = p_ambassador_id
  ORDER BY (r.status = 'earned') DESC, r.created_at DESC;
END;
$$;

/** Records that an earned bonus was paid (bank transfer, cash...). */
CREATE OR REPLACE FUNCTION public.admin_mark_referral_paid(p_seller_id UUID, p_note TEXT DEFAULT NULL)
RETURNS public.seller_referrals
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.seller_referrals%ROWTYPE;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can record bonus payments';
  END IF;
  UPDATE public.seller_referrals
  SET status = 'paid', paid_at = now(), paid_by = auth.uid(), payment_note = NULLIF(btrim(p_note), '')
  WHERE seller_id = p_seller_id AND status = 'earned'
  RETURNING * INTO v_row;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Only an earned bonus can be marked as paid';
  END IF;
  RETURN v_row;
END;
$$;

/** Credits a seller to an ambassador by hand (e.g. they forgot to use the link). */
CREATE OR REPLACE FUNCTION public.admin_assign_seller_referral(p_seller_id UUID, p_code TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can assign referrals';
  END IF;
  IF EXISTS (SELECT 1 FROM public.seller_referrals WHERE seller_id = p_seller_id) THEN
    RAISE EXCEPTION 'This seller is already credited to an ambassador';
  END IF;
  IF NOT public.attach_seller_referral(p_seller_id, p_code, 'admin') THEN
    RAISE EXCEPTION 'Could not credit this seller: check the code, and that the seller has applied to sell';
  END IF;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.get_ambassador_invite(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.record_ambassador_visit(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_seller_referral(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_save_ambassador(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_ambassador_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_ambassador_referrals(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_mark_referral_paid(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_assign_seller_referral(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.new_ambassador_code(TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_ambassador_invite(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_ambassador_visit(TEXT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_seller_referral(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_save_ambassador(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ambassador_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_ambassador_referrals(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_mark_referral_paid(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_seller_referral(UUID, TEXT) TO authenticated;
