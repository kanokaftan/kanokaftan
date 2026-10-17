-- Partners (first one: Marmara Design, Founding Partner) and ambassador sign-up.
--
-- Partner programme (Founding Partner Agreement):
--   * a partner has an official store (vendor_id), a badge shown on that store
--     ("Founding Partner") and a homepage spot while the agreement runs;
--   * the partner awards its own label ("Marmara's Choice") to tailors and
--     sellers and can withdraw it at any time;
--   * the partner earns commission_percent of every Blue and Gold verification
--     payment Kano Kaftan receives during the term, renewals included, from
--     every seller EXCEPT sellers who came in through an ambassador (and except
--     the partner's own store). A refund reverses the commission;
--   * partner staff sign in with their normal account and see /partner.
--
-- Ambassador sign-up: anyone with an account can apply at /ambassadors/join;
-- an admin approves, which creates the ambassador (with their own link) and
-- connects it to their account so /ambassador works straight away.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 80),
  vendor_id UUID,                                  -- the partner's own store (profiles.id)
  badge_label TEXT NOT NULL DEFAULT 'Founding Partner' CHECK (char_length(badge_label) BETWEEN 2 AND 40),
  choice_label TEXT CHECK (choice_label IS NULL OR char_length(choice_label) BETWEEN 2 AND 40),
  commission_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (commission_percent BETWEEN 0 AND 100),
  starts_on DATE NOT NULL DEFAULT CURRENT_DATE,
  ends_on DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  show_on_homepage BOOLEAN NOT NULL DEFAULT true,
  homepage_title TEXT,
  homepage_tagline TEXT,
  bank_name TEXT,
  account_name TEXT,
  account_number TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_members (
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (partner_id, user_id)
);
CREATE INDEX IF NOT EXISTS partner_members_user_idx ON public.partner_members (user_id);

CREATE TABLE IF NOT EXISTS public.partner_choices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL,
  note TEXT CHECK (note IS NULL OR char_length(note) <= 200),
  awarded_by UUID,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at TIMESTAMPTZ,
  withdrawn_by UUID
);
CREATE UNIQUE INDEX IF NOT EXISTS partner_choices_active_idx ON public.partner_choices (partner_id, vendor_id) WHERE withdrawn_at IS NULL;

CREATE TABLE IF NOT EXISTS public.partner_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  items INTEGER NOT NULL,
  reference TEXT,
  note TEXT,
  paid_by UUID,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  verification_request_id UUID NOT NULL,
  vendor_id UUID NOT NULL,
  tier TEXT NOT NULL,
  payment_amount NUMERIC(12,2) NOT NULL,
  payment_paid_at TIMESTAMPTZ NOT NULL,
  commission_percent NUMERIC(5,2) NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'reversed')),
  payout_id UUID REFERENCES public.partner_payouts(id),
  reversed_reason TEXT,
  reversed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, verification_request_id, payment_paid_at)
);
CREATE INDEX IF NOT EXISTS partner_commissions_partner_idx ON public.partner_commissions (partner_id, status);

CREATE TABLE IF NOT EXISTS public.ambassador_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL CHECK (char_length(btrim(full_name)) BETWEEN 2 AND 80),
  phone TEXT NOT NULL CHECK (char_length(phone) BETWEEN 7 AND 20),
  email TEXT,
  city TEXT CHECK (city IS NULL OR char_length(city) <= 60),
  about TEXT CHECK (about IS NULL OR char_length(about) <= 500),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note TEXT,
  ambassador_id UUID REFERENCES public.ambassadors(id),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS ambassador_applications_open_idx ON public.ambassador_applications (user_id) WHERE status = 'pending';

-- Everything is read through the functions below; admins may also read directly.
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_choices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ambassador_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view partners" ON public.partners FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view partner members" ON public.partner_members FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view partner choices" ON public.partner_choices FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view partner payouts" ON public.partner_payouts FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view partner commissions" ON public.partner_commissions FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view ambassador applications" ON public.ambassador_applications FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

