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

    const { reference } = await req.json();

    if (!reference) {
      throw new Error('Payment reference is required');
    }

    console.log(`Verifying featured payment: ${reference}`);

    // Verify with Paystack
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
        },
      }
    );

    const verifyData = await verifyResponse.json();

    if (!verifyData.status || verifyData.data.status !== 'success') {
      console.error('Payment verification failed:', verifyData);
      return new Response(
        JSON.stringify({ 
          success: false, 
          verified: false,
          message: 'Payment not successful' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract product ID from metadata
    const productId = verifyData.data.metadata?.product_id;
    const paymentType = verifyData.data.metadata?.type;

    if (!productId || paymentType !== 'featured_listing') {
      throw new Error('Invalid payment metadata');
    }

    console.log(`Payment verified, featuring product: ${productId}`);

    // Update product to featured
    const { error: updateError } = await supabase
      .from('products')
      .update({ featured: true })
      .eq('id', productId);

    if (updateError) {
      console.error('Failed to update product:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        product_id: productId,
        message: 'Product is now featured',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Featured verification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
