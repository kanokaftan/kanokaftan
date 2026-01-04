import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    const { reference, orderId } = await req.json();

    if (!reference) {
      throw new Error('Payment reference is required');
    }

    console.log(`Verifying payment: ${reference}`);

    // Verify with Paystack
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
      },
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      throw new Error('Failed to verify payment');
    }

    const transaction = paystackData.data;
    const isSuccessful = transaction.status === 'success';

    console.log(`Payment verification result: ${transaction.status}`);

    if (isSuccessful && orderId) {
      // Update order if payment is successful
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'payment_confirmed',
          escrow_status: 'held',
          tracking_updates: [
            {
              status: 'payment_confirmed',
              message: 'Payment verified and held in escrow',
              timestamp: new Date().toISOString()
            }
          ],
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId)
        .eq('payment_status', 'pending'); // Only update if not already paid

      if (updateError) {
        console.error('Failed to update order:', updateError);
      }
    }

    return new Response(
      JSON.stringify({
        success: isSuccessful,
        status: transaction.status,
        amount: transaction.amount / 100, // Convert from kobo to naira
        reference: transaction.reference,
        paidAt: transaction.paid_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Verification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
