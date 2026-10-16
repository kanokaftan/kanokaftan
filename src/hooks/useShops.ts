import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

export type DirectoryShop = Database["public"]["Functions"]["browse_shops"]["Returns"][number];
export type ShopBadgeFilter = "all" | "gold" | "verified" | "unverified";
export type ShopTypeFilter = "all" | "tailor" | "seller";
export type ShopType = "tailor" | "seller";
/** Badge counts are within the chosen type, type counts within the chosen badge ("everyone" = both types). */
export type ShopFilterCounts = Record<ShopBadgeFilter | ShopType | "everyone" | "total", number>;

/** Shops loaded per page while scrolling the directory. */
export const SHOP_PAGE_SIZE = 30;

/** The shop directory, filtered on the server and loaded a page at a time. */
export function useBrowseShops({ search, badge, type }: { search: string; badge: ShopBadgeFilter; type: ShopTypeFilter }) {
  return useInfiniteQuery({
    queryKey: ["shops", "browse", search, badge, type],
    initialPageParam: 0,
    queryFn: async ({ pageParam }): Promise<DirectoryShop[]> => {
      const { data, error } = await supabase.rpc("browse_shops", {
        p_search: search || null,
        p_badge: badge,
        p_type: type,
        p_limit: SHOP_PAGE_SIZE,
        p_offset: pageParam,
      });
      if (error) throw error;
      return data ?? [];
    },
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < SHOP_PAGE_SIZE ? undefined : allPages.length * SHOP_PAGE_SIZE,
  });
}

/** How many shops each filter chip would show, for the current search and filters. */
export function useShopFilterCounts({ search, badge, type }: { search: string; badge: ShopBadgeFilter; type: ShopTypeFilter }) {
  return useQuery({
    queryKey: ["shops", "counts", search, badge, type],
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ShopFilterCounts> => {
      const { data, error } = await supabase.rpc("shop_filter_counts", { p_search: search || null, p_badge: badge, p_type: type });
      if (error) throw error;
      return data as unknown as ShopFilterCounts;
    },
  });
}

/** The signed-in seller's shop type (chosen, or guessed from the shop description). */
export function useMyShopType(enabled: boolean) {
  return useQuery({
    queryKey: ["my-shop-type"],
    enabled,
    queryFn: async (): Promise<ShopType> => {
      const { data, error } = await supabase.rpc("my_shop_type");
      if (error) throw error;
      return data === "tailor" ? "tailor" : "seller";
    },
  });
}

export function useSetMyShopType() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (type: ShopType) => {
      const { error } = await supabase.rpc("set_my_shop_type", { p_type: type });
      if (error) throw new Error(error.message || "Couldn't save your shop type.");
      return type;
    },
    onSuccess: (type) => {
      queryClient.setQueryData(["my-shop-type"], type);
      queryClient.invalidateQueries({ queryKey: ["shops"] });
    },
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
