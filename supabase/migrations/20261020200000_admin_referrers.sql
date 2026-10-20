-- Admin "Referrals": everyone who invited people, how many joined, how many
-- verified, rewards on hold, and what they earned (200 K² per verified friend
-- plus the share of friends' orders), with totals for the whole programme.

CREATE OR REPLACE FUNCTION public.admin_referrers(p_search TEXT DEFAULT NULL, p_sort TEXT DEFAULT 'earned', p_limit INTEGER DEFAULT 50, p_offset INTEGER DEFAULT 0)
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
    WITH per AS (
      SELECT r.referrer_id AS id,
             count(*) FILTER (WHERE r.status <> 'cancelled') AS invited,
             count(*) FILTER (WHERE r.status = 'rewarded') AS verified,
             count(*) FILTER (WHERE r.status = 'held') AS held,
             count(*) FILTER (WHERE r.status = 'joined') AS waiting,
             count(*) FILTER (WHERE r.status = 'cancelled') AS blocked,
             max(r.created_at) AS last_invite_at
      FROM public.customer_referrals r
      GROUP BY r.referrer_id
    ), money AS (
      SELECT c.user_id AS id,
             COALESCE(sum(c.amount) FILTER (WHERE c.kind = 'referral_reward'), 0) AS reward_k2,
             COALESCE(sum(c.amount) FILTER (WHERE c.kind = 'referral_commission'), 0) AS commission_k2
      FROM public.customer_credits c
      WHERE c.kind IN ('referral_reward', 'referral_commission')
      GROUP BY c.user_id
    ), rows AS (
      SELECT per.*, p.full_name, p.email, p.avatar_url,
             EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = per.id AND ur.role::TEXT = 'vendor') AS is_seller,
             COALESCE(m.reward_k2, 0) AS reward_k2, COALESCE(m.commission_k2, 0) AS commission_k2,
             COALESCE(m.reward_k2, 0) + COALESCE(m.commission_k2, 0) AS earned_k2,
             public.customer_credit_balance(per.id) AS balance_k2
      FROM per
      JOIN public.profiles p ON p.id = per.id
      LEFT JOIN money m ON m.id = per.id
      WHERE v_search IS NULL OR p.full_name ILIKE '%' || v_search || '%' OR p.email ILIKE '%' || v_search || '%'
    )
    SELECT jsonb_build_object(
      'total', (SELECT count(*) FROM rows),
      'totals', (SELECT jsonb_build_object(
          'referrers', count(*), 'invited', COALESCE(sum(invited), 0), 'verified', COALESCE(sum(verified), 0),
          'held', COALESCE(sum(held), 0), 'waiting', COALESCE(sum(waiting), 0),
          'reward_k2', COALESCE(sum(reward_k2), 0), 'commission_k2', COALESCE(sum(commission_k2), 0))
        FROM rows),
      'rows', COALESCE((SELECT jsonb_agg(to_jsonb(x) - 'sort_key' ORDER BY x.sort_key DESC NULLS LAST, x.invited DESC, x.full_name) FROM (
        SELECT rows.*,
               CASE p_sort WHEN 'invited' THEN invited::NUMERIC WHEN 'verified' THEN verified::NUMERIC
                           WHEN 'recent' THEN extract(epoch FROM last_invite_at) ELSE earned_k2 END AS sort_key
        FROM rows
        ORDER BY sort_key DESC NULLS LAST, invited DESC, full_name
        LIMIT LEAST(GREATEST(p_limit, 1), 200) OFFSET GREATEST(p_offset, 0)
      ) x), '[]'::JSONB)
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_referrers(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_referrers(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
