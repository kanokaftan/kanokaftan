-- Vendor access to their order_items
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view their own order items"
ON public.order_items
FOR SELECT
TO authenticated
USING (vendor_id = auth.uid());

-- Allow vendors to update their own order items if needed (optional, currently not used)
CREATE POLICY "Vendors can update their own order items"
ON public.order_items
FOR UPDATE
TO authenticated
USING (vendor_id = auth.uid())
WITH CHECK (vendor_id = auth.uid());

-- Vendor access to orders that contain at least one of their order_items
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors can view orders containing their items"
ON public.orders
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = orders.id
      AND oi.vendor_id = auth.uid()
  )
);

-- Allow vendors to update order status + tracking for orders containing their items
CREATE POLICY "Vendors can update orders containing their items"
ON public.orders
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = orders.id
      AND oi.vendor_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.order_items oi
    WHERE oi.order_id = orders.id
      AND oi.vendor_id = auth.uid()
  )
);
