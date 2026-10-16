import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** The three things every seller must have before adding products (checked by the database too). */
export interface ShopSetup {
  has_phone: boolean;
  has_location: boolean;
  has_payout: boolean;
  complete: boolean;
}

export const SHOP_SETUP_KEY = ["shop-setup", "required"];

export function useShopSetup(enabled = true) {
  return useQuery({
    queryKey: SHOP_SETUP_KEY,
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<ShopSetup> => {
      const { data, error } = await supabase.rpc("my_shop_setup");
      if (error) throw error;
      return data as unknown as ShopSetup;
    },
  });
}

/** Call after saving settings or the bank account so banners and forms update straight away. */
export function useRefreshShopSetup() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: SHOP_SETUP_KEY });
}

/** Human list of what's missing, e.g. "phone number, exact shop location". */
export function missingSetupItems(setup: ShopSetup): string[] {
  const missing: string[] = [];
  if (!setup.has_phone) missing.push("phone number");
  if (!setup.has_location) missing.push("exact shop location");
  if (!setup.has_payout) missing.push("bank account for payouts");
  return missing;
}
