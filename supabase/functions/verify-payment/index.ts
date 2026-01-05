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
      } else {
        // Reduce stock for each order item
        console.log('Payment confirmed, reducing stock for order:', orderId);
        
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity, variant_id')
          .eq('order_id', orderId);

        if (itemsError) {
          console.error('Failed to fetch order items:', itemsError);
        } else if (orderItems) {
          for (const item of orderItems) {
            // Get current stock
            const { data: product, error: productError } = await supabase
              .from('products')
              .select('stock_quantity')
              .eq('id', item.product_id)
              .single();

            if (productError) {
              console.error(`Failed to fetch product ${item.product_id}:`, productError);
              continue;
            }

            const newStock = Math.max(0, (product?.stock_quantity || 0) - item.quantity);
            
            // Update product stock
            const { error: stockError } = await supabase
              .from('products')
              .update({ stock_quantity: newStock })
              .eq('id', item.product_id);

            if (stockError) {
              console.error(`Failed to update stock for product ${item.product_id}:`, stockError);
            } else {
              console.log(`Reduced stock for product ${item.product_id}: ${product?.stock_quantity} -> ${newStock}`);
            }

            // Also update variant stock if applicable
            if (item.variant_id) {
              const { data: variant, error: variantFetchError } = await supabase
                .from('product_variants')
                .select('stock_quantity')
                .eq('id', item.variant_id)
                .single();

              if (!variantFetchError && variant) {
                const newVariantStock = Math.max(0, (variant.stock_quantity || 0) - item.quantity);
                await supabase
                  .from('product_variants')
                  .update({ stock_quantity: newVariantStock })
                  .eq('id', item.variant_id);
              }
            }
          }
        }
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
