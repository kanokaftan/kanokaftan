import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, paymentsNotConfigured } from "../_shared/cors.ts";
import { isPaystackNotConfigured } from "../_shared/paystack.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { confirmOrderPayment } from "../_shared/payments.ts";
import { isRateLimited } from "../_shared/rateLimit.ts";

/** Checks per IP per minute: plenty for a shopper refreshing a payment page. */
const VERIFY_LIMIT_PER_MINUTE = 20;
const MINUTE_SECONDS = 60;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (await isRateLimited(req, 'verify-payment', VERIFY_LIMIT_PER_MINUTE, MINUTE_SECONDS)) {
    return json({ success: false, error: 'Too many checks. Please wait a minute and try again.' }, 429);
  }

  try {
    const { reference, orderId } = await req.json();

    if (!reference) {
      throw new Error('Payment reference is required');
    }

    const result = await confirmOrderPayment(serviceClient(), reference, orderId || undefined);

    return json({
      success: result.status !== 'not_successful',
      status: result.status === 'not_successful' ? result.transaction.status : result.status,
      amount: result.transaction.amount / 100,
      reference: result.transaction.reference,
      paidAt: result.transaction.paid_at,
    });
  } catch (error: unknown) {
    if (isPaystackNotConfigured(error)) return paymentsNotConfigured();
    // Full details stay in the logs; shoppers get a plain message (no database text or amounts).
    console.error('Verification error:', error);
    const message = error instanceof Error && error.message === 'Payment reference is required'
      ? error.message
      : "We couldn't confirm this payment yet. If you were charged, it will be confirmed automatically within a few minutes.";
    return json({ success: false, error: message }, 400);
  }
});
