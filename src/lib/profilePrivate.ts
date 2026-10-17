import { supabase } from "@/integrations/supabase/client";

/**
 * Email, phone, address and bank details are not readable from the profiles
 * table by the app. get_profile_private returns them only to the person
 * themselves, to admins, and (email and phone) to a seller for their buyers.
 */
export interface ProfilePrivate {
  id: string;
  email: string | null;
  phone: string | null;
  store_address: unknown;
  bank_name: string | null;
  account_number: string | null;
  account_name: string | null;
  payout_preference: string | null;
}

export type WithPrivate<T> = T & Omit<ProfilePrivate, "id">;

const EMPTY: Omit<ProfilePrivate, "id"> = {
  email: null, phone: null, store_address: null, bank_name: null, account_number: null, account_name: null, payout_preference: null,
};

export async function fetchProfilePrivate(ids: string[]): Promise<Map<string, ProfilePrivate>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const { data, error } = await supabase.rpc("get_profile_private", { p_ids: unique });
  if (error) {
    console.error("[profiles] get_profile_private failed", { count: unique.length, error });
    throw new Error("Couldn't load contact details. Please try again.");
  }
  return new Map(((data ?? []) as ProfilePrivate[]).map((row) => [row.id, row]));
}

/** Adds the private fields (or nulls, where the caller may not see them) to each profile row. */
export async function withProfilePrivate<T extends { id: string }>(rows: T[]): Promise<WithPrivate<T>[]> {
  const privateById = await fetchProfilePrivate(rows.map((r) => r.id));
  return rows.map((row) => {
    const extra = privateById.get(row.id);
    const { id: _ignored, ...fields } = extra ?? { id: row.id, ...EMPTY };
    return { ...row, ...fields };
  });
}

export interface ShopPickupPoint {
  id: string;
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  state: string | null;
}

/** Shop map positions for delivery prices (public: position and town only). */
export async function fetchShopPickupPoints(ids: string[]) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map<string, ShopPickupPoint>();
  const { data, error } = await supabase.rpc("shop_pickup_points", { p_ids: unique });
  if (error) {
    console.error("[profiles] shop_pickup_points failed", error);
    throw new Error("Couldn't work out delivery. Please try again.");
  }
  return new Map((data ?? []).map((row) => [row.id, row as ShopPickupPoint]));
}
