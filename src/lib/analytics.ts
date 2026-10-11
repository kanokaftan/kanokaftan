import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

/**
 * First-party analytics: what people visit, where they come from and how far
 * they get towards buying. Events are queued and sent in small batches to
 * public.track_events (admins see the results on Admin → Analytics).
 *
 * No names, emails or phone numbers are collected: just a random id per
 * device (visitor) and per visit (session).
 */

export type AnalyticsEvent =
  | "page_view"
  | "product_view"
  | "shop_view"
  | "add_to_cart"
  | "checkout_start"
  | "purchase"
  | "search"
  | "wishlist_add"
  | "share";

export interface EventDetails {
  path?: string;
  product_id?: string;
  vendor_id?: string;
  search?: string;
  value?: number;
}

const VISITOR_KEY = "kk_vid";
const SESSION_KEY = "kk_session";
const SENT_ONCE_KEY = "kk_sent_once";
/** A visit ends after this long without activity (industry standard). */
const SESSION_IDLE_MS = 30 * 60 * 1000;
/** Send queued events this often (and immediately when the app is hidden). */
const FLUSH_DELAY_MS = 4000;
/** Server accepts at most this many per call. */
const MAX_BATCH = 25;
const MAX_QUEUE = 200;

interface SessionInfo {
  id: string;
  lastSeen: number;
  source: string;
  referrer: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

/** Robots and automated tools would only add noise. */
const BOT_USER_AGENT = /bot\b|bot\/|crawler|spider|HeadlessChrome|Chrome-Lighthouse|PageSpeed|facebookexternalhit|bingpreview/i;

let enabled = true;
let queue: Record<string, unknown>[] = [];
let flushTimer: number | undefined;
let listenersInstalled = false;
let memoryVisitorId: string | null = null;
let memorySession: SessionInfo | null = null;

function randomId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
  }
}

function readStorage(storage: Storage | undefined, key: string): string | null {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorage(storage: Storage | undefined, key: string, value: string) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Private mode / storage full: ids live in memory for this page load.
  }
}

function isBot(): boolean {
  const ua = navigator.userAgent || "";
  return BOT_USER_AGENT.test(ua) || ua === "Google" || navigator.webdriver === true;
}

function visitorId(): string {
  const stored = readStorage(window.localStorage, VISITOR_KEY);
  if (stored) return stored;
  memoryVisitorId ??= randomId();
  writeStorage(window.localStorage, VISITOR_KEY, memoryVisitorId);
  return memoryVisitorId;
}

const SOCIAL_HOSTS: [RegExp, string][] = [
  [/(^|\.)google\./, "Google"],
  [/(^|\.)bing\.com$/, "Bing"],
  [/(^|\.)yahoo\./, "Yahoo"],
  [/(^|\.)duckduckgo\.com$/, "DuckDuckGo"],
  [/instagram\.com$/, "Instagram"],
  [/(facebook\.com|fb\.com|fb\.me)$/, "Facebook"],
  [/(whatsapp\.com|wa\.me)$/, "WhatsApp"],
  [/tiktok\.com$/, "TikTok"],
  [/(twitter\.com|^t\.co|x\.com)$/, "X (Twitter)"],
  [/(youtube\.com|youtu\.be)$/, "YouTube"],
  [/(snapchat\.com)$/, "Snapchat"],
  [/(linkedin\.com|lnkd\.in)$/, "LinkedIn"],
  [/(telegram\.org|t\.me)$/, "Telegram"],
  [/pinterest\./, "Pinterest"],
  [/(mail\.google\.com|outlook\.|mail\.yahoo\.)/, "Email"],
];

const UTM_SOURCE_NAMES: Record<string, string> = {
  ig: "Instagram", instagram: "Instagram", fb: "Facebook", facebook: "Facebook", whatsapp: "WhatsApp", wa: "WhatsApp",
  tiktok: "TikTok", twitter: "X (Twitter)", x: "X (Twitter)", google: "Google", youtube: "YouTube", email: "Email",
  newsletter: "Email", sms: "SMS", telegram: "Telegram", snapchat: "Snapchat",
};

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Where this visit came from, in plain words for the report. */
function detectSource(params: URLSearchParams, referrerHost: string | null): string {
  const utmSource = params.get("utm_source")?.toLowerCase();
  const utmMedium = params.get("utm_medium")?.toLowerCase() ?? "";
  if (params.get("gclid") || (utmSource === "google" && /cpc|paid|ads?/.test(utmMedium))) return "Google Ads";
  if (params.get("fbclid") && /paid|ads?|cpc/.test(utmMedium)) return "Meta Ads";
  if (utmSource) {
    const name = UTM_SOURCE_NAMES[utmSource] ?? titleCase(utmSource);
    return /cpc|paid|ads?/.test(utmMedium) ? `${name} Ads` : name;
  }
  if (params.get("fbclid")) return "Facebook";
  if (referrerHost) {
    const match = SOCIAL_HOSTS.find(([pattern]) => pattern.test(referrerHost));
    return match ? match[1] : "Other websites";
  }
  if (isStandalone()) return "Home-screen app";
  return "Direct";
}

function externalReferrerHost(): string | null {
  try {
    if (!document.referrer) return null;
    const host = new URL(document.referrer).hostname.replace(/^www\./, "");
    const ownHost = window.location.hostname.replace(/^www\./, "");
    return host && host !== ownHost ? host : null;
  } catch {
    return null;
  }
}

