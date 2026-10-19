import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { getCaller, serviceClient } from "../_shared/supabase.ts";
import { generateVapidKeys, sendPush, type VapidKeys } from "./webpush.ts";

// Phone push notifications.
//   public_key                -> VAPID public key browsers subscribe with (keys are created on first call)
//   test                      -> sends the signed-in caller a test notification
//   send { notification_id }  -> called by the notifications trigger (x-push-secret header) to deliver one row
// The private key never leaves the database/function.

const PUSH_SUBJECT = 'mailto:support@kanokaftan.shop';
const PUSH_TTL_SECONDS = 24 * 60 * 60;
/** An incoming call is useless once it stops ringing. */
const CALL_PUSH_TTL_SECONDS = 60;
const CALL_CATEGORY = 'call';
/** iPhones can't ring a closed web app, so a ringing call re-alerts every few seconds instead. */
const CALL_REPEAT_SECONDS = 6;
/** Same as RING_SECONDS in the app: after this the call is logged as missed. */
const CALL_RING_SECONDS = 45;
const GONE_STATUSES = new Set([404, 410]);
const ORDER_CATEGORIES = new Set(['order', 'payment']);
const PROMO_CATEGORIES = new Set(['promotion']);
const MAX_TITLE_LENGTH = 80;
const MAX_BODY_LENGTH = 200;

type Db = ReturnType<typeof serviceClient>;

// Supabase keeps a function alive for work handed to waitUntil after the response is sent.
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

interface PushConfig {
  vapid_public_key: string | null;
  vapid_private_key: string | null;
  hook_secret: string;
}

async function loadConfig(db: Db): Promise<PushConfig> {
  const { data, error } = await db
    .from('push_config')
    .select('vapid_public_key, vapid_private_key, hook_secret')
    .eq('id', 1)
    .single();
  if (error || !data) throw new Error(`push_config missing: ${error?.message ?? 'no row'}`);
  return data as PushConfig;
}

