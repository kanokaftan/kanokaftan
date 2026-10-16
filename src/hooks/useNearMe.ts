import { useCallback, useState } from "react";

export type NearMeStatus = "idle" | "locating" | "ready" | "denied" | "unavailable";
export interface Position { lat: number; lng: number }
export interface LocateResult { position: Position | null; status: NearMeStatus }

const CACHE_KEY = "kk_near_me_position";
/** Reuse a position this recent instead of asking the phone again. */
const CACHE_MAX_AGE_MS = 10 * 60 * 1000;
const LOCATE_TIMEOUT_MS = 12000;
/** A rough fix is enough to sort shops by town; it is also much faster than GPS. */
const POSITION_OPTIONS: PositionOptions = { enableHighAccuracy: false, timeout: LOCATE_TIMEOUT_MS, maximumAge: CACHE_MAX_AGE_MS };

function cachedPosition(): Position | null {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { lat, lng, at } = JSON.parse(raw) as Position & { at: number };
    return Date.now() - at < CACHE_MAX_AGE_MS ? { lat, lng } : null;
  } catch {
    return null;
  }
}

/**
 * The shopper's position for "Near me". Asks only when `locate()` is called
 * (a tap), never on page load, and explains a refusal instead of failing quietly.
 */
export function useNearMe() {
  const [position, setPosition] = useState<Position | null>(() => cachedPosition());
  const [status, setStatus] = useState<NearMeStatus>(() => (cachedPosition() ? "ready" : "idle"));

  const locate = useCallback((): Promise<LocateResult> => {
    const cached = cachedPosition();
    if (cached) {
      setPosition(cached);
      setStatus("ready");
      return Promise.resolve({ position: cached, status: "ready" });
    }
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("unavailable");
      return Promise.resolve({ position: null, status: "unavailable" });
    }
    setStatus("locating");
    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          try {
            sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ...next, at: Date.now() }));
          } catch {
            // Private mode: we'll just ask again next time.
          }
          setPosition(next);
          setStatus("ready");
          resolve({ position: next, status: "ready" });
        },
        (error) => {
          console.warn("[near-me] could not get location", { code: error.code, message: error.message });
          const failed: NearMeStatus = error.code === error.PERMISSION_DENIED ? "denied" : "unavailable";
          setStatus(failed);
          resolve({ position: null, status: failed });
        },
        POSITION_OPTIONS,
      );
    });
  }, []);

  return { position, status, locate };
}
