-- Indexes for foreign keys the Supabase performance advisor flagged.
CREATE INDEX IF NOT EXISTS ambassador_applications_ambassador_idx ON public.ambassador_applications (ambassador_id);
CREATE INDEX IF NOT EXISTS flash_sales_created_by_idx ON public.flash_sales (created_by);
CREATE INDEX IF NOT EXISTS order_deliveries_created_by_idx ON public.order_deliveries (created_by);
CREATE INDEX IF NOT EXISTS partner_commissions_payout_idx ON public.partner_commissions (payout_id);
CREATE INDEX IF NOT EXISTS partner_payouts_partner_idx ON public.partner_payouts (partner_id);
CREATE INDEX IF NOT EXISTS vendor_applications_reviewed_by_idx ON public.vendor_applications (reviewed_by);
CREATE INDEX IF NOT EXISTS vendor_verification_requests_reviewed_by_idx ON public.vendor_verification_requests (reviewed_by);
