-- Drop the restrictive policy and create proper policies for cart
DROP POLICY IF EXISTS "Users can manage their own cart" ON public.cart_items;

-- Allow authenticated users to manage their cart
CREATE POLICY "Authenticated users can manage cart"
ON public.cart_items
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow guest cart operations (session-based)
CREATE POLICY "Guest cart access"
ON public.cart_items
FOR ALL
TO anon
USING (user_id IS NULL AND session_id IS NOT NULL)
WITH CHECK (user_id IS NULL AND session_id IS NOT NULL);