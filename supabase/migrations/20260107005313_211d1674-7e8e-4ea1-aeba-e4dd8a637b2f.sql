-- Add coordinate columns to delivery_addresses for geocoding
ALTER TABLE public.delivery_addresses
ADD COLUMN latitude DECIMAL(10, 8),
ADD COLUMN longitude DECIMAL(11, 8);

-- Add index for faster coordinate lookups
CREATE INDEX idx_delivery_addresses_coordinates 
ON public.delivery_addresses (latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.delivery_addresses.latitude IS 'Latitude coordinate from geocoding';
COMMENT ON COLUMN public.delivery_addresses.longitude IS 'Longitude coordinate from geocoding';