import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, paymentsNotConfigured } from "../_shared/cors.ts";
import { isPaystackNotConfigured } from "../_shared/paystack.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { confirmOrderPayment } from "../_shared/payments.ts";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Verification error:', error);
    return json({ success: false, error: message }, 400);
  }
});
