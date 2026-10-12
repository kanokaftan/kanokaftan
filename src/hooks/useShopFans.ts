import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

type Functions = Database["public"]["Functions"];
export type ShopFan = Functions["get_my_shop_fans"]["Returns"][number];
export type MyShopReview = Functions["get_my_shop_reviews"]["Returns"][number];
export type FanList = "followers" | "likes";

export interface ShopSocial {
  followerCount: number;
  likeCount: number;
  iFollow: boolean;
  iLike: boolean;
}

export interface FanSummary {
  followers: number;
  followers_week: number;
  likes: number;
  likes_week: number;
  reviews: number;
  rating: number | null;
  awaiting_reply: number;
}

const EMPTY_SOCIAL: ShopSocial = { followerCount: 0, likeCount: 0, iFollow: false, iLike: false };

/** Turns database errors into something a shopper or seller can act on. */
export function friendlyError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : "";
  if (!message) return fallback;
  if (/row-level security|permission denied/i.test(message)) return fallback;
  if (/duplicate key/i.test(message)) return "You have already done this.";
  return message;
}

/** Follower/like counts for a shop and whether the viewer follows or likes it. */
export function useShopSocial(vendorId: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["shop-social", vendorId, user?.id ?? null],
    queryFn: async (): Promise<ShopSocial> => {
      const { data, error } = await supabase.rpc("get_shop_social", { p_vendor_id: vendorId! });
      if (error) throw error;
      const row = data?.[0];
      if (!row) return EMPTY_SOCIAL;
      return {
        followerCount: Number(row.follower_count) || 0,
        likeCount: Number(row.like_count) || 0,
        iFollow: !!row.i_follow,
        iLike: !!row.i_like,
      };
    },
    enabled: !!vendorId,
  });
}

/** Heart a shop. Updates the count straight away and rolls back if the server refuses. */
export function useToggleShopLike(vendorId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const key = ["shop-social", vendorId, user?.id ?? null];

  return useMutation({
    mutationFn: async (like: boolean) => {
      if (!user) throw new Error("Please sign in to like shops");
      if (!vendorId) throw new Error("Shop not found");
      const { error } = await supabase.rpc("set_shop_like", { p_vendor_id: vendorId, p_like: like });
      if (error) throw error;
      return like;
    },
    onMutate: async (like) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<ShopSocial>(key);
      if (previous) {
        queryClient.setQueryData<ShopSocial>(key, {
          ...previous,
          iLike: like,
          likeCount: Math.max(0, previous.likeCount + (like === previous.iLike ? 0 : like ? 1 : -1)),
        });
      }
      return { previous };
    },
    onError: (error, _like, context) => {
      console.error("[useToggleShopLike] failed", { vendorId, error });
      if (context?.previous) queryClient.setQueryData(key, context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["shop-social", vendorId] }),
  });
}

/** Seller: headline numbers (followers, likes, reviews waiting for a reply). */
export function useMyFanSummary(enabled = true) {
  return useQuery({
    queryKey: ["my-fan-summary"],
    queryFn: async (): Promise<FanSummary> => {
      const { data, error } = await supabase.rpc("get_my_shop_fan_summary");
      if (error) throw error;
      const s = (data ?? {}) as Partial<FanSummary>;
      return {
        followers: Number(s.followers) || 0,
        followers_week: Number(s.followers_week) || 0,
        likes: Number(s.likes) || 0,
        likes_week: Number(s.likes_week) || 0,
        reviews: Number(s.reviews) || 0,
        rating: s.rating == null ? null : Number(s.rating),
        awaiting_reply: Number(s.awaiting_reply) || 0,
      };
    },
    enabled,
    staleTime: 60_000,
  });
}

/** Seller: people who follow or liked the shop, newest first. */
export function useMyShopFans(kind: FanList) {
  return useQuery({
    queryKey: ["my-shop-fans", kind],
    queryFn: async (): Promise<ShopFan[]> => {
      const { data, error } = await supabase.rpc("get_my_shop_fans", { p_kind: kind, p_limit: 200 });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Seller: reviews on my products, unanswered first. */
export function useMyShopReviews() {
  return useQuery({
    queryKey: ["my-shop-reviews"],
    queryFn: async (): Promise<MyShopReview[]> => {
      const { data, error } = await supabase.rpc("get_my_shop_reviews", { p_limit: 200 });
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReplyToReview() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ reviewId, reply }: { reviewId: string; reply: string }) => {
      const { error } = await supabase.rpc("reply_to_review", { p_review_id: reviewId, p_reply: reply });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-shop-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["my-fan-summary"] });
      queryClient.invalidateQueries({ queryKey: ["shop-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
    },
  });
}
