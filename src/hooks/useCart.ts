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
      // Guest carts are only reachable with their secret session id (guest_cart).
      if (!userId) {
        const { data, error } = await supabase.rpc("guest_cart", { p_session: sessionId });
        if (error) {
          console.error("[cart] guest cart failed", error);
          throw error;
        }
        return (data ?? []) as unknown as CartItem[];
      }

      const query = supabase
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

      const { data, error } = await query.eq("user_id", userId);
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
      if (!userId) {
        const { error } = await supabase.rpc("guest_cart_add", {
          p_session: sessionId, p_product_id: productId, p_quantity: quantity,
          p_variant_id: variantId || null, p_size: size || null, p_color: color || null,
        });
        if (error) throw error;
        return;
      }

      // Check if item already exists
      let existingQuery = supabase
        .from("cart_items")
        .select("id, quantity")
        .eq("product_id", productId)
        .eq("user_id", userId);

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
            user_id: userId,
            session_id: null,
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
      if (!userId) {
        const { error } = await supabase.rpc("guest_cart_set_quantity", { p_session: sessionId, p_item_id: itemId, p_quantity: quantity });
        if (error) throw error;
        return;
      }
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
      if (!userId) {
        const { error } = await supabase.rpc("guest_cart_set_quantity", { p_session: sessionId, p_item_id: itemId, p_quantity: 0 });
        if (error) throw error;
        return;
      }
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
      if (!userId) {
        const { error } = await supabase.rpc("guest_cart_clear", { p_session: sessionId });
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("cart_items").delete().eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });

  // Merge session cart into user cart on login
  // Move the guest cart into the account at sign-in (quantities are added for lines already there).
  const mergeSessionCart = useCallback(async (_newUserId: string) => {
    const { data: moved, error } = await supabase.rpc("merge_guest_cart", { p_session: getSessionId() });
    if (error) {
      console.error("[cart] merge after sign-in failed", error);
      return;
    }
    if (moved) queryClient.invalidateQueries({ queryKey: ["cart"] });
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
