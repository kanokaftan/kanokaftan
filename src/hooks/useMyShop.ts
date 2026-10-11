import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const SHOP_ORIGIN = "https://kanokaftan.shop";

/** The signed-in seller's shop name, logo and public link, plus a one-tap share. */
export function useMyShop(vendorId: string | null | undefined) {
  const query = useQuery({
    queryKey: ["vendor-shop-card", vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("store_name, store_slug, avatar_url, full_name, is_verified")
        .eq("id", vendorId!)
        .maybeSingle();
      if (error) {
        console.error("[useMyShop] could not load shop", error);
        throw error;
      }
      return data;
    },
    enabled: !!vendorId,
    staleTime: 5 * 60_000,
  });

  const shop = query.data;
  const name = shop?.store_name || shop?.full_name || "My shop";
  const shopUrl = shop?.store_slug ? `${SHOP_ORIGIN}/shop/${shop.store_slug}` : null;

  const share = useCallback(async () => {
    if (!shopUrl) {
      toast.info("Add your shop name in Settings first");
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: name, text: `Shop ${name} on Kano Kaftan`, url: shopUrl });
      } else {
        await navigator.clipboard.writeText(shopUrl);
        toast.success("Shop link copied");
      }
    } catch (error) {
      // Closing the share sheet isn't an error.
      if ((error as DOMException)?.name === "AbortError") return;
      console.error("[useMyShop] share failed", error);
      toast.error("Couldn't share. Copy the link from your shop page instead.");
    }
  }, [name, shopUrl]);

  return { shop, name, shopUrl, isLoading: query.isLoading, share };
}
