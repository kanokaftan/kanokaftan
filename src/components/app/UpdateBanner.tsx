import { useEffect, useState } from "react";
import { RefreshCw, X } from "lucide-react";
import { applyUpdate, onUpdateReady } from "@/lib/registerServiceWorker";

/**
 * "A new version is ready" bar. Shows once a new version has downloaded;
 * Refresh switches to it. Closing it hides the bar until the app is opened again.
 */
export function UpdateBanner() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => onUpdateReady(setReady), []);

  // Bring the bar back next time the app is opened, if the update is still waiting.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") setDismissed(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  if (!ready || dismissed) return null;

  const refresh = () => {
    setApplying(true);
    applyUpdate();
  };

  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] z-[150] flex justify-center px-4 animate-in slide-in-from-bottom-4 fade-in-0 duration-300 md:bottom-6"
    >
      <div className="pointer-events-auto flex w-full max-w-sm items-center gap-3 rounded-2xl border border-white/15 bg-neutral-900/90 py-2 pl-3.5 pr-2 text-white shadow-2xl backdrop-blur-xl">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10">
          <RefreshCw className={applying ? "h-4 w-4 animate-spin" : "h-4 w-4"} aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-tight">New version ready</p>
          <p className="text-[11px] leading-tight text-white/70">Refresh to get the latest Kano Kaftan</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          disabled={applying}
          className="shrink-0 rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-neutral-900 active:scale-95 disabled:opacity-70"
        >
          {applying ? "Updating…" : "Refresh"}
        </button>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Later"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white/70 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