/** The partner the signed-in user works for, if any. */
CREATE OR REPLACE FUNCTION public.my_partner_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pm.partner_id FROM public.partner_members pm
  JOIN public.partners p ON p.id = pm.partner_id
  WHERE pm.user_id = auth.uid() AND p.is_active
  ORDER BY pm.created_at
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.require_admin()
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can do this.' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Commission on verification payments
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.record_partner_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.paid_at IS NULL OR COALESCE(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at THEN
    RETURN NEW;
  END IF;
  -- Sellers brought in by an ambassador don't count.
  IF EXISTS (SELECT 1 FROM public.seller_referrals r WHERE r.seller_id = NEW.vendor_id AND r.status <> 'rejected') THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.partner_commissions (
    partner_id, verification_request_id, vendor_id, tier, payment_amount, payment_paid_at, commission_percent, amount
  )
  SELECT p.id, NEW.id, NEW.vendor_id, COALESCE(NEW.tier, 'blue'), NEW.amount, NEW.paid_at, p.commission_percent,
         round(NEW.amount * p.commission_percent / 100, 2)
  FROM public.partners p
  WHERE p.is_active
    AND p.commission_percent > 0
    AND NEW.paid_at::DATE >= p.starts_on
    AND (p.ends_on IS NULL OR NEW.paid_at::DATE <= p.ends_on)
    AND p.vendor_id IS DISTINCT FROM NEW.vendor_id
  ON CONFLICT (partner_id, verification_request_id, payment_paid_at) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER verification_partner_commission
  AFTER INSERT OR UPDATE OF paid_at ON public.vendor_verification_requests
  FOR EACH ROW EXECUTE FUNCTION public.record_partner_commission();

-- ---------------------------------------------------------------------------
-- Admin: partners
-- ---------------------------------------------------------------------------

/** Create or update a partner. p_id NULL creates one. Returns the id. */
CREATE OR REPLACE FUNCTION public.admin_save_partner(p_id UUID, p_data JSONB)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_vendor UUID := NULLIF(p_data ->> 'vendor_id', '')::UUID;
BEGIN
  PERFORM public.require_admin();
  IF v_vendor IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_vendor AND store_name IS NOT NULL) THEN
    RAISE EXCEPTION 'That store was not found.';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO public.partners (
      name, vendor_id, badge_label, choice_label, commission_percent, starts_on, ends_on, is_active,
      show_on_homepage, homepage_title, homepage_tagline, bank_name, account_name, account_number, notes, created_by
    ) VALUES (
      btrim(p_data ->> 'name'), v_vendor,
      COALESCE(NULLIF(btrim(p_data ->> 'badge_label'), ''), 'Founding Partner'),
      NULLIF(btrim(p_data ->> 'choice_label'), ''),
      COALESCE((p_data ->> 'commission_percent')::NUMERIC, 0),
      COALESCE((p_data ->> 'starts_on')::DATE, CURRENT_DATE),
      NULLIF(p_data ->> 'ends_on', '')::DATE,
      COALESCE((p_data ->> 'is_active')::BOOLEAN, true),
      COALESCE((p_data ->> 'show_on_homepage')::BOOLEAN, true),
      NULLIF(btrim(p_data ->> 'homepage_title'), ''), NULLIF(btrim(p_data ->> 'homepage_tagline'), ''),
      NULLIF(btrim(p_data ->> 'bank_name'), ''), NULLIF(btrim(p_data ->> 'account_name'), ''),
      NULLIF(btrim(p_data ->> 'account_number'), ''), NULLIF(btrim(p_data ->> 'notes'), ''), auth.uid()
    ) RETURNING id INTO v_id;
  ELSE
    UPDATE public.partners SET
      name = btrim(p_data ->> 'name'),
      vendor_id = v_vendor,
      badge_label = COALESCE(NULLIF(btrim(p_data ->> 'badge_label'), ''), 'Founding Partner'),
      choice_label = NULLIF(btrim(p_data ->> 'choice_label'), ''),
      commission_percent = COALESCE((p_data ->> 'commission_percent')::NUMERIC, 0),
      starts_on = COALESCE((p_data ->> 'starts_on')::DATE, starts_on),
      ends_on = NULLIF(p_data ->> 'ends_on', '')::DATE,
      is_active = COALESCE((p_data ->> 'is_active')::BOOLEAN, is_active),
      show_on_homepage = COALESCE((p_data ->> 'show_on_homepage')::BOOLEAN, show_on_homepage),
      homepage_title = NULLIF(btrim(p_data ->> 'homepage_title'), ''),
      homepage_tagline = NULLIF(btrim(p_data ->> 'homepage_tagline'), ''),
      bank_name = NULLIF(btrim(p_data ->> 'bank_name'), ''),
      account_name = NULLIF(btrim(p_data ->> 'account_name'), ''),
      account_number = NULLIF(btrim(p_data ->> 'account_number'), ''),
      notes = NULLIF(btrim(p_data ->> 'notes'), ''),
      updated_at = now()
    WHERE id = p_id
    RETURNING id INTO v_id;
    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Partner not found.';
    END IF;
  END IF;
  RETURN v_id;
