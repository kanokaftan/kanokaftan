import { supabase } from "@/integrations/supabase/client";

/** Where the ambassador code from a shared link is kept until the person applies to sell. */
const STORAGE_KEY = "kk_ambassador_ref";
/** Visits are counted once per code per browser session. */
const VISIT_KEY_PREFIX = "kk_ambassador_visit_";
/** A link opened more than this long ago no longer credits the ambassador. */
const REFERRAL_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Z0-9]{4,16}$/;

/** Same clean-up as the database: "amina-42 " -> "AMINA42". Null when it can't be a code. */
export function normalizeReferralCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

/** The public link an ambassador shares. */
export function ambassadorLink(code: string): string {
  return `${window.location.origin}/r/${code}`;
}

/** Remembers the code (newest link wins) and counts the visit once per session. */
export function rememberReferral(raw: string | null | undefined): string | null {
  const code = normalizeReferralCode(raw);
  if (!code) return null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, savedAt: Date.now() }));
  } catch (error) {
    console.warn("[referral] could not save the ambassador code", error);
  }
  let alreadyCounted = false;
  try {
    alreadyCounted = sessionStorage.getItem(VISIT_KEY_PREFIX + code) === "1";
    sessionStorage.setItem(VISIT_KEY_PREFIX + code, "1");
  } catch {
    // Private mode: count it; the guard is only there to avoid double counting.
  }
  if (!alreadyCounted) {
    supabase.rpc("record_ambassador_visit", { p_code: code }).then(({ error }) => {
      if (error) console.warn("[referral] could not count the link visit", error);
    });
  }
  return code;
}

/** The remembered code, if the link was opened in the last 30 days. */
export function storedReferral(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { code, savedAt } = JSON.parse(raw) as { code?: string; savedAt?: number };
    if (!code || !savedAt || Date.now() - savedAt > REFERRAL_LIFETIME_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return normalizeReferralCode(code);
  } catch {
    return null;
  }
}

export function clearReferral() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
}
