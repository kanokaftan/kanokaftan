-- Fix infinite recursion between orders <-> order_items RLS policies by using SECURITY DEFINER helper functions

-- 1) Helper functions (bypass RLS safely)
CREATE OR REPLACE FUNCTION public.is_order_customer(_order_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.orders o
    WHERE o.id = _order_id
      AND o.user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_order_vendor(_order_id uuid, _vendor_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = _order_id
      AND oi.vendor_id = _vendor_id
  );
$$;

-- 2) Replace policies that mutually reference each other
DO $$
BEGIN
  -- Orders policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='Vendors can view orders with their products') THEN
    EXECUTE 'DROP POLICY "Vendors can view orders with their products" ON public.orders';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='orders' AND policyname='Vendors can update orders with their products') THEN
    EXECUTE 'DROP POLICY "Vendors can update orders with their products" ON public.orders';
  END IF;

  -- Order items policies
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='Users can view their order items') THEN
    EXECUTE 'DROP POLICY "Users can view their order items" ON public.order_items';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='order_items' AND policyname='Users can create order items for their orders') THEN
    EXECUTE 'DROP POLICY "Users can create order items for their orders" ON public.order_items';
  END IF;
END $$;

-- Recreate safer vendor policies on orders (no direct reference that triggers recursion)
CREATE POLICY "Vendors can view orders with their products"
ON public.orders
FOR SELECT
TO authenticated
USING (public.is_order_vendor(id, auth.uid()));

CREATE POLICY "Vendors can update orders with their products"
ON public.orders
FOR UPDATE
TO authenticated
USING (public.is_order_vendor(id, auth.uid()));

-- Recreate safer customer/vendor policies on order_items
CREATE POLICY "Users can view their order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (
  vendor_id = auth.uid()
  OR public.is_order_customer(order_id, auth.uid())
);

CREATE POLICY "Users can create order items for their orders"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (public.is_order_customer(order_id, auth.uid()));
