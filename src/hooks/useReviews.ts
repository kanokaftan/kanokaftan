import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Database } from "@/integrations/supabase/types";

export interface Review {
  id: string;
  product_id: string;
  user_id: string;
  order_item_id: string | null;
  rating: number;
  review_text: string | null;
  photos: string[];
  fit_feedback: "true_to_size" | "runs_small" | "runs_large" | null;
  would_recommend: boolean;
  seller_reply: string | null;
  seller_replied_at: string | null;
  is_approved: boolean;
  created_at: string;
  updated_at: string;
  user?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface CreateReviewData {
  product_id: string;
  order_item_id: string;
  rating: number;
  review_text?: string;
  photos?: string[];
  fit_feedback?: "true_to_size" | "runs_small" | "runs_large";
  would_recommend?: boolean;
}

export function useProductReviews(productId: string) {
  const reviewsQuery = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("*")
        .eq("product_id", productId)
        .eq("is_approved", true)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Fetch user profiles separately
      const userIds = [...new Set((data || []).map((r) => r.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);

      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return (data || []).map((review: any) => ({
        ...review,
        photos: review.photos || [],
        user: profileMap.get(review.user_id) || null,
      })) as Review[];
    },
    enabled: !!productId,
  });

  const stats = reviewsQuery.data?.reduce(
    (acc, review) => {
      acc.total++;
      acc.sum += review.rating;
      acc.distribution[review.rating]++;
      if (review.would_recommend) acc.recommended++;
      return acc;
    },
    {
      total: 0,
      sum: 0,
      recommended: 0,
      distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<number, number>,
    }
  );

  return {
    reviews: reviewsQuery.data || [],
    isLoading: reviewsQuery.isLoading,
    averageRating: stats ? stats.sum / stats.total : 0,
    totalReviews: stats?.total || 0,
    recommendedPercent: stats ? Math.round((stats.recommended / stats.total) * 100) : 0,
    distribution: stats?.distribution || { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
  };
}

export type ReviewableItem = Database["public"]["Functions"]["get_my_reviewable_items"]["Returns"][number];

/**
 * Things the signed-in buyer received and hasn't reviewed yet. Narrow it to one
 * shop or one product (e.g. the shop page or product page).
 */
export function useReviewableItems({ vendorId, productId }: { vendorId?: string; productId?: string } = {}) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["reviewable-items", user?.id ?? null, vendorId ?? null, productId ?? null],
    queryFn: async (): Promise<ReviewableItem[]> => {
      const { data, error } = await supabase.rpc("get_my_reviewable_items", {
        p_vendor_id: vendorId ?? null,
        p_product_id: productId ?? null,
      });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useReviews() {
  const { user } = useAuth();
  const userId = user?.id || null;
  const queryClient = useQueryClient();

  const createReview = useMutation({
    mutationFn: async (reviewData: CreateReviewData) => {
      if (!userId) throw new Error("Please sign in to write a review");

      const { data, error } = await supabase
        .from("reviews")
        .insert({
          user_id: userId,
          ...reviewData,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["reviews", data.product_id] });
      queryClient.invalidateQueries({ queryKey: ["reviewable-items"] });
      queryClient.invalidateQueries({ queryKey: ["shop-reviews"] });
      queryClient.invalidateQueries({ queryKey: ["shop"] });
    },
  });

  const updateReview = useMutation({
    mutationFn: async ({ id, ...data }: Partial<CreateReviewData> & { id: string }) => {
      if (!userId) throw new Error("Please sign in to edit your review");

      const { error } = await supabase
        .from("reviews")
        .update(data)
        .eq("id", id)
        .eq("user_id", userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      queryClient.invalidateQueries({ queryKey: ["shop-reviews"] });
    },
  });

  return {
    createReview,
    updateReview,
  };
}
