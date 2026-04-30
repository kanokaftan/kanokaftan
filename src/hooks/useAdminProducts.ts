import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  stock_quantity: number;
  is_active: boolean;
  featured: boolean;
  created_at: string;
  category: { name: string } | null;
  product_images: { url: string }[];
}

export function useAdminProducts() {
  const queryClient = useQueryClient();

  const productsQuery = useQuery({
    queryKey: ["admin-products"],
    queryFn: async (): Promise<AdminProduct[]> => {
      const { data, error } = await supabase
        .from("products")
        .select(`*, category:categories(name), product_images(url, is_primary, display_order)`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((p) => ({
        ...p,
        product_images: (p.product_images || []).sort(
          (a: any, b: any) => (a.display_order ?? 99) - (b.display_order ?? 99)
        ),
      }));
    },
    staleTime: 30_000,
  });

  const toggleFeatured = useMutation({
    mutationFn: async ({ productId, featured }: { productId: string; featured: boolean }) => {
      const { error } = await supabase.from("products").update({ featured }).eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ productId, isActive }: { productId: string; isActive: boolean }) => {
      const { error } = await supabase.from("products").update({ is_active: isActive }).eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin-products"] }),
  });

  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["admin-stats"] });
    },
  });

  return {
    products: productsQuery.data || [],
    isLoading: productsQuery.isLoading,
    error: productsQuery.error,
    toggleFeatured,
    toggleActive,
    deleteProduct,
  };
}