END;
$$;

/** Every partner with its store, people and money totals. */
CREATE OR REPLACE FUNCTION public.admin_partner_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(p) || jsonb_build_object(
      'store_name', s.store_name,
      'store_slug', s.store_slug,
      'members', COALESCE((
        SELECT jsonb_agg(jsonb_build_object('user_id', m.user_id, 'email', u.email, 'name', pr.full_name) ORDER BY m.created_at)
        FROM public.partner_members m
        LEFT JOIN auth.users u ON u.id = m.user_id
        LEFT JOIN public.profiles pr ON pr.id = m.user_id
        WHERE m.partner_id = p.id), '[]'::JSONB),
      'choices', (SELECT count(*) FROM public.partner_choices c WHERE c.partner_id = p.id AND c.withdrawn_at IS NULL),
      'unpaid', COALESCE((SELECT sum(amount) FROM public.partner_commissions c WHERE c.partner_id = p.id AND c.status = 'unpaid'), 0),
      'paid', COALESCE((SELECT sum(amount) FROM public.partner_commissions c WHERE c.partner_id = p.id AND c.status = 'paid'), 0)
    ) ORDER BY p.created_at)
    FROM public.partners p
    LEFT JOIN public.profiles s ON s.id = p.vendor_id
  ), '[]'::JSONB);
END;
$$;

/** Give someone with a Kano Kaftan account access to a partner's dashboard. */
CREATE OR REPLACE FUNCTION public.admin_add_partner_member(p_partner_id UUID, p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user UUID;
  v_partner TEXT;
BEGIN
  PERFORM public.require_admin();
  SELECT name INTO v_partner FROM public.partners WHERE id = p_partner_id;
  IF v_partner IS NULL THEN
    RAISE EXCEPTION 'Partner not found.';
  END IF;
  SELECT id INTO v_user FROM auth.users WHERE lower(email) = lower(btrim(p_email)) LIMIT 1;
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'No account uses %. Ask them to sign up on Kano Kaftan first, then try again.', btrim(p_email);
  END IF;

  INSERT INTO public.partner_members (partner_id, user_id, added_by)
  VALUES (p_partner_id, v_user, auth.uid())
  ON CONFLICT DO NOTHING;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
  VALUES (v_user, 'Partner dashboard ready',
          format('You can now manage %s on Kano Kaftan: give your label to tailors and sellers and see your earnings.', v_partner),
          'success', 'system', '/partner');
  RETURN v_user;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_partner_member(p_partner_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  DELETE FROM public.partner_members WHERE partner_id = p_partner_id AND user_id = p_user_id;
END;
$$;

/** One partner's commission lines and payouts (admin). */
CREATE OR REPLACE FUNCTION public.partner_statement(p_partner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR p_partner_id = public.my_partner_id()) THEN
    RAISE EXCEPTION 'You can''t see this statement.' USING ERRCODE = '42501';
  END IF;
  RETURN jsonb_build_object(
    'lines', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', c.id, 'store_name', COALESCE(s.store_name, 'Seller'), 'tier', c.tier,
        'payment_amount', c.payment_amount, 'payment_paid_at', c.payment_paid_at,
        'commission_percent', c.commission_percent, 'amount', c.amount, 'status', c.status,
        'reversed_reason', c.reversed_reason, 'payout_id', c.payout_id
      ) ORDER BY c.payment_paid_at DESC)
      FROM public.partner_commissions c
      LEFT JOIN public.profiles s ON s.id = c.vendor_id
      WHERE c.partner_id = p_partner_id), '[]'::JSONB),
    'payouts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('id', id, 'amount', amount, 'items', items, 'reference', reference, 'note', note, 'paid_at', paid_at) ORDER BY paid_at DESC)
      FROM public.partner_payouts WHERE partner_id = p_partner_id), '[]'::JSONB),
    'unpaid', COALESCE((SELECT sum(amount) FROM public.partner_commissions WHERE partner_id = p_partner_id AND status = 'unpaid'), 0),
    'paid', COALESCE((SELECT sum(amount) FROM public.partner_commissions WHERE partner_id = p_partner_id AND status = 'paid'), 0)
  );
