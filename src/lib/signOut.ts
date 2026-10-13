import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { forgetThisDevice } from "@/lib/push";

/** Clean-up steps (notifications, admin lock) may not hold up signing out longer than this. */
const CLEANUP_TIMEOUT_MS = 3000;
/** The sign-out request itself; after this we sign out locally anyway. */
const SIGN_OUT_TIMEOUT_MS = 4000;

/** Resolves after `ms` even if `task` never settles, so a hung request can't block signing out. */
function withTimeout(task: Promise<unknown>, ms: number, label: string): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      console.warn(`[signOut] ${label} took too long; continuing`);
      resolve();
    }, ms);
  });
  const settled = task.then(
    () => undefined,
    (error) => console.error(`[signOut] ${label} failed; continuing`, error),
  );
  return Promise.race([settled, timeout]).finally(() => clearTimeout(timer));
}

/** Removes the saved sign-in from this browser, in case the normal sign-out could not. */
function clearSavedSession() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("sb-") && (key.endsWith("-auth-token") || key.endsWith("-auth-token-code-verifier"))) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error("[signOut] could not clear the saved sign-in", error);
  }
}

/**
 * Signs out on this device only, and always finishes: slow or failing network
 * calls are skipped after a few seconds, the saved sign-in is removed either
 * way, and the page reloads at `redirectTo` so no signed-in screens linger.
 */
export async function signOutThisDevice({ redirectTo = "/", lockAdmin = false }: { redirectTo?: string; lockAdmin?: boolean } = {}) {
  toast.loading("Signing out…");
  // Both need the current sign-in, so they run before it is removed.
  const cleanup: Promise<void>[] = [withTimeout(forgetThisDevice(), CLEANUP_TIMEOUT_MS, "turning off notifications")];
  if (lockAdmin) {
    cleanup.push(withTimeout(supabase.functions.invoke("admin-unlock", { body: { action: "lock" } }), CLEANUP_TIMEOUT_MS, "locking the admin area"));
  }
  await Promise.all(cleanup);

  await withTimeout(
    supabase.auth.signOut({ scope: "local" }).then(({ error }) => {
      if (error) throw error;
    }),
    SIGN_OUT_TIMEOUT_MS,
    "signing out",
  );
  clearSavedSession();
  window.location.replace(redirectTo);
}
