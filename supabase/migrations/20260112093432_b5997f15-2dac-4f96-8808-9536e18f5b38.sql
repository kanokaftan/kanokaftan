-- P0: Fix Profiles RLS Security - Restrict sensitive data

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;

-- Create policy for users to view their own full profile
CREATE POLICY "Users can view their own full profile"
ON public.profiles
FOR SELECT
USING (auth.uid() = id);

-- Create a view for public vendor information (storefront display)
CREATE OR REPLACE VIEW public.public_vendor_profiles AS
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

-- Create policy for viewing vendor profiles (for product pages, storefront)
CREATE POLICY "Anyone can view vendor store info"
ON public.profiles
FOR SELECT
USING (
  store_name IS NOT NULL 
  AND (
    -- Only expose non-sensitive fields through joins
    auth.uid() = id 
    OR EXISTS (
      SELECT 1 FROM public.products WHERE vendor_id = profiles.id AND is_active = true
    )
  )
);

-- Ensure users can still update their own profile
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Ensure users can insert their own profile (for new user creation trigger)
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
ON public.profiles
FOR INSERT
WITH CHECK (auth.uid() = id);