END;
$$;

/** Record that the unpaid balance was transferred. Returns the payout id. */
CREATE OR REPLACE FUNCTION public.admin_pay_partner(p_partner_id UUID, p_reference TEXT DEFAULT NULL, p_note TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_items INTEGER;
  v_payout UUID;
BEGIN
  PERFORM public.require_admin();
  SELECT COALESCE(sum(amount), 0), count(*) INTO v_total, v_items
  FROM public.partner_commissions WHERE partner_id = p_partner_id AND status = 'unpaid';
  IF v_items = 0 THEN
    RAISE EXCEPTION 'Nothing to pay: there is no unpaid commission.';
  END IF;

  INSERT INTO public.partner_payouts (partner_id, amount, items, reference, note, paid_by)
  VALUES (p_partner_id, v_total, v_items, NULLIF(btrim(p_reference), ''), NULLIF(btrim(p_note), ''), auth.uid())
  RETURNING id INTO v_payout;

  UPDATE public.partner_commissions SET status = 'paid', payout_id = v_payout
  WHERE partner_id = p_partner_id AND status = 'unpaid';

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
  SELECT m.user_id, 'Partner commission paid',
         format('₦%s for %s badge payment(s) was sent to your bank account.', to_char(v_total, 'FM999,999,990.00'), v_items),
         'payment', 'payment', '/partner'
  FROM public.partner_members m WHERE m.partner_id = p_partner_id;
  RETURN v_payout;
END;
$$;

/** Refunded badge payment: cancel its commission (deducted from the next payout if already paid). */
CREATE OR REPLACE FUNCTION public.admin_reverse_partner_commission(p_commission_id UUID, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row public.partner_commissions;
BEGIN
  PERFORM public.require_admin();
  SELECT * INTO v_row FROM public.partner_commissions WHERE id = p_commission_id FOR UPDATE;
  IF NOT FOUND OR v_row.status = 'reversed' THEN
    RAISE EXCEPTION 'This commission was not found or is already reversed.';
  END IF;

  IF v_row.status = 'paid' THEN
    -- Already paid out: a negative line takes it off the next payout.
    INSERT INTO public.partner_commissions (
      partner_id, verification_request_id, vendor_id, tier, payment_amount, payment_paid_at,
      commission_percent, amount, status, reversed_reason, reversed_at
    ) VALUES (
      v_row.partner_id, v_row.verification_request_id, v_row.vendor_id, v_row.tier, -v_row.payment_amount, clock_timestamp(),
      v_row.commission_percent, -v_row.amount, 'unpaid', NULLIF(btrim(p_reason), ''), now()
    );
  ELSE
    UPDATE public.partner_commissions
    SET status = 'reversed', reversed_reason = NULLIF(btrim(p_reason), ''), reversed_at = now()
    WHERE id = p_commission_id;
  END IF;
END;
$$;

-- ---------------------------------------------------------------------------
-- Partner dashboard
-- ---------------------------------------------------------------------------

/** The signed-in user's partner, or NULL. */
CREATE OR REPLACE FUNCTION public.my_partner()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := public.my_partner_id();
BEGIN
  IF v_id IS NULL THEN
    RETURN NULL;
  END IF;
  RETURN (
    SELECT jsonb_build_object(
      'id', p.id, 'name', p.name, 'badge_label', p.badge_label,
      'choice_label', COALESCE(p.choice_label, p.name || '''s Choice'),
      'commission_percent', p.commission_percent, 'starts_on', p.starts_on, 'ends_on', p.ends_on,
      'store_name', s.store_name, 'store_slug', s.store_slug
    )
    FROM public.partners p LEFT JOIN public.profiles s ON s.id = p.vendor_id
    WHERE p.id = v_id
  );
END;
$$;

/** Shops currently carrying this partner's label. */
CREATE OR REPLACE FUNCTION public.partner_choice_list(p_partner_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := COALESCE(p_partner_id, public.my_partner_id());
BEGIN
  IF v_id IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR v_id = public.my_partner_id()) THEN
    RAISE EXCEPTION 'You can''t manage this label.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'vendor_id', c.vendor_id, 'store_name', s.store_name, 'store_slug', s.store_slug,
      'avatar_url', s.avatar_url, 'city', s.store_address ->> 'city', 'note', c.note, 'awarded_at', c.awarded_at
    ) ORDER BY c.awarded_at DESC)
    FROM public.partner_choices c JOIN public.profiles s ON s.id = c.vendor_id
    WHERE c.partner_id = v_id AND c.withdrawn_at IS NULL
  ), '[]'::JSONB);
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_award_choice(p_vendor_id UUID, p_note TEXT DEFAULT NULL, p_partner_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := COALESCE(p_partner_id, public.my_partner_id());
  v_partner public.partners;
BEGIN
  IF v_id IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR v_id = public.my_partner_id()) THEN
    RAISE EXCEPTION 'You can''t manage this label.' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO v_partner FROM public.partners WHERE id = v_id;
  IF v_partner.vendor_id = p_vendor_id THEN
    RAISE EXCEPTION 'You can''t give your label to your own store.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_vendor_id AND store_name IS NOT NULL) THEN
    RAISE EXCEPTION 'That shop was not found.';
  END IF;

  INSERT INTO public.partner_choices (partner_id, vendor_id, note, awarded_by)
  VALUES (v_id, p_vendor_id, NULLIF(btrim(p_note), ''), auth.uid())
  ON CONFLICT (partner_id, vendor_id) WHERE withdrawn_at IS NULL DO UPDATE SET note = EXCLUDED.note;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
  VALUES (p_vendor_id, format('You''re %s', COALESCE(v_partner.choice_label, v_partner.name || '''s Choice')),
          format('%s picked your shop. The label now shows on your shop for buyers.', v_partner.name),
          'success', 'review', '/vendor');
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_withdraw_choice(p_vendor_id UUID, p_partner_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID := COALESCE(p_partner_id, public.my_partner_id());
BEGIN
  IF v_id IS NULL OR NOT (public.has_role(auth.uid(), 'admin') OR v_id = public.my_partner_id()) THEN
    RAISE EXCEPTION 'You can''t manage this label.' USING ERRCODE = '42501';
  END IF;
  UPDATE public.partner_choices SET withdrawn_at = now(), withdrawn_by = auth.uid()
  WHERE partner_id = v_id AND vendor_id = p_vendor_id AND withdrawn_at IS NULL;
END;
$$;

/** Shops a partner can pick from (search by name or town). */
CREATE OR REPLACE FUNCTION public.partner_find_shops(p_search TEXT)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF public.my_partner_id() IS NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Partners only.' USING ERRCODE = '42501';
  END IF;
  RETURN COALESCE((
    SELECT jsonb_agg(row_to_json(x)) FROM (
      SELECT s.id AS vendor_id, s.store_name, s.store_slug, s.avatar_url, s.store_address ->> 'city' AS city
      FROM public.profiles s
      WHERE s.store_name IS NOT NULL AND s.store_slug IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = s.id AND r.role = 'vendor')
        AND (COALESCE(btrim(p_search), '') = ''
             OR s.store_name ILIKE '%' || btrim(p_search) || '%'
             OR (s.store_address ->> 'city') ILIKE '%' || btrim(p_search) || '%')
      ORDER BY s.store_name
      LIMIT 20
    ) x
  ), '[]'::JSONB);
END;
$$;

-- ---------------------------------------------------------------------------
-- Public: badges and the homepage spot
-- ---------------------------------------------------------------------------

/** { "<vendor id>": { "partner": "Founding Partner", "choices": ["Marmara's Choice"] } } */
CREATE OR REPLACE FUNCTION public.shop_marks()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH live AS (
    SELECT * FROM public.partners
    WHERE is_active AND starts_on <= CURRENT_DATE AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
  ),
  marks AS (
    SELECT vendor_id, badge_label AS partner, NULL::TEXT AS choice FROM live WHERE vendor_id IS NOT NULL
    UNION ALL
    SELECT c.vendor_id, NULL, COALESCE(l.choice_label, l.name || '''s Choice')
    FROM public.partner_choices c JOIN live l ON l.id = c.partner_id
    WHERE c.withdrawn_at IS NULL
  )
  SELECT COALESCE(jsonb_object_agg(vendor_id, jsonb_build_object(
    'partner', partner_label,
    'choices', choices
  )), '{}'::JSONB)
  FROM (
    SELECT vendor_id,
           max(partner) AS partner_label,
           COALESCE(jsonb_agg(choice) FILTER (WHERE choice IS NOT NULL), '[]'::JSONB) AS choices
    FROM marks GROUP BY vendor_id
  ) m;
$$;

/** Partners shown on the homepage, each with a few of the shops it picked. */
CREATE OR REPLACE FUNCTION public.homepage_partners()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'badge_label', p.badge_label,
    'choice_label', COALESCE(p.choice_label, p.name || '''s Choice'),
    'title', COALESCE(p.homepage_title, p.name),
    'tagline', p.homepage_tagline,
    'store_name', s.store_name,
    'store_slug', s.store_slug,
    'avatar_url', s.avatar_url,
    'banner_url', s.store_banner_url,
    'picks', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('store_name', v.store_name, 'store_slug', v.store_slug, 'avatar_url', v.avatar_url) ORDER BY c.awarded_at DESC)
      FROM (SELECT * FROM public.partner_choices WHERE partner_id = p.id AND withdrawn_at IS NULL ORDER BY awarded_at DESC LIMIT 8) c
      JOIN public.profiles v ON v.id = c.vendor_id AND v.store_slug IS NOT NULL
    ), '[]'::JSONB)
  ) ORDER BY p.created_at), '[]'::JSONB)
  FROM public.partners p
  LEFT JOIN public.profiles s ON s.id = p.vendor_id
  WHERE p.is_active AND p.show_on_homepage
    AND p.starts_on <= CURRENT_DATE AND (p.ends_on IS NULL OR p.ends_on >= CURRENT_DATE);
