import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { getCaller, isAdmin, serviceClient } from "../_shared/supabase.ts";
import { processPendingPayouts, reconcileProcessingPayouts } from "../_shared/payouts.ts";
import { paystackConfigured } from "../_shared/paystack.ts";

function safeEqual(a: string, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Scheduled payout run (and the admin "send payouts now" button):
//   1. releases second halves whose delivery window has ended,
//   2. sends every pending payout,
//   3. re-checks transfers stuck in processing,
//   4. ends featured placements whose time is up.
// Callable by the database scheduler (pg_cron, every 15 min, with the internal
// hook secret), with the CRON_SECRET, or by a signed-in admin.
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = serviceClient();
    const cronSecret = Deno.env.get('CRON_SECRET');
    let isCron = !!cronSecret && safeEqual(req.headers.get('x-cron-secret') ?? '', cronSecret);
    if (!isCron && req.headers.get('x-push-secret')) {
      const { data: config } = await supabase.from('push_config').select('hook_secret').eq('id', 1).maybeSingle();
      isCron = !!config?.hook_secret && safeEqual(req.headers.get('x-push-secret') ?? '', config.hook_secret);
    }

    if (!isCron) {
      const caller = await getCaller(req);
      if (!caller || !(await isAdmin(caller.id))) {
        return json({ success: false, error: 'Not allowed' }, 403);
      }
    }

    const { data: released, error: releaseError } = await supabase.rpc('release_due_payouts');
    if (releaseError) throw releaseError;

    // Featured placements and timed verification badges that ran out.
    const { data: expired, error: expireError } = await supabase.rpc('expire_featured_placements');
    if (expireError) console.error('Expiring featured placements failed:', expireError);

    const summary = await processPendingPayouts(supabase);
    const reconciled = await reconcileProcessingPayouts(supabase);

    return json({
      success: true,
      paystack_connected: paystackConfigured(),
      released,
      reconciled,
      expired_placements: expired ?? 0,
      ...summary,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Payout run failed:', error);
    return json({ success: false, error: message }, 500);
  }
});
