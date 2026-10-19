// Offline support and push notifications need the service worker. Some
// browsers refuse it (search-engine robots, in-app browsers, private mode);
// the site works fine without it, so a refusal is noted, not reported as a bug.
//
// Updates: we check for a new version whenever the app is opened or brought
// back. A new version takes over as soon as it has downloaded (it never waits,
// so an older copy of the app can't get stuck). If the app is in the
// background at that moment it reloads quietly; if someone is using it, an
// "update ready" bar (UpdateBanner) offers Refresh instead, so nobody is
// reloaded in the middle of checkout. Pages the old copy can no longer find
// reload once by themselves (lazyPage).

const SERVICE_WORKER_URL = "/sw.js";
/** Also check while the app stays open. */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000;
/** Guards against a reload loop if something goes wrong. */
const RELOADED_FOR_UPDATE_KEY = "kk_sw_reloaded_at";
const MIN_MS_BETWEEN_UPDATE_RELOADS = 60 * 1000;

function reloadOnceForUpdate() {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_FOR_UPDATE_KEY) ?? 0);
    if (Date.now() - last < MIN_MS_BETWEEN_UPDATE_RELOADS) return;
    sessionStorage.setItem(RELOADED_FOR_UPDATE_KEY, String(Date.now()));
  } catch {
    // Storage blocked (private mode): reload anyway, the guard is only a safety net.
  }
  window.location.reload();
}

type UpdateListener = (ready: boolean) => void;
const listeners = new Set<UpdateListener>();
let updateReady = false;

function markUpdateReady() {
  updateReady = true;
  listeners.forEach((listener) => listener(true));
}

/** Subscribe to "a new version has taken over; refresh to use it". Returns an unsubscribe function. */
export function onUpdateReady(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(updateReady);
  return () => listeners.delete(listener);
}

/** Load the new version. */
export function applyUpdate() {
  window.location.reload();
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || import.meta.env.DEV) return;

  // A page that already had a service worker gets a new one only on an update.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) return;
    // Not on screen: nobody is interrupted, so just load the new version.
    if (document.visibilityState === "hidden") reloadOnceForUpdate();
    else markUpdateReady();
  });
  // Updated while someone was using it, then they left and came back: refresh quietly before they start again.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden" && updateReady) reloadOnceForUpdate();
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
