-- Add is_verified column to profiles table for vendor verification
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS is_verified boolean NOT NULL DEFAULT false;

-- Add index for verified vendors
CREATE INDEX IF NOT EXISTS idx_profiles_is_verified ON public.profiles(is_verified);

-- Comment for documentation
COMMENT ON COLUMN public.profiles.is_verified IS 'Whether the vendor has been verified using a verification code';