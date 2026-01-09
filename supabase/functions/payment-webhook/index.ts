import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

async function verifySignature(body: string, signature: string, secret: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"]
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  const hashArray = Array.from(new Uint8Array(signatureBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex === signature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const body = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    // Verify webhook signature
    if (signature) {
      const isValid = await verifySignature(body, signature, paystackSecretKey);
      if (!isValid) {
        console.error('Invalid webhook signature');
        return new Response('Invalid signature', { status: 401 });
      }
    }

    const event = JSON.parse(body);
    console.log(`Received webhook event: ${event.event}`);

    if (event.event === 'charge.success') {
      const { reference, metadata } = event.data;
      const orderId = metadata?.order_id;

      if (!orderId) {
        console.error('No order ID in webhook metadata');
        return new Response('OK', { status: 200 });
      }

      console.log(`Processing webhook for order: ${orderId}, reference: ${reference}`);

      // Check if already processed - idempotency check
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('payment_status, payment_reference')
        .eq('id', orderId)
        .single();

      if (existingOrder?.payment_status === 'paid' || existingOrder?.payment_reference === reference) {
        console.log('Order already processed via verify-payment, skipping webhook update');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      // Update order status with idempotency guards
      const { error: updateError, data: updateData } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'payment_confirmed',
          escrow_status: 'held',
          payment_reference: reference,
          tracking_updates: [
            {
              status: 'payment_confirmed',
              message: 'Payment received and held in escrow',
              timestamp: new Date().toISOString()
            }
          ],
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('payment_status', 'pending') // Only update if still pending
        .is('payment_reference', null) // Only if not already processed
        .select();

      if (updateError) {
        console.error('Failed to update order:', updateError);
        throw updateError;
      }

      if (!updateData || updateData.length === 0) {
        console.log('Order was already updated by another process');
        return new Response('OK', { status: 200, headers: corsHeaders });
      }

      console.log(`Order ${orderId} updated successfully via webhook`);
    }

    return new Response('OK', { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    });
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response('Webhook error', { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' } 
    });
  }
});
