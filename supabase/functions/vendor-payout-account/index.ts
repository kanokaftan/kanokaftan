import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, paymentsNotConfigured } from "../_shared/cors.ts";
import { getCaller, serviceClient } from "../_shared/supabase.ts";
import { isPaystackNotConfigured, paystack } from "../_shared/paystack.ts";
import { processPendingPayouts } from "../_shared/payouts.ts";

interface Bank {
  name: string;
  code: string;
  active: boolean;
}

// actions:
//   list_banks                          -> Nigerian banks for the picker
//   resolve { bank_code, account_number } -> the account holder's name (shown before saving)
//   save { bank_code, account_number }  -> verify with Paystack, save, send waiting payouts

const NOT_CONFIGURED_MESSAGE =
  "Bank payouts aren't switched on yet. The Kano Kaftan team has been notified. Please try again later.";

/** Banks change rarely; keep Paystack's list for an hour per function instance. */
const BANK_CACHE_MS = 60 * 60 * 1000;
let bankCache: { at: number; banks: Bank[] } | null = null;

async function listBanks(): Promise<Bank[]> {
  if (bankCache && Date.now() - bankCache.at < BANK_CACHE_MS) return bankCache.banks;
  const banks = await paystack<Bank[]>('/bank?country=nigeria&currency=NGN&perPage=200');
  if (!banks.status) throw new Error(banks.message || 'Could not load banks');
  bankCache = { at: Date.now(), banks: banks.data.filter((b) => b.active) };
  return bankCache.banks;
}

async function resolveAccount(bankCode: string, accountNumber: string): Promise<string> {
  const resolved = await paystack<{ account_name: string }>(
    `/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`,
  );
  if (!resolved.status || !resolved.data?.account_name) {
    throw new Error("We couldn't find that account number at this bank. Please check both and try again.");
  }
  return resolved.data.account_name;
}

function validate(bankCode: unknown, accountNumber: unknown): { bankCode: string; accountNumber: string } {
  if (typeof bankCode !== 'string' || !bankCode || typeof accountNumber !== 'string' || !/^\d{10}$/.test(accountNumber)) {
    throw new Error('Choose a bank and enter a 10-digit account number');
  }
  return { bankCode, accountNumber };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ success: false, error: 'Please sign in' }, 401);

    const supabase = serviceClient();
    const { data: isVendor } = await supabase.rpc('has_role', { _user_id: caller.id, _role: 'vendor' });
    if (!isVendor) return json({ success: false, error: 'Vendors only' }, 403);

    const { action, bank_code, account_number } = await req.json();

    if (action === 'list_banks') {
      const banks = await listBanks();
      return json({ success: true, banks: banks.map((b) => ({ name: b.name, code: b.code })) });
    }

    if (action === 'resolve') {
      const input = validate(bank_code, account_number);
      const accountName = await resolveAccount(input.bankCode, input.accountNumber);
      return json({ success: true, account_name: accountName });
    }

    if (action === 'save') {
      const input = validate(bank_code, account_number);

      const banks = await listBanks();
      const bank = banks.find((b) => b.code === input.bankCode);
      if (!bank) throw new Error('That bank is not supported for payouts. Please choose another.');

      const accountName = await resolveAccount(input.bankCode, input.accountNumber);

      const recipient = await paystack<{ recipient_code: string }>('/transferrecipient', {
        method: 'POST',
        body: JSON.stringify({
          type: 'nuban',
          name: accountName,
          account_number,
          bank_code,
          currency: 'NGN',
          metadata: { vendor_id: caller.id },
        }),
      });
      if (!recipient.status) throw new Error(recipient.message || 'Could not register the account with Paystack');

      const { error } = await supabase.from('vendor_payout_accounts').upsert({
        vendor_id: caller.id,
        bank_code,
        bank_name: bank.name,
        account_number,
        account_name: accountName,
        recipient_code: recipient.data.recipient_code,
      });
      if (error) throw error;

      // Anything that was waiting for this account can go out now.
      try {
        await processPendingPayouts(supabase, { vendorId: caller.id });
      } catch (payoutError) {
        console.error('Payout after saving account failed; scheduled run will retry:', payoutError);
      }

      return json({ success: true, account_name: accountName, bank_name: bank.name });
    }

    throw new Error('Unknown action');
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    if (isPaystackNotConfigured(error)) return paymentsNotConfigured(NOT_CONFIGURED_MESSAGE);
    console.error('[vendor-payout-account] request failed:', message);
    return json({ success: false, error: message }, 400);
  }
});
