import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { getCaller, isAdmin, serviceClient } from "../_shared/supabase.ts";
import { paystack, paystackConfigured } from "../_shared/paystack.ts";

// Admin-only health check for payments: is Paystack connected, live or test
// mode, how much is available for payouts, and what still needs setting up.

function safeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The database scheduler / support tooling authenticates with the internal hook secret. */
async function isInternalCall(req: Request): Promise<boolean> {
  const given = req.headers.get('x-push-secret');
  if (!given) return false;
  const { data } = await serviceClient().from('push_config').select('hook_secret').eq('id', 1).maybeSingle();
  return !!data?.hook_secret && safeEqual(given, data.hook_secret);
}

interface Balance {
  currency: string;
  balance: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!(await isInternalCall(req))) {
      const caller = await getCaller(req);
      if (!caller || !(await isAdmin(caller.id))) return json({ success: false, error: 'Admins only' }, 403);
    }

    const body = await req.json().catch(() => ({}));
    // Diagnose a bank-account check exactly as Paystack answers it (no secrets returned).
    if (body?.action === 'resolve_test') {
      if (!paystackConfigured()) return json({ success: false, error: 'PAYSTACK_SECRET_KEY is not set' }, 503);
      const mode = (Deno.env.get('PAYSTACK_SECRET_KEY') ?? '').startsWith('sk_live_') ? 'live' : 'test';
      const banks = await paystack<{ name: string; code: string; active: boolean }[]>('/bank?country=nigeria&currency=NGN&perPage=200');
      const bank = banks.status ? banks.data.find((b) => b.code === String(body.bank_code)) : undefined;
      const resolved = await paystack<{ account_name: string }>(
        `/bank/resolve?account_number=${encodeURIComponent(String(body.account_number ?? ''))}&bank_code=${encodeURIComponent(String(body.bank_code ?? ''))}`,
      );
      return json({
        success: true,
        mode,
        bank_list_ok: banks.status,
        bank_count: banks.status ? banks.data.length : 0,
        bank: bank ? { name: bank.name, code: bank.code, active: bank.active } : null,
        resolve_status: resolved.status,
        resolve_message: resolved.message,
        resolved_name: resolved.data?.account_name ?? null,
      });
    }

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
