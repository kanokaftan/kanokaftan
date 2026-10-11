import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, paymentsNotConfigured } from "../_shared/cors.ts";
import { getCaller, serviceClient } from "../_shared/supabase.ts";
import { isPaystackNotConfigured, paystack } from "../_shared/paystack.ts";
import { confirmFeePayment } from "../_shared/fees.ts";

// Vendor fees paid through Paystack.
//   pay_verification                 -> checkout link for the caller's open verification request
//   pay_featured { placement_id }    -> checkout link for one of the caller's unpaid placements
//   confirm { reference }            -> re-check a payment after Paystack sends the vendor back
// The request/placement itself is created first with the submit_verification /
// request_featured_placement RPCs, which price it on the server.

const RETURN_PATHS = {
  verification: '/vendor/verification',
  featured: '/vendor/promote',
} as const;

function siteOrigin(req: Request): string {
  const origin = req.headers.get('origin') ?? '';
  // Only send vendors back to our own site.
  if (/^https:\/\/(www\.)?kanokaftan\.shop$/.test(origin) || /^https:\/\/[a-z0-9-]+\.vercel\.app$/.test(origin)
    || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
    return origin;
  }
  return 'https://kanokaftan.shop';
}

async function startCheckout(opts: {
  email: string;
  amount: number;
  reference: string;
  callbackUrl: string;
  metadata: Record<string, unknown>;
}): Promise<string> {
  const res = await paystack<{ authorization_url: string }>('/transaction/initialize', {
    method: 'POST',
    body: JSON.stringify({
      email: opts.email,
      amount: Math.round(opts.amount * 100),
      currency: 'NGN',
      reference: opts.reference,
      callback_url: opts.callbackUrl,
      metadata: opts.metadata,
    }),
  });
  if (!res.status) throw new Error(res.message || 'Could not start the payment');
  return res.data.authorization_url;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ success: false, error: 'Please sign in' }, 401);
    if (!caller.email) return json({ success: false, error: 'Your account needs an email address to pay' }, 400);

    const supabase = serviceClient();
    const { data: isVendor } = await supabase.rpc('has_role', { _user_id: caller.id, _role: 'vendor' });
    if (!isVendor) return json({ success: false, error: 'Sellers only' }, 403);

    const { action, placement_id, reference } = await req.json();
    const origin = siteOrigin(req);

    if (action === 'pay_verification') {
      const { data: request, error } = await supabase
        .from('vendor_verification_requests')
        .select('id, amount, status')
        .eq('vendor_id', caller.id)
        .eq('status', 'awaiting_payment')
        .maybeSingle();
      if (error) throw error;
      if (!request) throw new Error('Submit your details first');

      const ref = `vf_${request.id.slice(0, 8)}_${Date.now()}`;
      const { error: refError } = await supabase
        .from('vendor_verification_requests')
        .update({ payment_reference: ref })
        .eq('id', request.id);
      if (refError) throw refError;

      const url = await startCheckout({
        email: caller.email,
        amount: Number(request.amount),
        reference: ref,
        callbackUrl: `${origin}${RETURN_PATHS.verification}`,
        metadata: { type: 'verification_fee', request_id: request.id, vendor_id: caller.id },
      });
      return json({ success: true, authorization_url: url, reference: ref });
    }

    if (action === 'pay_featured') {
      if (!placement_id) throw new Error('Choose what to promote');
      const { data: placement, error } = await supabase
        .from('featured_placements')
        .select('id, amount, status, kind')
        .eq('id', placement_id)
        .eq('vendor_id', caller.id)
        .maybeSingle();
      if (error) throw error;
      if (!placement || placement.status !== 'awaiting_payment') throw new Error('This promotion is not waiting for payment');

      const ref = `fp_${placement.id.slice(0, 8)}_${Date.now()}`;
      const { error: refError } = await supabase
        .from('featured_placements')
        .update({ payment_reference: ref })
        .eq('id', placement.id);
      if (refError) throw refError;

      const url = await startCheckout({
        email: caller.email,
        amount: Number(placement.amount),
        reference: ref,
        callbackUrl: `${origin}${RETURN_PATHS.featured}`,
        metadata: { type: 'featured_placement', placement_id: placement.id, kind: placement.kind, vendor_id: caller.id },
      });
      return json({ success: true, authorization_url: url, reference: ref });
    }

    if (action === 'confirm') {
      if (typeof reference !== 'string' || !reference) throw new Error('Missing payment reference');

      // The reference must belong to the caller.
      const [{ data: ver }, { data: feat }] = await Promise.all([
        supabase.from('vendor_verification_requests').select('id').eq('payment_reference', reference).eq('vendor_id', caller.id).maybeSingle(),
        supabase.from('featured_placements').select('id').eq('payment_reference', reference).eq('vendor_id', caller.id).maybeSingle(),
      ]);
      if (!ver && !feat) return json({ success: false, error: 'Payment not found' }, 404);

      const result = await confirmFeePayment(supabase, reference);
      return json({ success: true, result });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (error: unknown) {
    if (isPaystackNotConfigured(error)) {
      return paymentsNotConfigured("Card payments aren't switched on yet. Please try again a little later.");
    }
    const message = error instanceof Error ? error.message : 'Something went wrong';
    console.error('vendor-fees error:', error);
    return json({ success: false, error: message }, 400);
  }
});
