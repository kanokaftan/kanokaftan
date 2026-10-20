-- Each product photo can say which colour it shows, so the product page can
-- select that colour when a shopper swipes to the photo (and jump to the photo
-- when they tap the colour).
ALTER TABLE public.product_images ADD COLUMN IF NOT EXISTS color TEXT
  CHECK (color IS NULL OR char_length(color) BETWEEN 1 AND 30);
