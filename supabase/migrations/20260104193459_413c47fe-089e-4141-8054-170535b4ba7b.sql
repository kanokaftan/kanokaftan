-- Allow vendors to update orders that contain their products
CREATE POLICY "Vendors can update orders with their products" 
ON public.orders 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM order_items oi 
    WHERE oi.order_id = orders.id 
    AND oi.vendor_id = auth.uid()
  )
);

-- Allow vendors to view orders containing their products
CREATE POLICY "Vendors can view orders with their products" 
ON public.orders 
FOR SELECT 
USING (
  user_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM order_items oi 
    WHERE oi.order_id = orders.id 
    AND oi.vendor_id = auth.uid()
  )
);