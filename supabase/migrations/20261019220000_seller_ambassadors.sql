-- Sellers can be ambassadors too. They earn the badge bonus for shops they
-- bring in, never for their own shop.

CREATE OR REPLACE FUNCTION public.record_ambassador_badge_reward()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ref public.seller_referrals%ROWTYPE;
  v_amount NUMERIC;
  v_amb public.ambassadors%ROWTYPE;
BEGIN
  IF NEW.paid_at IS NULL OR COALESCE(NEW.amount, 0) <= 0 THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.paid_at IS NOT DISTINCT FROM NEW.paid_at THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_ref FROM public.seller_referrals WHERE seller_id = NEW.vendor_id AND status <> 'rejected';
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_amb FROM public.ambassadors WHERE id = v_ref.ambassador_id;
  -- A seller who is also an ambassador earns nothing from their own shop.
  IF NOT FOUND OR NOT v_amb.is_active OR v_amb.user_id = NEW.vendor_id THEN
    RETURN NEW;
  END IF;
  SELECT COALESCE(ambassador_badge_reward, 0) INTO v_amount FROM public.platform_settings WHERE id = 1;
  IF v_amount <= 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.ambassador_earnings (ambassador_id, seller_id, verification_request_id, payment_paid_at, tier, amount)
  VALUES (v_ref.ambassador_id, NEW.vendor_id, NEW.id, NEW.paid_at, NEW.tier, v_amount)
  ON CONFLICT (verification_request_id, payment_paid_at) DO NOTHING;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  UPDATE public.seller_referrals
  SET status = 'earned', earned_at = now(),
      reward_amount = (SELECT sum(amount) FROM public.ambassador_earnings WHERE seller_id = NEW.vendor_id)
  WHERE seller_id = NEW.vendor_id;

  INSERT INTO public.notifications (user_id, title, message, type, category, action_url)
  SELECT ur.user_id, 'Ambassador reward earned',
         format('%s earned ₦%s: %s paid for a verification badge.', v_amb.full_name, to_char(v_amount, 'FM999,999,990'),
                COALESCE((SELECT store_name FROM public.profiles WHERE id = NEW.vendor_id), 'A referred shop')),
         'success', 'system', '/admin/ambassadors'
  FROM public.user_roles ur WHERE ur.role = 'admin';
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.record_ambassador_badge_reward() FROM PUBLIC, anon, authenticated;