$$;

-- ---------------------------------------------------------------------------
-- Ambassador sign-up
-- ---------------------------------------------------------------------------

/** Where the signed-in user stands: already an ambassador, application waiting, or nothing yet. */
CREATE OR REPLACE FUNCTION public.my_ambassador_application()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM public.ambassadors WHERE user_id = auth.uid()) THEN
    RETURN jsonb_build_object('status', 'ambassador');
  END IF;
  RETURN (
    SELECT jsonb_build_object('status', status, 'created_at', created_at, 'admin_note', admin_note)
    FROM public.ambassador_applications WHERE user_id = auth.uid()
    ORDER BY created_at DESC LIMIT 1
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.submit_ambassador_application(p_full_name TEXT, p_phone TEXT, p_city TEXT DEFAULT NULL, p_about TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_phone TEXT := regexp_replace(COALESCE(p_phone, ''), '[^0-9+]', '', 'g');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in first.' USING ERRCODE = '42501';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ambassadors WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'You are already an ambassador. Open your dashboard to get your link.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ambassador_applications WHERE user_id = auth.uid() AND status = 'pending') THEN
    RAISE EXCEPTION 'Your application is already with our team. We''ll let you know soon.';
  END IF;
  IF char_length(btrim(COALESCE(p_full_name, ''))) < 2 THEN
    RAISE EXCEPTION 'Please enter your full name.';
  END IF;
  IF v_phone !~ '^(\+?234|0)[789][01][0-9]{8}$' THEN
    RAISE EXCEPTION 'Please enter a valid Nigerian phone number.';
  END IF;

  INSERT INTO public.ambassador_applications (user_id, full_name, phone, email, city, about)
  VALUES (auth.uid(), btrim(p_full_name), v_phone, (SELECT email FROM auth.users WHERE id = auth.uid()),
          NULLIF(btrim(p_city), ''), NULLIF(btrim(p_about), ''));

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
  SELECT ur.user_id, 'New ambassador application',
         format('%s (%s) wants to become an ambassador.', btrim(p_full_name), COALESCE(NULLIF(btrim(p_city), ''), 'no town given')),
         'info', 'system', '/admin/ambassadors'
  FROM public.user_roles ur WHERE ur.role = 'admin';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_ambassador_applications()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(to_jsonb(a) ORDER BY a.created_at DESC)
    FROM public.ambassador_applications a
    WHERE a.status = 'pending' OR a.reviewed_at > now() - interval '30 days'
  ), '[]'::JSONB);
