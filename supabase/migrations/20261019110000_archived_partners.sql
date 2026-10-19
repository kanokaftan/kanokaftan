-- Removed (archived) partners, for looking up their statements later.
CREATE OR REPLACE FUNCTION public.admin_archived_partners()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.require_admin();
  RETURN COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
      'id', p.id,
      'name', p.name,
      'badge_label', p.badge_label,
      'commission_percent', p.commission_percent,
      'starts_on', p.starts_on,
      'ends_on', p.ends_on,
      'archived_at', p.archived_at,
      'store_name', s.store_name,
      'bank_name', p.bank_name,
      'account_name', p.account_name,
      'account_number', p.account_number,
      'unpaid', COALESCE((SELECT sum(amount) FROM public.partner_commissions c WHERE c.partner_id = p.id AND c.status = 'unpaid'), 0),
      'paid', COALESCE((SELECT sum(amount) FROM public.partner_commissions c WHERE c.partner_id = p.id AND c.status = 'paid'), 0)
    ) ORDER BY p.archived_at DESC)
    FROM public.partners p
    LEFT JOIN public.profiles s ON s.id = p.vendor_id
    WHERE p.archived_at IS NOT NULL
  ), '[]'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_archived_partners() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_archived_partners() TO authenticated;