function startSession(): SessionInfo {
  const params = new URLSearchParams(window.location.search);
  const referrer = externalReferrerHost();
  return {
    id: randomId(),
    lastSeen: Date.now(),
    source: detectSource(params, referrer),
    referrer,
    utm_source: params.get("utm_source"),
    utm_medium: params.get("utm_medium"),
    utm_campaign: params.get("utm_campaign"),
  };
}

/** The current visit; a new one starts after 30 idle minutes or when arriving from a campaign link. */
function session(): SessionInfo {
  let current = memorySession;
  if (!current) {
    const raw = readStorage(window.sessionStorage, SESSION_KEY) ?? readStorage(window.localStorage, SESSION_KEY);
    try {
      current = raw ? (JSON.parse(raw) as SessionInfo) : null;
    } catch {
      current = null;
    }
  }
  const now = Date.now();
  const arrivedFromCampaign = new URLSearchParams(window.location.search).has("utm_source");
  if (!current || now - current.lastSeen > SESSION_IDLE_MS || (arrivedFromCampaign && !memorySession)) {
    current = startSession();
  }
  current.lastSeen = now;
  memorySession = current;
  // localStorage so a visit continues across tabs and when the home-screen app is reopened quickly.
  writeStorage(window.localStorage, SESSION_KEY, JSON.stringify(current));
  return current;
}

function isStandalone(): boolean {
  return window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function deviceInfo(): { device: string; os: string; browser: string } {
  const ua = navigator.userAgent;
  const isTablet = /iPad|Tablet|(Android(?!.*Mobile))/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const isMobile = !isTablet && /Mobi|iPhone|Android/i.test(ua);
  const device = isTablet ? "Tablet" : isMobile ? "Mobile" : "Desktop";

  const os = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
    ? "iOS"
    : /Android/.test(ua) ? "Android"
      : /Windows/.test(ua) ? "Windows"
        : /Mac OS X|Macintosh/.test(ua) ? "macOS"
          : /CrOS/.test(ua) ? "ChromeOS"
            : /Linux/.test(ua) ? "Linux" : "Other";

  const browser = /Instagram/.test(ua) ? "Instagram app"
    : /FBAN|FBAV|FB_IAB/.test(ua) ? "Facebook app"
      : /TikTok|musical_ly|BytedanceWebview/.test(ua) ? "TikTok app"
        : /WhatsApp/.test(ua) ? "WhatsApp"
          : /SamsungBrowser/.test(ua) ? "Samsung Internet"
            : /OPR\/|Opera|OPiOS/.test(ua) ? "Opera"
              : /Edg\//.test(ua) ? "Edge"
                : /Firefox|FxiOS/.test(ua) ? "Firefox"
                  : /CriOS|Chrome\//.test(ua) ? "Chrome"
                    : /Safari/.test(ua) ? "Safari" : "Other";

  return { device, os, browser };
}

async function sendBatch(batch: Record<string, unknown>[]) {
  const { error } = await supabase.rpc("track_events", { p_events: batch as unknown as Json });
  if (error) console.warn("[analytics] could not send events", error.message);
}

/** Sends everything queued. Safe to call any time. */
export function flushAnalytics() {
  window.clearTimeout(flushTimer);
  flushTimer = undefined;
  while (queue.length) {
    const batch = queue.splice(0, MAX_BATCH);
    sendBatch(batch).catch((error) => console.warn("[analytics] send failed", error));
  }
}

function scheduleFlush() {
  if (flushTimer === undefined) flushTimer = window.setTimeout(flushAnalytics, FLUSH_DELAY_MS);
}

function installListeners() {
  if (listenersInstalled) return;
  listenersInstalled = true;
  // Leaving or backgrounding the app: send now so the last pages aren't lost.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flushAnalytics();
  });
  window.addEventListener("pagehide", flushAnalytics);
}

/** Turn tracking off (admins) or back on. */
export function setAnalyticsEnabled(on: boolean) {
  enabled = on;
  if (!on) queue = [];
}

/** Records one event. Never throws. */
export function track(event: AnalyticsEvent, details: EventDetails = {}) {
  try {
    if (!enabled || typeof window === "undefined" || import.meta.env.DEV || isBot()) return;
    installListeners();
    const visit = session();
    queue.push({
      event,
      visitor_id: visitorId(),
      session_id: visit.id,
      path: details.path ?? window.location.pathname,
      source: visit.source,
      referrer: visit.referrer,
      utm_source: visit.utm_source,
      utm_medium: visit.utm_medium,
      utm_campaign: visit.utm_campaign,
      ...deviceInfo(),
      standalone: isStandalone(),
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      product_id: details.product_id,
      vendor_id: details.vendor_id,
      search: details.search,
      value: details.value !== undefined ? Number(details.value).toFixed(2) : undefined,
    });
    if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
    if (queue.length >= MAX_BATCH) flushAnalytics();
    else scheduleFlush();
  } catch (error) {
    console.warn("[analytics] could not record event", error);
  }
}

/** Records an event only once per device for the given key (e.g. one purchase per order). */
export function trackOnce(key: string, event: AnalyticsEvent, details: EventDetails = {}) {
  const sent = new Set((readStorage(window.localStorage, SENT_ONCE_KEY) ?? "").split(",").filter(Boolean));
  if (sent.has(key)) return;
  sent.add(key);
  // Keep the list short; old orders won't be confirmed again.
  writeStorage(window.localStorage, SENT_ONCE_KEY, [...sent].slice(-50).join(","));
  track(event, details);
}