END;
$$;

/** Approve (creates the ambassador, linked to their account) or decline. Returns the ambassador id on approval. */
CREATE OR REPLACE FUNCTION public.admin_review_ambassador_application(p_id UUID, p_approve BOOLEAN, p_note TEXT DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_app public.ambassador_applications;
  v_amb UUID;
BEGIN
  PERFORM public.require_admin();
  SELECT * INTO v_app FROM public.ambassador_applications WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR v_app.status <> 'pending' THEN
    RAISE EXCEPTION 'This application was already handled.';
  END IF;

  IF p_approve THEN
    SELECT id INTO v_amb FROM public.ambassadors WHERE user_id = v_app.user_id;
    IF v_amb IS NULL THEN
      INSERT INTO public.ambassadors (code, full_name, phone, email, notes, user_id, created_by)
      VALUES (public.new_ambassador_code(v_app.full_name), v_app.full_name, v_app.phone, v_app.email,
              NULLIF(concat_ws(' · ', v_app.city, v_app.about), ''), v_app.user_id, auth.uid())
      RETURNING id INTO v_amb;
    END IF;
  END IF;

  UPDATE public.ambassador_applications
  SET status = CASE WHEN p_approve THEN 'approved' ELSE 'rejected' END,
      admin_note = NULLIF(btrim(p_note), ''), ambassador_id = v_amb,
      reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_id;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
  VALUES (
    v_app.user_id,
    CASE WHEN p_approve THEN 'You''re a Kano Kaftan ambassador' ELSE 'About your ambassador application' END,
    CASE WHEN p_approve
      THEN 'Welcome! Open your ambassador dashboard to copy your link and see the sellers you invite.'
      ELSE COALESCE(NULLIF(btrim(p_note), ''), 'We can''t take you on as an ambassador right now. Thank you for applying.') END,
    CASE WHEN p_approve THEN 'success' ELSE 'info' END,
    'system',
    CASE WHEN p_approve THEN '/ambassador' ELSE '/ambassadors/join' END
  );
  RETURN v_amb;
END;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.my_partner_id() FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.require_admin() FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.record_partner_commission() FROM PUBLIC, anon, authenticated;
  REVOKE ALL ON FUNCTION public.admin_save_partner(UUID, JSONB) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_partner_overview() FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_add_partner_member(UUID, TEXT) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_remove_partner_member(UUID, UUID) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.partner_statement(UUID) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_pay_partner(UUID, TEXT, TEXT) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_reverse_partner_commission(UUID, TEXT) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.my_partner() FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.partner_choice_list(UUID) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.partner_award_choice(UUID, TEXT, UUID) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.partner_withdraw_choice(UUID, UUID) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.partner_find_shops(TEXT) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.my_ambassador_application() FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.submit_ambassador_application(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_ambassador_applications() FROM PUBLIC, anon;
  REVOKE ALL ON FUNCTION public.admin_review_ambassador_application(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;

  GRANT EXECUTE ON FUNCTION public.my_partner_id() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.require_admin() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_save_partner(UUID, JSONB) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_partner_overview() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_add_partner_member(UUID, TEXT) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_remove_partner_member(UUID, UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.partner_statement(UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_pay_partner(UUID, TEXT, TEXT) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_reverse_partner_commission(UUID, TEXT) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.my_partner() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.partner_choice_list(UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.partner_award_choice(UUID, TEXT, UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.partner_withdraw_choice(UUID, UUID) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.partner_find_shops(TEXT) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.my_ambassador_application() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.submit_ambassador_application(TEXT, TEXT, TEXT, TEXT) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_ambassador_applications() TO authenticated;
  GRANT EXECUTE ON FUNCTION public.admin_review_ambassador_application(UUID, BOOLEAN, TEXT) TO authenticated;
  GRANT EXECUTE ON FUNCTION public.shop_marks() TO anon, authenticated;
  GRANT EXECUTE ON FUNCTION public.homepage_partners() TO anon, authenticated;
END $$;
