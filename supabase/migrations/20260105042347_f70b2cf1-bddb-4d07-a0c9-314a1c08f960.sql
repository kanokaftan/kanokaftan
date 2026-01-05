-- Create flash_sales table for time-limited deals
CREATE TABLE public.flash_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  sale_price NUMERIC NOT NULL,
  original_price NUMERIC NOT NULL,
  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,
  max_quantity INTEGER DEFAULT NULL,
  sold_quantity INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.flash_sales ENABLE ROW LEVEL SECURITY;

-- Everyone can view active flash sales
CREATE POLICY "Flash sales are viewable by everyone"
ON public.flash_sales
FOR SELECT
USING (is_active = true AND starts_at <= now() AND ends_at > now());

-- Admins can manage all flash sales
CREATE POLICY "Admins can manage flash sales"
ON public.flash_sales
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Vendors can manage flash sales for their products
CREATE POLICY "Vendors can manage their flash sales"
ON public.flash_sales
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM products p
    WHERE p.id = flash_sales.product_id
    AND p.vendor_id = auth.uid()
  )
);

-- Create indexes
CREATE INDEX idx_flash_sales_product ON public.flash_sales(product_id);
CREATE INDEX idx_flash_sales_active ON public.flash_sales(is_active, starts_at, ends_at);
CREATE INDEX idx_flash_sales_ends_at ON public.flash_sales(ends_at);