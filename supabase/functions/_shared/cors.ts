export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

/** Same code the app looks for to show "payments are being set up" instead of an error. */
export const PAYMENTS_NOT_CONFIGURED = 'payments_not_configured';

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Friendly 503 while Paystack isn't connected; works by itself once the key is added. */
export function paymentsNotConfigured(message = "Payments aren't switched on yet. Please try again a little later."): Response {
  console.error('[payments] PAYSTACK_SECRET_KEY is not set in Edge Function secrets');
  return json({ success: false, code: PAYMENTS_NOT_CONFIGURED, error: message }, 503);
}
