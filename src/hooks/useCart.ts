import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { track } from "@/lib/analytics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCallback, useMemo } from "react";

export interface CartItem {
  id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  size: string | null;
  color: string | null;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    stock_quantity: number;
    product_images: { url: string; is_primary: boolean }[];
  };
}

function getSessionId() {
  let sessionId = localStorage.getItem("cart_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("cart_session_id", sessionId);
  }
  return sessionId;
}

export function useCart() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id || null;
  const sessionId = useMemo(() => getSessionId(), []);

  const cartQuery = useQuery({
    queryKey: ["cart", userId, sessionId],
    queryFn: async () => {
      let query = supabase
        .from("cart_items")
        .select(`
          id,
          product_id,
          variant_id,
          quantity,
          size,
          color,
          product:products(
            id,
            name,
            slug,
            price,
            stock_quantity,
            product_images(url, is_primary)
          )
        `);

      if (userId) {
        query = query.eq("user_id", userId);
      } else {
        query = query.eq("session_id", sessionId).is("user_id", null);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data || []).map(item => ({
        ...item,
        product: item.product as CartItem["product"]
      })) as CartItem[];
    },
  });

  const addToCart = useMutation({
    mutationFn: async ({ productId, quantity = 1, variantId, size, color }: {
      productId: string;
      quantity?: number;
      variantId?: string | null;
      size?: string | null;
      color?: string | null;
    }) => {
      // Check if item already exists
      let existingQuery = supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("product_id", productId);

      if (userId) {
        existingQuery = existingQuery.eq("user_id", userId);
      } else {
        existingQuery = existingQuery.eq("session_id", sessionId).is("user_id", null);
      }

      if (variantId) {
        existingQuery = existingQuery.eq("variant_id", variantId);
      } else {
        existingQuery = existingQuery.is("variant_id", null);
      }

      // Same product in a different size/colour is a separate cart line
      existingQuery = size ? existingQuery.eq("size", size) : existingQuery.is("size", null);
      existingQuery = color ? existingQuery.eq("color", color) : existingQuery.is("color", null);

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + quantity })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .insert({
            product_id: productId,
            variant_id: variantId || null,
            size: size || null,
            color: color || null,
            quantity,
            user_id: userId || null,
            session_id: userId ? null : sessionId,
          });
        if (error) throw error;
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
      track("add_to_cart", { product_id: variables.productId });
    },
  });

  const updateQuantity = useMutation({
    mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
      if (quantity <= 0) {
        const { error } = await supabase
          .from("cart_items")
          .delete()
          .eq("id", itemId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("cart_items")
          .update({ quantity })
          .eq("id", itemId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from("cart_items")
        .delete()
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  const clearCart = useMutation({
    mutationFn: async () => {
      let query = supabase.from("cart_items").delete();
      
      if (userId) {
        query = query.eq("user_id", userId);
      } else {
        query = query.eq("session_id", sessionId).is("user_id", null);
      }

      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  // Merge session cart into user cart on login
  const mergeSessionCart = useCallback(async (newUserId: string) => {
    const sessionId = getSessionId();
    
    // Get session cart items
    const { data: sessionItems } = await supabase
      .from("cart_items")
      .select("product_id, variant_id, size, color, quantity")
      .eq("session_id", sessionId)
      .is("user_id", null);

    if (!sessionItems || sessionItems.length === 0) return;

    // For each session item, add to user's cart or update quantity
    for (const item of sessionItems) {
      // Check if user already has this product
      let existingQuery = supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("user_id", newUserId)
        .eq("product_id", item.product_id);

      if (item.variant_id) {
        existingQuery = existingQuery.eq("variant_id", item.variant_id);
      } else {
        existingQuery = existingQuery.is("variant_id", null);
      }

      existingQuery = item.size ? existingQuery.eq("size", item.size) : existingQuery.is("size", null);
      existingQuery = item.color ? existingQuery.eq("color", item.color) : existingQuery.is("color", null);

      const { data: existing } = await existingQuery.maybeSingle();

      if (existing) {
        // Update quantity
        await supabase
          .from("cart_items")
          .update({ quantity: existing.quantity + item.quantity })
          .eq("id", existing.id);
      } else {
        // Insert new item for user
        await supabase
          .from("cart_items")
          .insert({
            product_id: item.product_id,
            variant_id: item.variant_id,
            size: item.size,
            color: item.color,
            quantity: item.quantity,
            user_id: newUserId,
            session_id: null,
          });
      }
    }

    // Delete session cart items
    await supabase
      .from("cart_items")
      .delete()
      .eq("session_id", sessionId)
      .is("user_id", null);

    // Refresh cart
    queryClient.invalidateQueries({ queryKey: ["cart"] });
  }, [queryClient]);

  const cartItems = cartQuery.data || [];
  const cartTotal = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const cartCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  return {
    items: cartItems,
    isLoading: cartQuery.isLoading,
    total: cartTotal,
    count: cartCount,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    mergeSessionCart,
  };
}
