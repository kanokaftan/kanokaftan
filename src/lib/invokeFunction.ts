import { supabase } from "@/integrations/supabase/client";

/** Shown when the device's sign-in was ended elsewhere (e.g. signed out on another phone). */
export const SESSION_ENDED_MESSAGE = "Your sign-in on this device has ended. Please sign out and sign in again.";

const STATUS_UNAUTHORIZED = 401;

interface FunctionFailure {
  status?: number;
  message?: string;
  code?: string;
}

/** Reads the status and the server's own `error` text from a failed function call. */
async function readFailure(error: unknown): Promise<FunctionFailure> {
  const context = (error as { context?: unknown })?.context;
  if (!(context instanceof Response)) return {};
  try {
    const body = await context.clone().json();
    return { status: context.status, message: typeof body?.error === "string" ? body.error : undefined, code: body?.code };
  } catch {
    return { status: context.status };
  }
}

/**
 * Calls an edge function and turns failures into readable errors instead of
 * "Edge Function returned a non-2xx status code". If the server says the
 * sign-in is no longer valid, refreshes it once and retries.
 */
export async function invokeFunction<T>(name: string, body: Record<string, unknown> = {}, fallback = "Something went wrong. Please try again."): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.functions.invoke(name, { body });
    if (!error) return data as T;

    const failure = await readFailure(error);
    console.error(`[${name}] function call failed`, { attempt, ...failure, error });

    if (failure.status === STATUS_UNAUTHORIZED && attempt === 0) {
      const { error: refreshError } = await supabase.auth.refreshSession();
      if (!refreshError) continue;
      console.warn(`[${name}] sign-in refresh failed`, refreshError);
      throw new Error(SESSION_ENDED_MESSAGE);
    }
    throw new Error(failure.status === STATUS_UNAUTHORIZED ? SESSION_ENDED_MESSAGE : failure.message || fallback);
  }
  throw new Error(SESSION_ENDED_MESSAGE);
}
