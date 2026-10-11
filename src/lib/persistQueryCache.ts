import { dehydrate, hydrate, type Query, type QueryClient } from "@tanstack/react-query";

/**
 * Remembers the home page between visits: public catalogue data (products,
 * categories, shops, flash sales) is saved to this device and shown straight
 * away next time, then refreshed in the background. Nothing personal is saved.
 */

const STORAGE_KEY = "kk-query-cache";
/** Bump when the shape of cached data changes, so old copies are ignored. */
const CACHE_VERSION = 1;
/** Older copies are dropped rather than shown. */
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
/** Batch writes while lots of queries finish at once. */
const SAVE_DELAY_MS = 1000;
/** Stay well under the browser's storage limit. */
const MAX_BYTES = 1_500_000;

const PUBLIC_QUERY_ROOTS = new Set(["products", "categories", "featured-shops", "shops", "flash-sales"]);

interface SavedCache {
  version: number;
  savedAt: number;
  state: ReturnType<typeof dehydrate>;
}

function isPublicQuery(query: Query): boolean {
  const root = query.queryKey[0];
  return typeof root === "string" && PUBLIC_QUERY_ROOTS.has(root) && query.state.status === "success";
}

function restore(queryClient: QueryClient): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as SavedCache;
    if (saved.version !== CACHE_VERSION || Date.now() - saved.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    hydrate(queryClient, saved.state);
    // Show the saved copy now, but fetch fresh data as soon as each section mounts.
    for (const query of queryClient.getQueryCache().getAll()) {
      if (isPublicQuery(query)) query.invalidate();
    }
  } catch (error) {
    console.warn("[persistQueryCache] could not restore saved home page", error);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage blocked (private mode); nothing to clean up.
    }
  }
}

function save(queryClient: QueryClient): void {
  try {
    const state = dehydrate(queryClient, { shouldDehydrateQuery: isPublicQuery });
    const payload = JSON.stringify({ version: CACHE_VERSION, savedAt: Date.now(), state } satisfies SavedCache);
    if (payload.length > MAX_BYTES) return;
    localStorage.setItem(STORAGE_KEY, payload);
  } catch (error) {
    // Full or blocked storage just means no instant start next time.
    console.warn("[persistQueryCache] could not save home page", error);
  }
}

/** Restores the saved copy immediately and keeps it up to date. Returns an unsubscribe function. */
export function persistQueryCache(queryClient: QueryClient): () => void {
  restore(queryClient);
  let timer: number | undefined;
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== "updated" || !isPublicQuery(event.query)) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => save(queryClient), SAVE_DELAY_MS);
  });
  return () => {
    window.clearTimeout(timer);
    unsubscribe();
  };
}
