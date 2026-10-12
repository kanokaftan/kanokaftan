import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Product } from "@/hooks/useProducts";
import type { Database } from "@/integrations/supabase/types";

export type Shop = Database["public"]["Functions"]["list_shops"]["Returns"][number];
export type ShopReview = Database["public"]["Functions"]["get_shop_reviews"]["Returns"][number];

/** A shop by its short link, or by vendor id for old /vendor/:id links. */
export function useShop({ slug, vendorId }: { slug?: string; vendorId?: string }) {
  return useQuery({
    queryKey: ["shop", slug ?? null, vendorId ?? null],
    queryFn: async (): Promise<Shop | null> => {
      const { data, error } = await supabase.rpc("get_shop", {
        p_slug: slug ?? null,
        p_vendor_id: vendorId ?? null,
      });
      if (error) throw error;
      return data?.[0] ?? null;
    },
    enabled: !!slug || !!vendorId,
  });
}

export function useShops(search = "", limit = 24) {
  return useQuery({
    queryKey: ["shops", search, limit],
    queryFn: async (): Promise<Shop[]> => {
      const { data, error } = await supabase.rpc("list_shops", {
        p_search: search || null,
        p_limit: limit,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useShopProducts(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["shop-products", vendorId],
    queryFn: async (): Promise<Product[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_images (id, url, is_primary, alt_text, display_order),
          category:categories (id, name, slug),
          vendor:profiles!products_vendor_id_fkey(id, full_name, avatar_url, is_verified, verification_tier, store_name)
        `)
        .eq("vendor_id", vendorId!)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Product[];
    },
    enabled: !!vendorId,
  });
}

export function useShopReviews(vendorId: string | undefined) {
  return useQuery({
    queryKey: ["shop-reviews", vendorId],
    queryFn: async (): Promise<ShopReview[]> => {
      const { data, error } = await supabase.rpc("get_shop_reviews", { p_vendor_id: vendorId!, p_limit: 30 });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!vendorId,
  });
}

export function useShopFollow(vendorId: string | undefined) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const queryClient = useQueryClient();

  const followingQuery = useQuery({
    queryKey: ["shop-following", userId, vendorId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("shop_follows")
        .select("vendor_id")
        .eq("user_id", userId!)
        .eq("vendor_id", vendorId!)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!userId && !!vendorId,
  });

  const toggleFollow = useMutation({
    mutationFn: async () => {
      if (!userId || !vendorId) throw new Error("Please sign in to follow shops");
      if (followingQuery.data) {
        const { error } = await supabase.from("shop_follows").delete().eq("user_id", userId).eq("vendor_id", vendorId);
        if (error) throw error;
        return false;
      }
      const { error } = await supabase.from("shop_follows").insert({ user_id: userId, vendor_id: vendorId });
      if (error) throw error;
      return true;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shop-following", userId, vendorId] });
      queryClient.invalidateQueries({ queryKey: ["shop-social", vendorId] });
      queryClient.invalidateQueries({ queryKey: ["shop"] });
      queryClient.invalidateQueries({ queryKey: ["shops"] });
    },
  });

  return { isFollowing: followingQuery.data ?? false, toggleFollow, canFollow: !!userId && userId !== vendorId };
}
