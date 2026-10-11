// Offline support and push notifications need the service worker. Some
// browsers refuse it (search-engine robots, in-app browsers, private mode);
// the site works fine without it, so a refusal is noted, not reported as a bug.

const SERVICE_WORKER_URL = "/sw.js";

export function registerServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || import.meta.env.DEV) return;
  window.addEventListener("load", () => {
    try {
      navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: "/" }).catch((error: unknown) => {
        console.warn("[sw] this browser declined offline support; the site still works", error);
      });
    } catch (error) {
      console.warn("[sw] could not register the service worker", error);
    }
  });
}
