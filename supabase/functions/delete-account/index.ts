import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders, json } from "../_shared/cors.ts";
import { getCaller, serviceClient } from "../_shared/supabase.ts";

// "Delete my account" (App Store and Google Play require it).
//
// actions:
//   status                      -> what would stop deletion now, and what will be lost
//   delete { confirm: "DELETE" } -> removes the person's data and sign-in
//
// People with no orders, sales or payouts are removed completely. People with
// history keep anonymous order/payout records for the books; their profile
// becomes "Deleted user" and they can never sign in again.

const CONFIRM_WORD = "DELETE";
const STORAGE_BATCH = 100;
/** About 100 years: the sign-in of an anonymised account is blocked for good. */
const BAN_FOREVER = "876000h";

interface DeletionStatus {
  can_delete: boolean;
  blockers: { code: string; message: string }[];
  k2_balance: number;
  keeps_records: boolean;
  has_shop: boolean;
}

async function deletionStatus(userId: string): Promise<DeletionStatus> {
  const { data, error } = await serviceClient().rpc("account_deletion_status", { p_user_id: userId });
  if (error) {
    console.error("[delete-account] status failed", { userId, error: error.message });
    throw new Error("Couldn't check your account. Please try again.");
  }
  return data as DeletionStatus;
}

/** Removes everything the person uploaded (photos, product pictures, chat media). */
async function removeFiles(userId: string): Promise<number> {
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("account_storage_paths", { p_user_id: userId });
  if (error) {
    console.error("[delete-account] listing files failed", { userId, error: error.message });
    return 0;
  }
  const byBucket = new Map<string, string[]>();
  for (const row of (data ?? []) as { bucket_id: string; name: string }[]) {
    byBucket.set(row.bucket_id, [...(byBucket.get(row.bucket_id) ?? []), row.name]);
  }
  let removed = 0;
  for (const [bucket, names] of byBucket) {
    for (let i = 0; i < names.length; i += STORAGE_BATCH) {
      const batch = names.slice(i, i + STORAGE_BATCH);
      const { error: removeError } = await supabase.storage.from(bucket).remove(batch);
      if (removeError) console.error("[delete-account] removing files failed", { userId, bucket, error: removeError.message });
      else removed += batch.length;
    }
  }
  return removed;
}

async function deleteAccount(userId: string) {
  const supabase = serviceClient();
  const { data, error } = await supabase.rpc("scrub_account", { p_user_id: userId });
  if (error) {
    console.error("[delete-account] scrub failed", { userId, error: error.message });
    throw new Error("Couldn't delete your account. Nothing was removed. Please try again.");
  }
  const result = data as { ok: boolean; mode?: "deleted" | "anonymised"; has_shop?: boolean; status?: DeletionStatus };
  if (!result.ok) return { ok: false as const, status: result.status };

  const filesRemoved = await removeFiles(userId);

  if (result.mode === "deleted") {
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("[delete-account] auth delete failed", { userId, error: deleteError.message });
      throw new Error("Your details were removed, but signing you out everywhere failed. Please contact Kano Kaftan.");
    }
  } else {
    const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
      email: `deleted-${userId}@users.kanokaftan.shop`,
      email_confirm: true,
      phone: "",
      user_metadata: { deleted: true },
      ban_duration: BAN_FOREVER,
    });
    if (updateError) console.error("[delete-account] auth anonymise failed", { userId, error: updateError.message });
    const { error: purgeError } = await supabase.rpc("purge_account_sign_in", { p_user_id: userId });
    if (purgeError) console.error("[delete-account] sign-in purge failed", { userId, error: purgeError.message });
  }

  const { error: logError } = await supabase.from("account_deletions").insert({
    user_id: userId, mode: result.mode, had_shop: !!result.has_shop, files_removed: filesRemoved,
  });
  if (logError) console.error("[delete-account] log failed", { userId, error: logError.message });

  return { ok: true as const, mode: result.mode };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const caller = await getCaller(req);
    if (!caller) return json({ success: false, error: "Please sign in again." }, 401);
    const body = await req.json().catch(() => ({}));
    const action = body?.action;

    if (action === "status") {
      return json({ success: true, status: await deletionStatus(caller.id) });
    }

    if (action === "delete") {
      if (body?.confirm !== CONFIRM_WORD) {
        return json({ success: false, error: `Type ${CONFIRM_WORD} to confirm.` }, 400);
      }
      const result = await deleteAccount(caller.id);
      if (!result.ok) return json({ success: false, code: "blocked", status: result.status, error: result.status?.blockers?.[0]?.message }, 409);
      return json({ success: true, mode: result.mode });
    }

    return json({ success: false, error: "Unknown action" }, 400);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Something went wrong";
    console.error("[delete-account] request failed:", message);
    return json({ success: false, error: message }, 400);
  }
});
