import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FEATURED_PRICE_KOBO = 100000; // ₦1000 in kobo
const FEATURED_PROMO_CODE = "K2WFAAD";

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { productId, email, promoCode, callbackUrl } = await req.json();

    if (!productId) {
      throw new Error('Product ID is required');
    }

    console.log(`Processing featured listing for product: ${productId}`);

    // Fetch product details
    const { data: product, error: productError } = await supabase
      .from('products')
      .select('*, vendor:profiles!products_vendor_id_fkey(email)')
      .eq('id', productId)
      .single();

    if (productError || !product) {
      console.error('Product fetch error:', productError);
      throw new Error('Product not found');
    }

    if (product.featured) {
      throw new Error('Product is already featured');
    }

    // Check promo code
    if (promoCode && promoCode.toUpperCase() === FEATURED_PROMO_CODE) {
      console.log('Valid promo code used, featuring product for free');
      
      const { error: updateError } = await supabase
        .from('products')
        .update({ featured: true })
        .eq('id', productId);

      if (updateError) throw updateError;

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Product featured successfully using promo code',
          promo_applied: true,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process Paystack payment
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    const vendorEmail = email || product.vendor?.email;
    if (!vendorEmail) {
      throw new Error('Email is required for payment');
    }

    const reference = `FEAT-${productId.substring(0, 8)}-${Date.now()}`;

    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: vendorEmail,
        amount: FEATURED_PRICE_KOBO,
        reference,
        callback_url: callbackUrl || `${req.headers.get('origin')}/vendor/products`,
        metadata: {
          product_id: productId,
          type: 'featured_listing',
          custom_fields: [
            {
              display_name: "Product ID",
              variable_name: "product_id",
              value: productId
            },
            {
              display_name: "Type",
              variable_name: "type",
              value: "featured_listing"
            }
          ]
        }
      }),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error('Paystack error:', paystackData);
      throw new Error(paystackData.message || 'Failed to initialize payment');
    }

    console.log(`Featured payment initialized: ${paystackData.data.reference}`);

    return new Response(
      JSON.stringify({
        success: true,
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Featured payment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
