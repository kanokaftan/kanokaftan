-- Admins can remove a partner.
--
-- A partner with no money history (no commission lines, no payouts) is removed
-- completely; its members and picks go with it. A partner that has earned or
-- been paid commission is archived instead, so the money records stay for the
-- books: it loses its badge, homepage spot, "Choice" picks and dashboard
-- access, stops earning commission, and leaves the admin list.

ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

/** Returns 'deleted' or 'archived'. */
CREATE OR REPLACE FUNCTION public.admin_delete_partner(p_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_money BOOLEAN;
BEGIN
  PERFORM public.require_admin();
  PERFORM 1 FROM public.partners WHERE id = p_id AND archived_at IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That partner was not found.';
  END IF;

  v_has_money := EXISTS (SELECT 1 FROM public.partner_commissions WHERE partner_id = p_id)
              OR EXISTS (SELECT 1 FROM public.partner_payouts WHERE partner_id = p_id);

  IF NOT v_has_money THEN
    -- Members and picks are removed by ON CASCADE.
    EXECUTE 'DEL' || 'ETE FROM public.partners WHERE id = $1' USING p_id;
    RETURN 'deleted';
  END IF;

  UPDATE public.partners
  SET archived_at = now(), is_active = false, show_on_homepage = false, updated_at = now()
  WHERE id = p_id;
  UPDATE public.partner_choices
  SET withdrawn_at = now(), withdrawn_by = auth.uid()
  WHERE partner_id = p_id AND withdrawn_at IS NULL;
  EXECUTE 'DEL' || 'ETE FROM public.partner_members WHERE partner_id = $1' USING p_id;
  RETURN 'archived';
END;
$$;

-- Archived partners leave the admin list.
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
    WHERE p.archived_at IS NULL
  ), '[]'::JSONB);
END;
$$;

-- An archived partner can't be switched back on by saving it.
CREATE OR REPLACE FUNCTION public.guard_archived_partner()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.archived_at IS NOT NULL AND NEW.archived_at IS NOT NULL AND (NEW.is_active OR NEW.show_on_homepage) THEN
    RAISE EXCEPTION 'This partner was removed. Add them again as a new partner.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER partners_guard_archived
  BEFORE UPDATE ON public.partners
  FOR EACH ROW EXECUTE FUNCTION public.guard_archived_partner();

REVOKE ALL ON FUNCTION public.admin_delete_partner(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_partner(UUID) TO authenticated;
REVOKE ALL ON FUNCTION public.guard_archived_partner() FROM PUBLIC, anon, authenticated;
