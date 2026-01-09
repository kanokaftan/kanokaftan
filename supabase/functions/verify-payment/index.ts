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
      // Get order details first
      const { data: order, error: orderFetchError } = await supabase
        .from('orders')
        .select('user_id, total, payment_status')
        .eq('id', orderId)
        .single();

      // Check if already processed to prevent duplicate notifications
      if (order?.payment_status === 'paid') {
        console.log('Order already processed, skipping notifications');
        return new Response(
          JSON.stringify({
            success: true,
            status: 'already_processed',
            amount: transaction.amount / 100,
            reference: transaction.reference,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Update order if payment is successful
      const { error: updateError, data: updateData } = await supabase
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
        .eq('payment_status', 'pending') // Only update if not already paid
        .select();

      if (updateError) {
        console.error('Failed to update order:', updateError);
      } else if (updateData && updateData.length > 0) {
        // Only send notifications if the update actually happened
        console.log('Order updated, sending notifications...');
        
        // Send SINGLE notification to customer (moved OUTSIDE the loop)
        if (order?.user_id) {
          await supabase.from('notifications').insert({
            user_id: order.user_id,
            title: 'Payment Confirmed!',
            message: `Your payment of ₦${(transaction.amount / 100).toLocaleString()} has been received. Your order is being processed.`,
            type: 'success',
            category: 'payment',
            action_url: `/orders/${orderId}`,
            metadata: { order_id: orderId, amount: transaction.amount / 100 }
          });
          console.log('Customer notification sent');
        }

        // Reduce stock and notify vendors
        console.log('Payment confirmed, reducing stock for order:', orderId);
        
        const { data: orderItems, error: itemsError } = await supabase
          .from('order_items')
          .select('product_id, quantity, variant_id, vendor_id, product_name, total_price')
          .eq('order_id', orderId);

        if (itemsError) {
          console.error('Failed to fetch order items:', itemsError);
        } else if (orderItems) {
          // Group items by vendor for notifications
          const vendorOrders: Record<string, { items: typeof orderItems; total: number }> = {};

          for (const item of orderItems) {
            // Track vendor orders
            if (!vendorOrders[item.vendor_id]) {
              vendorOrders[item.vendor_id] = { items: [], total: 0 };
            }
            vendorOrders[item.vendor_id].items.push(item);
            vendorOrders[item.vendor_id].total += item.total_price;

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

          // Notify each vendor about their new order (ONE notification per vendor)
          const vendorNotifications = Object.entries(vendorOrders).map(([vendorId, vendorOrder]) => {
            const itemNames = vendorOrder.items.map(i => i.product_name).slice(0, 2).join(', ');
            const moreItems = vendorOrder.items.length > 2 ? ` +${vendorOrder.items.length - 2} more` : '';
            return {
              user_id: vendorId,
              title: 'New Order Received!',
              message: `You have a new order for ${itemNames}${moreItems}. Total: ₦${vendorOrder.total.toLocaleString()}`,
              type: 'order',
              category: 'order',
              action_url: '/vendor/orders',
              metadata: { order_id: orderId, total: vendorOrder.total }
            };
          });

          if (vendorNotifications.length > 0) {
            await supabase.from('notifications').insert(vendorNotifications);
            console.log(`Sent ${vendorNotifications.length} vendor notification(s)`);
          }

          // Notify admins (ONE notification per admin)
          const { data: adminUsers } = await supabase
            .from('user_roles')
            .select('user_id')
            .eq('role', 'admin');

          if (adminUsers && adminUsers.length > 0) {
            const adminNotifications = adminUsers.map(admin => ({
              user_id: admin.user_id,
              title: 'New Paid Order',
              message: `Order #${orderId.slice(0, 8)} has been paid. Amount: ₦${(transaction.amount / 100).toLocaleString()}`,
              type: 'payment' as const,
              category: 'payment' as const,
              action_url: '/admin/orders',
              metadata: { order_id: orderId, amount: transaction.amount / 100 }
            }));
            await supabase.from('notifications').insert(adminNotifications);
            console.log(`Sent ${adminNotifications.length} admin notification(s)`);
          }
        }
      } else {
        console.log('Order was already updated or not found, skipping notifications');
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