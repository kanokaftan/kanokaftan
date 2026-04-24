-- Fix product-images storage policies: allow admins (not just vendors) to upload
DROP POLICY IF EXISTS "Vendors can upload product images" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can update product images" ON storage.objects;
DROP POLICY IF EXISTS "Vendors can delete product images" ON storage.objects;

CREATE POLICY "Admins can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'product-images'
  AND public.has_role(auth.uid(), 'admin')
);
