// Offline support and push notifications need the service worker. Some
// browsers refuse it (search-engine robots, in-app browsers, private mode);
// the site works fine without it, so a refusal is noted, not reported as a bug.
//
// Updates: we check for a new version when the app opens, when it's brought
// back, and every few minutes. A new version takes over as soon as it has
// downloaded and the app reloads into it by itself, with nothing to tap.
// It waits only while a reload would hurt: paying (checkout, or a payment
// being confirmed), filling in a product form, or during a call. Then it
// reloads as soon as the person moves on. Pages an old copy can no longer
// find reload once by themselves (lazyPage).

const SERVICE_WORKER_URL = "/sw.js";
/** Also check while the app stays open. */
const UPDATE_CHECK_INTERVAL_MS = 5 * 60 * 1000;
/** While an update waits for a good moment, look again this often. */
const PENDING_RETRY_MS = 15 * 1000;
/** Pages where a reload would lose a payment or typed-in work. */
const NO_RELOAD_PATHS = [/^\/checkout/, /^\/vendor\/(promote|verification)/, /^\/vendor\/products\/[^/]+/, /^\/admin\/products\/.+/];
/** Query parameters present while a returning Paystack payment is being confirmed. */
const PAYMENT_RETURN_PARAMS = ["reference", "trxref", "verify"];
/** Guards against a reload loop if something goes wrong. */
const RELOADED_FOR_UPDATE_KEY = "kk_sw_reloaded_at";
const MIN_MS_BETWEEN_UPDATE_RELOADS = 60 * 1000;

/** How long until another automatic reload is allowed (0 = now). */
function msUntilReloadAllowed(): number {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_FOR_UPDATE_KEY) ?? 0);
    return Math.max(0, last + MIN_MS_BETWEEN_UPDATE_RELOADS - Date.now());
  } catch {
    return 0; // Storage blocked (private mode): the guard is only a safety net.
  }
}

function reloadForUpdate() {
  try {
    sessionStorage.setItem(RELOADED_FOR_UPDATE_KEY, String(Date.now()));
  } catch {
    // See msUntilReloadAllowed.
  }
  window.location.reload();
}

/** Things that must not be cut off by a reload (e.g. a call in progress). */
const blockers = new Set<string>();
let pendingReload = false;
let retryTimer: number | null = null;

/** Mark something that a reload would interrupt (true) or that has finished (false). */
export function setUpdateBlocker(key: string, active: boolean) {
  if (active) blockers.add(key);
  else blockers.delete(key);
  if (!active) retryPendingUpdate();
}

function onProtectedPage(): boolean {
  const { pathname, search } = window.location;
  const params = new URLSearchParams(search);
  return NO_RELOAD_PATHS.some((pattern) => pattern.test(pathname)) || PAYMENT_RETURN_PARAMS.some((key) => params.has(key));
}

function canReloadNow(): boolean {
  if (blockers.size > 0) return false;
  return !onProtectedPage();
}

/** Reload into the new version if this is a good moment; otherwise try again soon. */
export function retryPendingUpdate() {
  if (!pendingReload) return;
  const wait = msUntilReloadAllowed();
  if (wait === 0 && canReloadNow()) {
    reloadForUpdate();
    return;
  }
  if (retryTimer === null) {
    retryTimer = window.setTimeout(() => {
      retryTimer = null;
      retryPendingUpdate();
    }, Math.max(wait, PENDING_RETRY_MS));
  }
}

function newVersionTookOver() {
  pendingReload = true;
  retryPendingUpdate();
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || import.meta.env.DEV) return;

  // A page that already had a service worker gets a new one only on an update.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) newVersionTookOver();
  });
  // Going to the background is a good moment too (unless a call is still on).
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") retryPendingUpdate();
  });

  window.addEventListener("load", () => {
    try {
      navigator.serviceWorker
        .register(SERVICE_WORKER_URL, { scope: "/" })
        .then((registration) => {
          const checkForUpdate = () =>
            registration.update().catch((error: unknown) => console.warn("[sw] update check failed", error));
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") checkForUpdate();
          });
          window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
        })
        .catch((error: unknown) => {
          console.warn("[sw] this browser declined offline support; the site still works", error);
        });
    } catch (error) {
      console.warn("[sw] could not register the service worker", error);
    }
  });
}
