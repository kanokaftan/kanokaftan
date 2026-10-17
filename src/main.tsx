import { createRoot } from "react-dom/client";
import "@fontsource/playfair-display/400.css";
import "@fontsource/playfair-display/700.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "./i18n/index";
import App from "./App.tsx";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import { installErrorReporter } from "./lib/errorReporter";
import { registerServiceWorker } from "./lib/registerServiceWorker";
import "./index.css";

installErrorReporter();
registerServiceWorker();

// After an update, an app left open may ask for a page file the new version replaced.
// Reload once to pick up the new version instead of failing.
const RELOADED_FOR_CHUNK_KEY = "kk_chunk_reloaded_at";
const MIN_MS_BETWEEN_CHUNK_RELOADS = 60 * 1000;
window.addEventListener("vite:preloadError", (event) => {
  try {
    const last = Number(sessionStorage.getItem(RELOADED_FOR_CHUNK_KEY) ?? 0);
    if (Date.now() - last < MIN_MS_BETWEEN_CHUNK_RELOADS) return;
    sessionStorage.setItem(RELOADED_FOR_CHUNK_KEY, String(Date.now()));
  } catch {
    // Storage blocked: still reload once; the browser keeps us from looping fast.
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById("root")!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
