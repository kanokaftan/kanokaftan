import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";

export interface WishlistItem {
  id: string;
  product_id: string;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    compare_at_price: number | null;
    product_images: { url: string; is_primary: boolean }[];
  };
}

export function useWishlist() {
  const queryClient = useQueryClient();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id || null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUserId(session?.user?.id || null);
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);

  const wishlistQuery = useQuery({
    queryKey: ["wishlist", userId],
    queryFn: async () => {
      if (!userId) return [];

      const { data, error } = await supabase
        .from("wishlists")
        .select(`
          id,
          product_id,
          product:products(
            id,
            name,
            slug,
            price,
            compare_at_price,
            product_images(url, is_primary)
          )
        `)
        .eq("user_id", userId);

      if (error) throw error;
      
      return (data || []).map(item => ({
        ...item,
        product: item.product as WishlistItem["product"]
      })) as WishlistItem[];
    },
    enabled: !!userId,
  });

  const addToWishlist = useMutation({
    mutationFn: async (productId: string) => {
      if (!userId) {
        throw new Error("Must be logged in to add to wishlist");
      }

      // Check if already in wishlist
      const { data: existing } = await supabase
        .from("wishlists")
        .select("id")
        .eq("user_id", userId)
        .eq("product_id", productId)
        .maybeSingle();

      if (existing) {
        // Remove from wishlist (toggle behavior)
        const { error } = await supabase
          .from("wishlists")
          .delete()
          .eq("id", existing.id);
        if (error) throw error;
        return { action: "removed" as const };
      } else {
        // Add to wishlist
        const { error } = await supabase
          .from("wishlists")
          .insert({
            user_id: userId,
            product_id: productId,
          });
        if (error) throw error;
        return { action: "added" as const };
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  const removeFromWishlist = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("wishlists")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist"] });
    },
  });

  const isInWishlist = (productId: string) => {
    return wishlistQuery.data?.some(item => item.product_id === productId) ?? false;
  };

  return {
    items: wishlistQuery.data || [],
    isLoading: wishlistQuery.isLoading,
    count: wishlistQuery.data?.length || 0,
    userId,
    addToWishlist,
    removeFromWishlist,
    isInWishlist,
  };
}
