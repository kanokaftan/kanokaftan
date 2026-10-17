import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AdminCategory {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  product_count?: number;
}

export function useAdminCategories() {
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async (): Promise<AdminCategory[]> => {
      const { data: categories, error } = await supabase
        .from("categories")
        .select("*")
        .order("name");

      if (error) {
        console.error("[admin categories] load failed", error);
        throw new Error("Couldn't load categories.");
      }

      // Product counts per category, counted in the database.
      const { data: counts, error: countsError } = await supabase.rpc("admin_category_counts");
      if (countsError) console.error("[admin categories] counts failed", countsError);
      const countByCategory = (counts ?? {}) as Record<string, number>;

      return categories?.map(c => ({
        ...c,
        product_count: Number(countByCategory[c.id]) || 0,
      })) || [];
    },
  });

  const createCategory = useMutation({
    mutationFn: async (data: { name: string; slug: string; description?: string; image_url?: string }) => {
      const { error } = await supabase
        .from("categories")
        .insert(data);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; slug?: string; description?: string; image_url?: string }) => {
      const { error } = await supabase
        .from("categories")
        .update(data)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
  });

  const deleteCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("categories")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    },
  });

  return {
    categories: categoriesQuery.data || [],
    isLoading: categoriesQuery.isLoading,
    error: categoriesQuery.error,
    createCategory,
    updateCategory,
    deleteCategory,
  };
}
