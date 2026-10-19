import { lazy, type ComponentType } from "react";

// After an update goes live, an app that was left open still points at the old
// page files, which the new version replaced. Loading one then fails
// ("Importing a module script failed" on iPhone, "Failed to fetch dynamically
// imported module" on Android). Reloading once picks up the new version.

const RELOADED_FOR_UPDATE_KEY = "kk_chunk_reloaded_at";
/** If the page still can't load this soon after a reload, it's a real problem: show it. */
const MIN_MS_BETWEEN_RELOADS = 60 * 1000;

/** Reloads the app for a new version, at most once a minute. Returns false when it just did. */
function reloadForNewVersion(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_FOR_UPDATE_KEY) ?? 0);
    if (Date.now() - last < MIN_MS_BETWEEN_RELOADS) return false;
    sessionStorage.setItem(RELOADED_FOR_UPDATE_KEY, String(Date.now()));
  } catch {
    // Storage blocked (private mode): reload anyway; the browser's own reload keeps this from looping fast.
  }
  window.location.reload();
  return true;
}

/**
 * Like React.lazy for a route page, but a page file that can't be loaded
 * reloads the app instead of crashing. While the reload happens the loading
 * screen stays up (the promise never settles), so nothing half-broken shows.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- same constraint as React.lazy
export function lazyPage<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  return lazy(async () => {
    try {
      return await load();
    } catch (error) {
      console.warn("[lazyPage] page file failed to load; reloading for the new version", error);
      if (reloadForNewVersion()) return new Promise<{ default: T }>(() => {});
      throw error;
    }
  });
}
