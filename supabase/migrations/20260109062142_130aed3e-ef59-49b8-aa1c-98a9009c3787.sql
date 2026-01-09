-- Add parent_id to categories for subcategories
ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_categories_parent ON public.categories(parent_id);

-- Add user preferences to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS notification_push BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_orders BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notification_promotions BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'en',
ADD COLUMN IF NOT EXISTS preferred_currency TEXT DEFAULT 'NGN';

-- Create shipping promo codes table
CREATE TABLE IF NOT EXISTS public.shipping_promo_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('free', 'percentage')),
  discount_value INTEGER NOT NULL DEFAULT 0,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shipping_promo_codes ENABLE ROW LEVEL SECURITY;

-- Everyone can read active promo codes
CREATE POLICY "Promo codes are viewable by everyone" ON public.shipping_promo_codes
FOR SELECT USING (is_active = true);

-- Admins can manage promo codes
CREATE POLICY "Admins can manage promo codes" ON public.shipping_promo_codes
FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert initial promo codes
INSERT INTO public.shipping_promo_codes (code, discount_type, discount_value, expires_at, is_active)
VALUES 
  ('FREESHIP26', 'free', 100, '2026-12-31 23:59:59+00', true),
  ('HALFSHIP26', 'percentage', 50, '2026-12-31 23:59:59+00', true)
ON CONFLICT (code) DO NOTHING;