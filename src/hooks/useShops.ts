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

export type DirectoryShop = Database["public"]["Functions"]["shop_directory"]["Returns"][number];
export type ShopBadgeFilter = "all" | "gold" | "verified" | "unverified";
export type ShopTypeFilter = "all" | "tailor" | "seller";
export type ShopType = "tailor" | "seller";
export type ShopSort = "recommended" | "near" | "followers" | "newest" | "rating";
/** Badge counts are within the chosen type, type counts within the chosen badge ("everyone" = both types). */
export type ShopFilterCounts = Record<ShopBadgeFilter | ShopType | "everyone" | "total", number>;

export interface ShopDirectoryQuery {
  search: string;
  badge: ShopBadgeFilter;
  type: ShopTypeFilter;
  town: string | null;
  sort: ShopSort;
  /** The shopper's position, only for "near". */
  position: { lat: number; lng: number } | null;
}

/** Shops loaded per page while scrolling the directory. */
export const SHOP_PAGE_SIZE = 30;
/** Gold shops shown in the strip at the top of the Shops page. */
const GOLD_STRIP_SIZE = 12;

async function fetchDirectory(q: ShopDirectoryQuery, limit: number, offset: number): Promise<DirectoryShop[]> {
  const { data, error } = await supabase.rpc("shop_directory", {
    p_search: q.search || null,
    p_badge: q.badge,
    p_type: q.type,
    p_town: q.town,
    p_sort: q.sort,
    p_lat: q.position?.lat ?? null,
    p_lng: q.position?.lng ?? null,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw error;
  return (data ?? []).map((s) => ({ ...s, distance_km: s.distance_km == null ? null : Number(s.distance_km) }));
}

/** The shop directory, filtered and sorted on the server and loaded a page at a time. */
export function useBrowseShops(q: ShopDirectoryQuery) {
  // Position only matters for "near"; rounding to ~100 m keeps small GPS jitter from refetching.
  const positionKey = q.sort === "near" && q.position ? `${q.position.lat.toFixed(3)},${q.position.lng.toFixed(3)}` : null;
  return useInfiniteQuery({
    queryKey: ["shops", "browse", q.search, q.badge, q.type, q.town, q.sort, positionKey],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchDirectory(q, SHOP_PAGE_SIZE, pageParam),
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length < SHOP_PAGE_SIZE ? undefined : allPages.length * SHOP_PAGE_SIZE,
  });
}

/** Gold shops for the strip at the top of the Shops page. */
export function useGoldShops() {
  return useQuery({
    queryKey: ["shops", "gold-strip"],
    staleTime: 5 * 60 * 1000,
    queryFn: () =>
      fetchDirectory({ search: "", badge: "gold", type: "all", town: null, sort: "recommended", position: null }, GOLD_STRIP_SIZE, 0),
  });
}

/** How many shops each filter chip would show, for the current search, town and filters. */
export function useShopFilterCounts({ search, badge, type, town }: Pick<ShopDirectoryQuery, "search" | "badge" | "type" | "town">) {
  return useQuery({
    queryKey: ["shops", "counts", search, badge, type, town],
    staleTime: 60 * 1000,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<ShopFilterCounts> => {
      const { data, error } = await supabase.rpc("shop_directory_counts", {
        p_search: search || null, p_badge: badge, p_type: type, p_town: town,
      });
      if (error) throw error;
      return data as unknown as ShopFilterCounts;
    },
  });
}

/** Towns that have shops, busiest first. */
export function useShopTowns() {
  return useQuery({
    queryKey: ["shops", "towns"],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("shop_towns");
      if (error) throw error;
      return (data ?? []).map((t) => ({ town: t.town, shops: Number(t.shops) }));
    },
  });
}

/** Admin: a shop's type, and changing it. */
export function useAdminShopType(vendorId: string | undefined) {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["admin-shop-type", vendorId],
    enabled: !!vendorId,
    queryFn: async (): Promise<ShopType> => {
      const { data, error } = await supabase.rpc("admin_shop_type", { p_vendor_id: vendorId! });
      if (error) throw error;
      return data === "tailor" ? "tailor" : "seller";
    },
  });
  const save = useMutation({
    mutationFn: async (type: ShopType) => {
      const { error } = await supabase.rpc("admin_set_shop_type", { p_vendor_id: vendorId!, p_type: type });
      if (error) throw new Error(error.message || "Couldn't change the shop type.");
      return type;
    },
    onSuccess: (type) => {
      queryClient.setQueryData(["admin-shop-type", vendorId], type);
      queryClient.invalidateQueries({ queryKey: ["shops"] });
    },
  });
  return { ...query, save };
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
