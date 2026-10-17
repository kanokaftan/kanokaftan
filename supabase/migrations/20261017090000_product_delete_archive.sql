-- Deleting products.
-- Products that appear in past orders can't be removed outright (order_items
-- keeps a reference to them for order history, refunds and payouts), so the
-- direct DELETE failed with a foreign key error for sellers and admins alike.
-- delete_product() now removes a product that was never ordered, and archives
-- one that was: hidden from the shop, the seller's list and the admin list,
-- taken out of carts and wishlists, while past orders keep working.

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS products_not_deleted_idx ON public.products (vendor_id) WHERE deleted_at IS NULL;

-- An archived product can't be switched back on or edited back to life.
CREATE OR REPLACE FUNCTION public.guard_deleted_product()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.deleted_at IS NOT NULL AND public.is_client_request() THEN
    RAISE EXCEPTION 'This product was deleted and can''t be changed.' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER products_guard_deleted
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.guard_deleted_product();

CREATE OR REPLACE FUNCTION public.delete_product(p_product_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_vendor UUID;
  v_deleted TIMESTAMPTZ;
  v_is_admin BOOLEAN := public.has_role(auth.uid(), 'admin');
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Please sign in again.' USING ERRCODE = '42501';
  END IF;

  SELECT vendor_id, deleted_at INTO v_vendor, v_deleted FROM public.products WHERE id = p_product_id FOR UPDATE;
  IF NOT FOUND OR v_deleted IS NOT NULL THEN
    RETURN 'gone';
  END IF;
  IF NOT v_is_admin AND NOT (v_vendor = auth.uid() AND public.has_role(auth.uid(), 'vendor')) THEN
    RAISE EXCEPTION 'You can only remove your own products.' USING ERRCODE = '42501';
  END IF;

  IF EXISTS (SELECT 1 FROM public.order_items WHERE product_id = p_product_id) THEN
    -- Ordered before: archive so order history, refunds and payouts stay intact.
    DELETE FROM public.cart_items WHERE product_id = p_product_id;
    DELETE FROM public.wishlists WHERE product_id = p_product_id;
    DELETE FROM public.flash_sales WHERE product_id = p_product_id;
    UPDATE public.products SET is_active = false, deleted_at = now() WHERE id = p_product_id;
    RETURN 'archived';
  END IF;

  DELETE FROM public.products WHERE id = p_product_id;
  RETURN 'deleted';
END;
$$;

DO $$
BEGIN
  REVOKE ALL ON FUNCTION public.delete_product(UUID) FROM PUBLIC, anon;
  GRANT EXECUTE ON FUNCTION public.delete_product(UUID) TO authenticated;
END $$;
