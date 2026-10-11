import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";
import { paystack, paystackConfigured } from "./paystack.ts";

interface PayoutRow {
  id: string;
  order_id: string;
  vendor_id: string;
  tranche: number;
  amount: number;
  attempts: number;
}

interface TransferData {
  status: string;
  transfer_code: string;
  reference: string;
}

export interface PayoutRunSummary {
  sent: number;
  waitingForBankAccount: number;
  failed: number;
}

/**
 * Sends every payout in `pending` status (optionally limited to one order or
 * vendor) as a Paystack transfer. Each attempt uses its own reference, so a
 * transfer Paystack already accepted can never be sent twice.
 */
export async function processPendingPayouts(
  supabase: SupabaseClient,
  filter: { orderId?: string; vendorId?: string } = {},
): Promise<PayoutRunSummary> {
  const summary: PayoutRunSummary = { sent: 0, waitingForBankAccount: 0, failed: 0 };
  // Without Paystack nothing can be sent: leave every payout "pending" so the
  // first run after the key is added sends them all.
  if (!paystackConfigured()) return summary;

  let query = supabase
    .from('payouts')
    .select('id, order_id, vendor_id, tranche, amount, attempts')
    .eq('status', 'pending')
    .order('created_at')
    .limit(100);
  if (filter.orderId) query = query.eq('order_id', filter.orderId);
  if (filter.vendorId) query = query.eq('vendor_id', filter.vendorId);

  const { data: payouts, error } = await query;
  if (error) throw error;
  if (!payouts?.length) return summary;

  const vendorIds = [...new Set(payouts.map((p) => p.vendor_id))];
  const { data: accounts, error: accountsError } = await supabase
    .from('vendor_payout_accounts')
    .select('vendor_id, recipient_code')
    .in('vendor_id', vendorIds);
  if (accountsError) throw accountsError;
  const recipients = new Map((accounts ?? []).map((a) => [a.vendor_id, a.recipient_code]));

  for (const payout of payouts as PayoutRow[]) {
    const recipient = recipients.get(payout.vendor_id);
    if (!recipient) {
      summary.waitingForBankAccount++;
      await supabase
        .from('payouts')
        .update({ failure_reason: 'Vendor has not added a bank account yet' })
        .eq('id', payout.id)
        .eq('status', 'pending');
      continue;
    }

    if (Number(payout.amount) <= 0) {
      await supabase.from('payouts').update({ status: 'paid', paid_at: new Date().toISOString() }).eq('id', payout.id);
      continue;
    }

    const attempt = payout.attempts + 1;
    const reference = `po_${payout.id.replace(/-/g, '')}_${attempt}`;

    // Claim the payout so concurrent runs can't send it too.
    const { data: claimed } = await supabase
      .from('payouts')
      .update({ status: 'processing', attempts: attempt, reference, failure_reason: null })
      .eq('id', payout.id)
      .eq('status', 'pending')
      .eq('attempts', payout.attempts)
      .select('id');
    if (!claimed?.length) continue;

    let result;
    try {
      result = await paystack<TransferData>('/transfer', {
        method: 'POST',
        body: JSON.stringify({
          source: 'balance',
          amount: Math.round(Number(payout.amount) * 100),
          recipient,
          reference,
          reason: `Kano Kaftan order #${payout.order_id.slice(0, 8)} (part ${payout.tranche} of 2)`,
        }),
      });
    } catch (networkError) {
      // Unknown outcome: leave it processing; reconcileProcessingPayouts checks later.
      console.error(`Transfer request for payout ${payout.id} failed:`, networkError);
      continue;
    }

    if (!result.status) {
      summary.failed++;
      await supabase
        .from('payouts')
        .update({ status: 'failed', failure_reason: result.message || 'Transfer rejected by Paystack' })
        .eq('id', payout.id);
      continue;
    }

    summary.sent++;
    await applyTransferStatus(supabase, reference, result.data.status, result.data.transfer_code);
  }

  return summary;
}

/**
 * Re-checks transfers that have been "processing" for a while, in case a
 * webhook was missed or the original request timed out.
 */
export async function reconcileProcessingPayouts(supabase: SupabaseClient): Promise<number> {
  if (!paystackConfigured()) return 0;
  const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data: stale, error } = await supabase
    .from('payouts')
    .select('reference')
    .eq('status', 'processing')
    .lt('updated_at', cutoff)
    .limit(100);
  if (error) throw error;

  for (const { reference } of stale ?? []) {
    if (!reference) continue;
    const result = await paystack<TransferData>(`/transfer/verify/${encodeURIComponent(reference)}`);
    if (result.status) {
      await applyTransferStatus(supabase, reference, result.data.status, result.data.transfer_code);
    } else if (/not found/i.test(result.message)) {
      // Paystack never created it, so it is safe to retry.
      await supabase
        .from('payouts')
        .update({ status: 'failed', failure_reason: 'Transfer was not created by Paystack' })
        .eq('reference', reference)
        .eq('status', 'processing');
    }
  }

  return stale?.length ?? 0;
}

/** Applies a Paystack transfer status (from an API response or webhook). */
export async function applyTransferStatus(
  supabase: SupabaseClient,
  reference: string,
  transferStatus: string,
  transferCode?: string,
  reason?: string,
): Promise<void> {
  if (transferStatus === 'success') {
    const { data } = await supabase
      .from('payouts')
      .update({ status: 'paid', paid_at: new Date().toISOString(), transfer_code: transferCode, failure_reason: null })
      .eq('reference', reference)
      .neq('status', 'paid')
      .select('vendor_id, amount, order_id, tranche');

    for (const payout of data ?? []) {
      await supabase.from('notifications').insert({
        user_id: payout.vendor_id,
        title: 'Payment sent',
        message: `₦${Number(payout.amount).toLocaleString()} for order #${payout.order_id.slice(0, 8)} (part ${payout.tranche} of 2) is on its way to your bank account.`,
        type: 'success',
        category: 'payment',
        action_url: '/vendor',
        metadata: { order_id: payout.order_id, tranche: payout.tranche },
      });
    }
    return;
  }

  if (transferStatus === 'failed' || transferStatus === 'reversed' || transferStatus === 'abandoned') {
    await supabase
      .from('payouts')
      .update({ status: 'failed', failure_reason: reason || `Transfer ${transferStatus}` })
      .eq('reference', reference)
      .neq('status', 'paid');
    return;
  }

  // pending / received / otp: still in flight.
  await supabase
    .from('payouts')
    .update({
      transfer_code: transferCode,
      failure_reason: transferStatus === 'otp'
        ? 'Paystack is asking for an OTP. Turn off OTP for transfers in Paystack settings.'
        : null,
    })
    .eq('reference', reference)
    .eq('status', 'processing');
}
