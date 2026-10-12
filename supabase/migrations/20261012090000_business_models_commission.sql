-- Three ways sellers earn:
--   1. App checkout (customer pays in the app): seller gets the full item price
--      (checkout_commission_percent, 0% by default); Kano Kaftan keeps the delivery fee.
--   2. Arranged through Kano Kaftan chat (admin-made "concierge" order):
--      commission_percent (10%) + Kano Kaftan keeps the delivery fee.
--   3. Private deals between seller and customer: nothing to do with us.
SET lock_timeout = '10s';
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS checkout_commission_percent NUMERIC(5, 2) NOT NULL DEFAULT 0
  CHECK (checkout_commission_percent >= 0 AND checkout_commission_percent <= 100);

COMMENT ON COLUMN public.platform_settings.commission_percent IS 'Commission on orders Kano Kaftan arranges through chat (concierge orders).';
COMMENT ON COLUMN public.platform_settings.checkout_commission_percent IS 'Commission on orders customers pay for themselves in the app.';

/** The commission rate for an order, by how it was made. */
CREATE OR REPLACE FUNCTION public.order_commission_percent(p_order_id UUID)
RETURNS NUMERIC
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE WHEN o.delivery_type = 'concierge' THEN s.commission_percent ELSE s.checkout_commission_percent END
  FROM public.orders o CROSS JOIN public.platform_settings s
  WHERE o.id = p_order_id AND s.id = 1
$$;

/**
 * mark_order_paid() splits each seller's share into two payouts using one
 * rate; this re-does the maths with the right rate for the order type.
 * Payouts only ever cover item prices, so the delivery fee stays with Kano Kaftan.
 */
CREATE OR REPLACE FUNCTION public.apply_order_commission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rate NUMERIC := COALESCE(public.order_commission_percent(NEW.order_id), NEW.commission_percent);
  v_commission NUMERIC;
  v_net NUMERIC;
  v_first_half NUMERIC;
BEGIN
  v_commission := round(NEW.gross_amount * v_rate / 100, 2);
  v_net := NEW.gross_amount - v_commission;
  v_first_half := floor(v_net * 100 / 2) / 100;
  NEW.commission_percent := v_rate;
  NEW.commission_amount := v_commission;
  NEW.amount := CASE WHEN NEW.tranche = 1 THEN v_first_half ELSE v_net - v_first_half END;
  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.apply_order_commission() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.order_commission_percent(UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE TRIGGER payouts_apply_order_commission
  BEFORE INSERT ON public.payouts
  FOR EACH ROW EXECUTE FUNCTION public.apply_order_commission();
