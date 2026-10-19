-- Admin "Users": buyers only (no sellers, no admins), with their linked bank
-- account. Filters: customer (all users), bank_linked, bank_missing. Search also
-- matches the bank account name. Only the bank, account name and last 4 digits
-- are stored, so that's what admins see; the full number is never kept.

CREATE OR REPLACE FUNCTION public.admin_list_users(p_search TEXT DEFAULT NULL, p_role TEXT DEFAULT 'customer', p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_search TEXT := NULLIF(btrim(COALESCE(p_search, '')), '');
BEGIN
  PERFORM public.require_admin();
  RETURN (
    WITH base AS (
      SELECT p.id, p.email, p.full_name, p.phone, p.avatar_url, p.is_verified, p.created_at, p.last_seen_at,
             b.bank_name AS linked_bank_name, b.account_name AS bank_account_name, b.account_last4, b.verified_at AS bank_verified_at
      FROM public.profiles p
      LEFT JOIN public.customer_bank_accounts b ON b.user_id = p.id
      WHERE NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = p.id AND r.role::TEXT IN ('vendor', 'admin'))
        AND (v_search IS NULL OR p.full_name ILIKE '%' || v_search || '%' OR p.email ILIKE '%' || v_search || '%'
             OR p.phone ILIKE '%' || v_search || '%' OR b.account_name ILIKE '%' || v_search || '%')
    ), filtered AS (
      SELECT * FROM base
      WHERE p_role IN ('customer', 'all')
         OR (p_role = 'bank_linked' AND bank_verified_at IS NOT NULL)
         OR (p_role = 'bank_missing' AND bank_verified_at IS NULL)
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM filtered),
      'rows', COALESCE((SELECT jsonb_agg(jsonb_build_object(
        'id', id, 'email', email, 'full_name', full_name, 'phone', phone, 'avatar_url', avatar_url,
        'is_verified', is_verified, 'created_at', created_at, 'last_seen_at', last_seen_at,
        'roles', '["customer"]'::JSONB,
        'bank_name', linked_bank_name, 'bank_account_name', bank_account_name,
        'account_last4', account_last4, 'bank_verified_at', bank_verified_at
      ) ORDER BY sort_at DESC) FROM (
        SELECT *, CASE WHEN p_role = 'bank_linked' THEN bank_verified_at ELSE created_at END AS sort_at
        FROM filtered
        ORDER BY CASE WHEN p_role = 'bank_linked' THEN bank_verified_at ELSE created_at END DESC
        LIMIT LEAST(p_limit, 200) OFFSET GREATEST(p_offset, 0)
      ) x), '[]'::JSONB)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
