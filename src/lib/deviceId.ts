import { supabase } from "@/integrations/supabase/client";

// A random id kept on this phone (no personal data). The server notes which
// accounts sign in on the same phone, so admins can spot someone running
// several accounts. Clearing site data makes a new id; that's fine.

const DEVICE_ID_KEY = "kk_device_id";
const RECORDED_KEY_PREFIX = "kk_device_recorded_";

function getDeviceId(): string | null {
  try {
    let id = localStorage.getItem(DEVICE_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, id);
    }
    return id;
  } catch {
    return null; // Storage blocked (private mode): nothing to record.
  }
}

/** Records this phone for the signed-in account, once per app session. */
export async function recordDeviceOnce(userId: string) {
  const deviceId = getDeviceId();
  if (!deviceId) return;
  const recordedKey = RECORDED_KEY_PREFIX + userId;
  try {
    if (sessionStorage.getItem(recordedKey)) return;
  } catch {
    // Without session storage we just record again; the server ignores repeats.
  }
  const { error } = await supabase.rpc("record_my_device" as never, { p_device_id: deviceId } as never);
  if (error) {
    console.warn("[device] could not record this device", error);
    return;
  }
  try {
    sessionStorage.setItem(recordedKey, "1");
  } catch {
    // Ignore: see above.
  }
}
