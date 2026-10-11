import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { isPaystackNotConfigured, verifySignature } from "../_shared/paystack.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { confirmOrderPayment } from "../_shared/payments.ts";
import { applyTransferStatus } from "../_shared/payouts.ts";
import { confirmFeePayment, isFeePayment } from "../_shared/fees.ts";

const TRANSFER_EVENTS: Record<string, string> = {
  'transfer.success': 'success',
  'transfer.failed': 'failed',
  'transfer.reversed': 'reversed',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.text();

    // Every genuine Paystack webhook is signed; reject anything that isn't.
    if (!(await verifySignature(body, req.headers.get('x-paystack-signature')))) {
      console.error('Rejected webhook with missing or invalid signature');
      return new Response('Invalid signature', { status: 401 });
    }

    const event = JSON.parse(body);
    const supabase = serviceClient();
    console.log(`Received webhook event: ${event.event}`);

    if (event.event === 'charge.success') {
      if (event.data?.metadata?.order_id) {
        const result = await confirmOrderPayment(supabase, event.data.reference);
        console.log(`Order ${result.orderId}: ${result.status}`);
      } else if (isFeePayment(event.data?.metadata)) {
        const result = await confirmFeePayment(supabase, event.data.reference);
        console.log(`Fee payment ${event.data.reference}: ${result}`);
      }
    } else if (event.event in TRANSFER_EVENTS) {
      await applyTransferStatus(
        supabase,
        event.data.reference,
        TRANSFER_EVENTS[event.event],
        event.data.transfer_code,
        event.data.reason,
      );
    }

    return new Response('OK', { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  } catch (error) {
    if (isPaystackNotConfigured(error)) {
      // Paystack keeps retrying for a while, so events arriving before the key is added aren't lost.
      console.error('Webhook received but PAYSTACK_SECRET_KEY is not set yet; Paystack will retry');
      return new Response('Payments not configured yet', { status: 503, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
    }
    console.error('Webhook error:', error);
    // Non-2xx makes Paystack retry the event later.
    return new Response('Webhook error', { status: 500, headers: { ...corsHeaders, 'Content-Type': 'text/plain' } });
  }
});
