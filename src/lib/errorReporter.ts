import { supabase } from "@/integrations/supabase/client";

// Sends crashes and unexpected errors from people's phones to the admin
// "App errors" page (public.log_client_error groups and counts them).

/** The same error is only sent once per this many ms from one phone. */
const SAME_ERROR_GAP_MS = 60_000;
/** At most this many reports per page load (a crash loop can't flood the log). */
const MAX_REPORTS_PER_SESSION = 20;
const MAX_STACK_CHARS = 4000;

/** Browser noise that isn't a bug in the app. */
const IGNORED = [
  /ResizeObserver loop/i,
  /^Script error\.?$/i, // cross-origin script with no details
  /AbortError/i,
  /The user aborted a request/i,
  /Load failed$/i, // Safari: request cancelled when the app is closed
  /NetworkError when attempting to fetch/i,
  /Failed to fetch$/i,
  /webkit-masked-url/i,
  /extension:\/\//i,
  /serviceWorker\.register|ServiceWorkerContainer\.register|registerSW\.js/i, // browser refused offline support
];

/** Search-engine robots and testing tools run the site in odd browsers; their errors aren't customers'. */
const BOT_USER_AGENT = /bot\b|bot\/|crawler|spider|HeadlessChrome|Chrome-Lighthouse|PageSpeed|facebookexternalhit|bingpreview/i;

function isBot(): boolean {
  const ua = navigator.userAgent || "";
  // Google's renderer reports itself as just "Google".
  return BOT_USER_AGENT.test(ua) || ua === "Google" || navigator.webdriver === true;
}

const lastSent = new Map<string, number>();
let sentThisSession = 0;
let installed = false;

function describe(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) return { message: `${error.name}: ${error.message}`, stack: error.stack };
  if (typeof error === "string") return { message: error };
  try {
    return { message: JSON.stringify(error) };
  } catch {
    return { message: String(error) };
  }
}

/** Reports one error. Safe to call from anywhere; never throws. */
export function reportError(error: unknown, extra?: { componentStack?: string }) {
  try {
    const { message, stack } = describe(error);
    if (!message || IGNORED.some((re) => re.test(message) || (stack && re.test(stack)))) return;
    if (sentThisSession >= MAX_REPORTS_PER_SESSION) return;
    const now = Date.now();
    if (now - (lastSent.get(message) ?? 0) < SAME_ERROR_GAP_MS) return;
    lastSent.set(message, now);
    sentThisSession += 1;

    const fullStack = [stack, extra?.componentStack && `Component stack:${extra.componentStack}`].filter(Boolean).join("\n\n");
    supabase
      .rpc("log_client_error", {
        p_message: message,
        p_stack: fullStack.slice(0, MAX_STACK_CHARS) || undefined,
        p_page: window.location.href,
        p_user_agent: navigator.userAgent,
        p_release: __APP_RELEASE__,
      })
      .then(({ error: rpcError }) => {
        if (rpcError) console.warn("[errorReporter] could not send error report", rpcError);
      });
  } catch (reportFailure) {
    console.warn("[errorReporter] failed while reporting", reportFailure);
  }
}

/** Listens for uncaught errors and rejected promises (call once at start-up). */
export function installErrorReporter() {
  if (installed || typeof window === "undefined" || import.meta.env.DEV || isBot()) return;
  installed = true;
  window.addEventListener("error", (event) => reportError(event.error ?? event.message));
  window.addEventListener("unhandledrejection", (event) => reportError(event.reason));
}
