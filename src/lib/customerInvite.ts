// The invite code a visitor arrived with, kept on this phone until they sign up.

const STORAGE_KEY = "kk_customer_invite";
/** An invite link keeps working this long after it was opened. */
const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Z0-9]{4,12}$/;

/** Uppercased code if it looks like one of ours, otherwise null. */
export function normaliseInviteCode(raw: string | null | undefined): string | null {
  const code = (raw ?? "").trim().toUpperCase();
  return CODE_PATTERN.test(code) ? code : null;
}

export function saveInviteCode(raw: string | null | undefined): string | null {
  const code = normaliseInviteCode(raw);
  if (!code) return null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ code, savedAt: Date.now() }));
  } catch {
    // Storage blocked (private mode): the invite still works if they sign up in this visit via the URL.
  }
  return code;
}

export function getSavedInviteCode(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const { code, savedAt } = JSON.parse(raw) as { code?: string; savedAt?: number };
    if (!code || !savedAt || Date.now() - savedAt > INVITE_TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return normaliseInviteCode(code);
  } catch {
    return null;
  }
}

export function clearSavedInviteCode() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nothing saved
  }
}

/** The link customers share. */
export function inviteLink(code: string): string {
  return `${window.location.origin}/invite/${code}`;
}
