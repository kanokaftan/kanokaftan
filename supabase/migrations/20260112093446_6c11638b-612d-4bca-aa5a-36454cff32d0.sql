-- Fix Security Definer View issue by setting security_invoker
-- Drop and recreate the view with proper security settings

DROP VIEW IF EXISTS public.public_vendor_profiles;

-- Create the view with SECURITY INVOKER (which respects RLS of the querying user)
CREATE VIEW public.public_vendor_profiles
WITH (security_invoker = true)
AS
SELECT 
  id,
  full_name,
  avatar_url,
  is_verified,
  store_name,
  store_description,
  store_address
FROM public.profiles
WHERE store_name IS NOT NULL;

-- Grant access to the view
GRANT SELECT ON public.public_vendor_profiles TO anon, authenticated;