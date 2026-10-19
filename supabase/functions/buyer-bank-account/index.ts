import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json, paymentsNotConfigured } from "../_shared/cors.ts";
import { getCaller, serviceClient } from "../_shared/supabase.ts";
import { isPaystackNotConfigured, paystack } from "../_shared/paystack.ts";

// Buyers link a bank account in their own name. One bank account = one Kano Kaftan
// account, which stops people creating extra accounts for invite credit or first-buyer prices.
//
// actions:
//   list_banks                           -> Nigerian banks for the picker
//   verify { bank_code, account_number } -> Paystack looks up the name; it must match the buyer's name

interface Bank {
  name: string;
  code: string;
  active: boolean;
}

const NOT_CONFIGURED_MESSAGE =
  "Bank checks aren't switched on yet. The Kano Kaftan team has been notified. Please try again later.";

/** Lookups per buyer per hour (each one costs a Paystack bank check). */
const VERIFY_LIMIT_PER_HOUR = 6;
const HOUR_SECONDS = 60 * 60;

const BANK_CACHE_MS = 60 * 60 * 1000;
let bankCache: { at: number; banks: Bank[] } | null = null;

async function listBanks(): Promise<Bank[]> {
  if (bankCache && Date.now() - bankCache.at < BANK_CACHE_MS) return bankCache.banks;
  const banks = await paystack<Bank[]>('/bank?country=nigeria&currency=NGN&perPage=200');
  if (!banks.status) throw new Error(banks.message || 'Could not load banks');
  bankCache = { at: Date.now(), banks: banks.data.filter((b) => b.active) };
  return bankCache.banks;
}

const TEST_MODE_LIMIT = /test mode|daily limit|limit of \d+ live bank resolves/i;
const BANK_UNAVAILABLE = /timed? ?out|unavailable|try again later|service|gateway|connection/i;

async function resolveAccount(bankCode: string, accountNumber: string): Promise<string> {
  const resolved = await paystack<{ account_name: string }>(
    `/bank/resolve?account_number=${accountNumber}&bank_code=${encodeURIComponent(bankCode)}`,
  );
  if (resolved.status && resolved.data?.account_name) return resolved.data.account_name;

  console.error('[buyer-bank-account] bank check failed', { bankCode, paystack: resolved.message });
  const reason = resolved.message ?? '';
  if (TEST_MODE_LIMIT.test(reason)) {
    throw new Error("Bank checks are paused for today while Kano Kaftan payments are in test mode. Please try again later.");
  }
  if (BANK_UNAVAILABLE.test(reason)) {
    throw new Error("This bank isn't responding right now. Please try again in a few minutes.");
  }
  throw new Error("We couldn't find that account number at this bank. Please check both and try again.");
}

/** Keyed hash of bank + number: how "one bank account = one Kano Kaftan account" is checked. */
async function accountHash(bankCode: string, accountNumber: string): Promise<string> {
  const secret = Deno.env.get('BANK_HASH_SECRET') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${bankCode}:${accountNumber}`));
  return Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ success: false, error: 'Please sign in' }, 401);
    const supabase = serviceClient();

    const { action, bank_code, account_number } = await req.json();

    if (action === 'list_banks') {
      const banks = await listBanks();
      return json({ success: true, banks: banks.map((b) => ({ name: b.name, code: b.code })) });
    }

    if (action === 'verify') {
      if (typeof bank_code !== 'string' || !bank_code || typeof account_number !== 'string' || !/^\d{10}$/.test(account_number)) {
        return json({ success: false, error: 'Choose your bank and enter your 10-digit account number.' }, 400);
      }

      const { data: allowed, error: limitError } = await supabase.rpc('check_rate_limit', {
        p_key: `buyer-bank:${caller.id}`,
        p_limit: VERIFY_LIMIT_PER_HOUR,
        p_window_seconds: HOUR_SECONDS,
      });
      if (limitError) console.error('[buyer-bank-account] rate limit check failed', limitError.message);
      if (allowed === false) {
        return json({ success: false, error: 'Too many tries. Please wait an hour and try again.' }, 429);
      }

      const banks = await listBanks();
      const bank = banks.find((b) => b.code === bank_code);
      if (!bank) return json({ success: false, error: 'Please choose your bank from the list.' }, 400);

      const accountName = await resolveAccount(bank_code, account_number);
      const { data, error } = await supabase.rpc('save_buyer_bank_account', {
        p_user_id: caller.id,
        p_bank_code: bank_code,
        p_bank_name: bank.name,
        p_last4: account_number.slice(-4),
        p_hash: await accountHash(bank_code, account_number),
        p_account_name: accountName,
        // Admins can see it (e.g. to pay someone by hand); only the owner and admins can read it.
        p_account_number: account_number,
      });
      if (error) {
        console.error('[buyer-bank-account] save failed', error.message);
        throw new Error("Couldn't save your bank account. Please try again.");
      }
      const result = data as { ok: boolean; code?: string; message?: string; account_name?: string; bank_name?: string; last4?: string };
      if (!result.ok) return json({ success: false, code: result.code, error: result.message, account_name: result.account_name }, 400);
      return json({ success: true, account_name: result.account_name, bank_name: result.bank_name, last4: result.last4 });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (error: unknown) {
    if (isPaystackNotConfigured(error)) return paymentsNotConfigured(NOT_CONFIGURED_MESSAGE);
    const message = error instanceof Error ? error.message : 'Something went wrong';
    console.error('[buyer-bank-account] request failed:', message);
    return json({ success: false, error: message }, 400);
  }
});
