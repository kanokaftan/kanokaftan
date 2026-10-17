import { serviceClient } from "./supabase.ts";

/** The caller's IP as seen by the Supabase edge (first hop of x-forwarded-for). */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || req.headers.get('cf-connecting-ip') || req.headers.get('x-real-ip') || 'unknown';
}

/**
 * True when this caller went over `limit` requests in the current window.
 * Fails open (allows the request) if the counter itself can't be reached, so
 * a database hiccup never blocks checkout.
 */
export async function isRateLimited(req: Request, name: string, limit: number, windowSeconds: number): Promise<boolean> {
  try {
    const { data, error } = await serviceClient().rpc('check_rate_limit', {
      p_key: `${name}:${clientIp(req)}`,
      p_limit: limit,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error(`[rate-limit] ${name} check failed`, error.message);
      return false;
    }
    return data === false;
  } catch (error) {
    console.error(`[rate-limit] ${name} check threw`, error);
    return false;
  }
}
