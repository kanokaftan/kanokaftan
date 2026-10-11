import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { getCaller, isAdmin, serviceClient } from "../_shared/supabase.ts";
import { paystack, paystackConfigured } from "../_shared/paystack.ts";

// Admin-only health check for payments: is Paystack connected, live or test
// mode, how much is available for payouts, and what still needs setting up.

interface Balance {
  currency: string;
  balance: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await getCaller(req);
    if (!caller || !(await isAdmin(caller.id))) return json({ success: false, error: 'Admins only' }, 403);

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const webhookUrl = `${supabaseUrl}/functions/v1/payment-webhook`;
    const db = serviceClient();

    const [{ count: pendingPayouts }, { count: waitingForAccount }, { count: payoutAccounts }] = await Promise.all([
      db.from('payouts').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
      db.from('payouts').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('failure_reason', 'Vendor has not added a bank account yet'),
      db.from('vendor_payout_accounts').select('vendor_id', { count: 'exact', head: true }),
    ]);

    const base = {
      success: true,
      webhook_url: webhookUrl,
      pending_payouts: pendingPayouts ?? 0,
      payouts_waiting_for_bank_account: waitingForAccount ?? 0,
      sellers_with_bank_account: payoutAccounts ?? 0,
    };

    if (!paystackConfigured()) {
      return json({ ...base, connected: false, mode: null, problem: 'PAYSTACK_SECRET_KEY is not set in Supabase Edge Function secrets.' });
    }

    const mode = (Deno.env.get('PAYSTACK_SECRET_KEY') ?? '').startsWith('sk_live_') ? 'live' : 'test';
    const balance = await paystack<Balance[]>('/balance');
    if (!balance.status) {
      // Wrong / revoked key, or Paystack is down.
      return json({ ...base, connected: false, mode, problem: `Paystack rejected the key: ${balance.message}` });
    }
    const ngn = balance.data.find((b) => b.currency === 'NGN');
    return json({
      ...base,
      connected: true,
      mode,
      // Paystack reports kobo.
      transfer_balance: ngn ? ngn.balance / 100 : 0,
      problem: null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[payments-status] failed:', message);
    return json({ success: false, error: message }, 500);
  }
});
