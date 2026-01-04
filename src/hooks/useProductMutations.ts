import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ProductData {
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_at_price?: number | null;
  stock_quantity: number;
  category_id: string;
  is_active: boolean;
  featured: boolean;
}

interface ProductImage {
  url: string;
  is_primary: boolean;
  alt_text?: string;
  display_order: number;
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .concat("-", Date.now().toString(36));
}

export function useProductMutations(vendorId: string | null) {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const createProduct = useMutation({
    mutationFn: async ({
      product,
      images,
    }: {
      product: Omit<ProductData, "slug">;
      images: ProductImage[];
    }) => {
      if (!vendorId) throw new Error("Vendor ID required");

      const slug = generateSlug(product.name);

      // Create the product
      const { data: newProduct, error: productError } = await supabase
        .from("products")
        .insert({
          ...product,
          slug,
          vendor_id: vendorId,
        })
        .select()
        .single();

      if (productError) throw productError;

      // Add images if any
      if (images.length > 0) {
        const { error: imagesError } = await supabase
          .from("product_images")
          .insert(
            images.map((img) => ({
              ...img,
              product_id: newProduct.id,
            }))
          );

        if (imagesError) throw imagesError;
      }

      return newProduct;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      toast({
        title: "Product created",
        description: "Your product has been added successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error creating product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateProduct = useMutation({
    mutationFn: async ({
      productId,
      product,
      images,
    }: {
      productId: string;
      product: Partial<ProductData>;
      images?: ProductImage[];
    }) => {
      // Update the product
      const { error: productError } = await supabase
        .from("products")
        .update(product)
        .eq("id", productId);

      if (productError) throw productError;

      // Update images if provided
      if (images) {
        // Delete existing images
        await supabase
          .from("product_images")
          .delete()
          .eq("product_id", productId);

        // Add new images
        if (images.length > 0) {
          const { error: imagesError } = await supabase
            .from("product_images")
            .insert(
              images.map((img) => ({
                ...img,
                product_id: productId,
              }))
            );

          if (imagesError) throw imagesError;
        }
      }

      return { productId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      queryClient.invalidateQueries({ queryKey: ["vendor-product"] });
      toast({
        title: "Product updated",
        description: "Your changes have been saved",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", productId);

      if (error) throw error;
      return { productId };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      toast({
        title: "Product deleted",
        description: "The product has been removed",
      });
    },
    onError: (error) => {
      toast({
        title: "Error deleting product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const toggleProductStatus = useMutation({
    mutationFn: async ({
      productId,
      isActive,
    }: {
      productId: string;
      isActive: boolean;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active: isActive })
        .eq("id", productId);

      if (error) throw error;
      return { productId, isActive };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["vendor-products"] });
      toast({
        title: data.isActive ? "Product activated" : "Product deactivated",
        description: data.isActive
          ? "Product is now visible to customers"
          : "Product is now hidden from customers",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating product",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const uploadImage = async (file: File): Promise<string> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${vendorId}/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from("product-images")
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from("product-images")
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  return {
    createProduct,
    updateProduct,
    deleteProduct,
    toggleProductStatus,
    uploadImage,
  };
}