/** Returns the VAPID keys, creating and storing them the first time. */
async function ensureKeys(db: Db): Promise<VapidKeys> {
  let config = await loadConfig(db);
  if (!config.vapid_public_key || !config.vapid_private_key) {
    const keys = await generateVapidKeys();
    // Only fills empty keys, so two first calls at once cannot overwrite each other.
    const { error } = await db
      .from('push_config')
      .update({
        vapid_public_key: keys.publicKey,
        vapid_private_key: JSON.stringify(keys.privateJwk),
        function_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/push`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1)
      .is('vapid_private_key', null);
    if (error) throw new Error(`Could not store push keys: ${error.message}`);
    config = await loadConfig(db);
  }
  return { publicKey: config.vapid_public_key!, privateJwk: JSON.parse(config.vapid_private_key!) };
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function wantsPush(category: string, prefs: { notification_push: boolean | null; notification_orders: boolean | null; notification_promotions: boolean | null } | null): boolean {
  if (!prefs) return true;
  if (prefs.notification_push === false) return false;
  if (ORDER_CATEGORIES.has(category) && prefs.notification_orders === false) return false;
  if (PROMO_CATEGORIES.has(category) && prefs.notification_promotions !== true) return false;
  return true;
}

async function deliverNotification(db: Db, notificationId: string): Promise<{ sent: number; removed: number; skipped?: string }> {
  const { data: notification, error } = await db
    .from('notifications')
    .select('id, user_id, title, message, category, action_url, metadata')
    .eq('id', notificationId)
    .maybeSingle();
  if (error) throw new Error(`Could not load notification: ${error.message}`);
  if (!notification) return { sent: 0, removed: 0, skipped: 'not found' };

  const { data: prefs } = await db
    .from('profiles')
    .select('notification_push, notification_orders, notification_promotions')
    .eq('id', notification.user_id)
    .maybeSingle();
  if (!wantsPush(notification.category, prefs)) return { sent: 0, removed: 0, skipped: 'turned off by user' };

  const { data: subscriptions, error: subError } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', notification.user_id);
  if (subError) throw new Error(`Could not load subscriptions: ${subError.message}`);
  if (!subscriptions?.length) return { sent: 0, removed: 0, skipped: 'no devices' };

  const keys = await ensureKeys(db);
  const callId = (notification.metadata as { call_id?: string } | null)?.call_id ?? null;
  const payload = {
    title: String(notification.title).slice(0, MAX_TITLE_LENGTH),
    body: String(notification.message).slice(0, MAX_BODY_LENGTH),
    url: notification.action_url || '/',
    tag: notification.id,
    category: notification.category,
    // Lets the phone show Answer / Decline buttons for an incoming call.
    callId,
  };
  const isCall = notification.category === CALL_CATEGORY;
  const result = await sendToSubscriptions(db, subscriptions, payload, keys, isCall);

  if (isCall && callId && result.sent > 0) {
    const repeat = repeatWhileRinging(db, subscriptions, payload, keys, callId, notification.user_id)
      .catch((e) => console.error('call re-alert failed', { callId, error: e instanceof Error ? e.message : String(e) }));
    if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(repeat);
  }
  return result;
}

type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };
type Payload = Record<string, unknown>;

async function sendToSubscriptions(db: Db, subscriptions: Subscription[], payload: Payload, keys: VapidKeys, isCall: boolean) {
  const urgency = isCall || ORDER_CATEGORIES.has(String(payload.category)) ? 'high' : 'normal';
  const ttlSeconds = isCall ? CALL_PUSH_TTL_SECONDS : PUSH_TTL_SECONDS;

  let sent = 0;
  const gone: string[] = [];
  const delivered: string[] = [];
  await Promise.all(subscriptions.map(async (sub) => {
    try {
      const result = await sendPush(sub, payload, keys, { subject: PUSH_SUBJECT, ttlSeconds, urgency });
      if (result.status < 300) {
        sent++;
        delivered.push(sub.id);
      } else if (GONE_STATUSES.has(result.status)) {
        gone.push(sub.id);
      } else {
        console.error('push rejected', { status: result.status, body: result.body, host: new URL(sub.endpoint).host });
      }
    } catch (e) {
      console.error('push failed', { error: e instanceof Error ? e.message : String(e), host: new URL(sub.endpoint).host });
    }
  }));

  if (gone.length) {
    const { error: delError } = await db.from('push_subscriptions').delete().in('id', gone);
    if (delError) console.error('could not remove expired subscriptions', delError.message);
  }
  if (delivered.length) {
    const { error: updError } = await db.from('push_subscriptions').update({ last_used_at: new Date().toISOString() }).in('id', delivered);
    if (updError) console.error('could not update last_used_at', updError.message);
  }
  return { sent, removed: gone.length };
}

/**
 * Web apps can't ring like a phone call when they're closed (iPhone allows only
 * notifications), so while the call is still ringing the phone is alerted again
 * every few seconds. Stops as soon as it's answered, declined, cancelled or missed,
 * or once this person has the ringing screen open in the app (calls.seen_by).
 */
async function repeatWhileRinging(db: Db, subscriptions: Subscription[], payload: Payload, keys: VapidKeys, callId: string, userId: string) {
  for (let attempt = 1; attempt * CALL_REPEAT_SECONDS < CALL_RING_SECONDS; attempt++) {
    await sleep(CALL_REPEAT_SECONDS * 1000);
    const { data: call, error } = await db.from('calls').select('status, created_at, seen_by').eq('id', callId).maybeSingle();
    if (error) throw new Error(`Could not check call: ${error.message}`);
    if (!call || call.status !== 'ringing') return;
    if ((call.seen_by as string[] | null)?.includes(userId)) return;
    if (Date.now() - new Date(call.created_at).getTime() > CALL_RING_SECONDS * 1000) return;
    // A new tag makes the phone sound again; the service worker clears the earlier alert for this call.
    const { sent } = await sendToSubscriptions(db, subscriptions, { ...payload, tag: `${payload.tag}-${attempt}` }, keys, true);
    if (!sent) return;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const action = body.action ?? new URL(req.url).searchParams.get('action') ?? 'public_key';
    const db = serviceClient();

    if (action === 'public_key') {
      const keys = await ensureKeys(db);
      return json({ success: true, publicKey: keys.publicKey });
    }

    if (action === 'send') {
      const config = await loadConfig(db);
      const secret = req.headers.get('x-push-secret') ?? '';
      if (!secret || !safeEqual(secret, config.hook_secret)) return json({ success: false, error: 'Forbidden' }, 403);
      if (typeof body.notification_id !== 'string') return json({ success: false, error: 'notification_id required' }, 400);
      const result = await deliverNotification(db, body.notification_id);
      return json({ success: true, ...result });
    }

    if (action === 'test') {
      const caller = await getCaller(req);
      if (!caller) return json({ success: false, error: 'Please sign in' }, 401);
      await ensureKeys(db); // the trigger only pushes once keys exist
      const { count, error: countError } = await db
        .from('push_subscriptions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', caller.id);
      if (countError) throw new Error(`Could not count devices: ${countError.message}`);
      if (!count) return json({ success: false, error: 'This account has no phone turned on for notifications yet' }, 400);
      // The notifications trigger delivers it, exactly like a real notification.
      const { error } = await db.from('notifications').insert({
        user_id: caller.id,
        title: 'Notifications are on',
        message: 'You will get order updates, messages and new arrivals from Kano Kaftan here.',
        type: 'info',
        category: 'system',
      });
      if (error) throw new Error(`Could not create test notification: ${error.message}`);
      return json({ success: true, devices: count });
    }

    return json({ success: false, error: 'Unknown action' }, 400);
  } catch (e) {
    console.error('push function error', e);
    return json({ success: false, error: e instanceof Error ? e.message : 'Something went wrong' }, 500);
  }
});
