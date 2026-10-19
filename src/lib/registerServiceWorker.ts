// Offline support and push notifications need the service worker. Some
// browsers refuse it (search-engine robots, in-app browsers, private mode);
// the site works fine without it, so a refusal is noted, not reported as a bug.
//
// Updates: we check for a new version whenever the app is opened or brought
// back. A new version downloads in the background and then waits; the app
// shows an "update ready" bar (UpdateBanner) and switches over when the person
// taps Refresh, so nobody is reloaded in the middle of checkout. Until then the
// old version keeps all its files, so pages never go missing.

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
let waitingWorker: ServiceWorker | null = null;

function setWaiting(worker: ServiceWorker | null) {
  waitingWorker = worker;
  listeners.forEach((listener) => listener(!!worker));
}

/** Subscribe to "a new version is downloaded and waiting". Returns an unsubscribe function. */
export function onUpdateReady(listener: UpdateListener): () => void {
  listeners.add(listener);
  listener(!!waitingWorker);
  return () => listeners.delete(listener);
}

/** Switch to the waiting version; the page reloads once it takes over. */
export function applyUpdate() {
  if (!waitingWorker) {
    window.location.reload();
    return;
  }
  waitingWorker.postMessage({ type: "SKIP_WAITING" });
}

/** Watches a registration for a new version that finished installing. */
function watchForWaitingWorker(registration: ServiceWorkerRegistration) {
  // Only an update counts: the very first install has nothing to replace.
  if (registration.waiting && navigator.serviceWorker.controller) setWaiting(registration.waiting);
  registration.addEventListener("updatefound", () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener("statechange", () => {
      if (installing.state === "installed" && navigator.serviceWorker.controller) setWaiting(installing);
    });
  });
}

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || import.meta.env.DEV) return;

  // A page that already had a service worker gets a new one only on an update.
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hadController) reloadOnceForUpdate();
  });

  window.addEventListener("load", () => {
    try {
      navigator.serviceWorker
        .register(SERVICE_WORKER_URL, { scope: "/" })
        .then((registration) => {
          watchForWaitingWorker(registration);
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
