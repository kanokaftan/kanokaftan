-- Drop duplicate policies that may conflict
DROP POLICY IF EXISTS "Vendors can view their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Vendors can update their own order items" ON public.order_items;
DROP POLICY IF EXISTS "Vendors can view orders containing their items" ON public.orders;
DROP POLICY IF EXISTS "Vendors can update orders containing their items" ON public.orders;

-- Update the order_items INSERT policy to be simpler and not cause circular dependency
DROP POLICY IF EXISTS "Users can create order items for their orders" ON public.order_items;

CREATE POLICY "Users can create order items for their orders"
ON public.order_items
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.orders WHERE id = order_items.order_id
  )
);

-- Also add vendor access to order_items for update (to track item status if needed in future)
CREATE POLICY "Vendors can update their order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (vendor_id = auth.uid())
WITH CHECK (vendor_id = auth.uid());