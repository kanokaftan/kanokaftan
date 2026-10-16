import { useState, useEffect } from "react";
import { missingSetupItems, useShopSetup } from "@/hooks/useShopSetup";
import { Link, useNavigate, useParams } from "react-router-dom";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { useVendorProduct } from "@/hooks/useVendorProducts";
import { useProductMutations } from "@/hooks/useProductMutations";
import { useCategories } from "@/hooks/useProducts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, X, Loader2, Star, Megaphone, ChevronLeft, ChevronRight } from "lucide-react";

/** "S, M ,, L" -> ["S", "M", "L"], de-duplicated. */
function splitOptions(value: string): string[] {
  return [...new Set(value.split(",").map((s) => s.trim()).filter(Boolean))];
}

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useVendorAuth();
  const { data: existingProduct, isLoading: productLoading } = useVendorProduct(id || null);
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { createProduct, updateProduct, uploadImage } = useProductMutations(userId);

  const isEditing = !!id;
  const { data: setup } = useShopSetup(!id);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    price: "",
    compare_at_price: "",
    stock_quantity: "",
    category_id: "",
    is_active: true,
    featured: false,
    sizes: "",
    colors: "",
  });

  // Order here is the order shoppers see; the first photo is the main one.
  const [images, setImages] = useState<{ url: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  useEffect(() => {
    if (existingProduct && isEditing) {
      setFormData({
        name: existingProduct.name,
        description: existingProduct.description || "",
        price: existingProduct.price.toString(),
        compare_at_price: existingProduct.compare_at_price?.toString() || "",
        stock_quantity: existingProduct.stock_quantity.toString(),
        category_id: existingProduct.category_id || "",
        is_active: existingProduct.is_active,
        featured: existingProduct.featured,
        sizes: (existingProduct.sizes || []).join(", "),
        colors: (existingProduct.colors || []).join(", "),
      });
      setImages(
        [...(existingProduct.product_images || [])]
          .sort((a: { is_primary: boolean; display_order: number | null }, b: { is_primary: boolean; display_order: number | null }) =>
            Number(b.is_primary) - Number(a.is_primary) || (a.display_order ?? 0) - (b.display_order ?? 0))
          .map((img: { url: string }) => ({ url: img.url }))
      );
    }
  }, [existingProduct, isEditing]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const url = await uploadImage(file);
        return { url };
      });

      const newImages = await Promise.all(uploadPromises);
      setImages((prev) => [...prev, ...newImages]);
    } catch (error) {
      console.error("Upload error:", error);
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  const moveImage = (from: number, to: number) => {
    setImages((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const updated = [...prev];
      const [moved] = updated.splice(from, 1);
      updated.splice(to, 0, moved);
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const productData = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      compare_at_price: formData.compare_at_price
        ? parseFloat(formData.compare_at_price)
        : null,
      stock_quantity: parseInt(formData.stock_quantity),
      category_id: formData.category_id,
      is_active: formData.is_active,
      // Featured status is bought on the Promote page; never changed from this form.
      sizes: splitOptions(formData.sizes),
      colors: splitOptions(formData.colors),
    };

    const imageData = images.map((img, index) => ({
      url: img.url,
      is_primary: index === 0,
      display_order: index,
    }));

    try {
      if (isEditing && id) {
        await updateProduct.mutateAsync({
          productId: id,
          product: productData,
          images: imageData,
        });
      } else {
        await createProduct.mutateAsync({
          product: productData,
          images: imageData,
        });
      }
      navigate("/vendor/products");
    } finally {
      setSubmitting(false);
    }
  };

  if (isEditing && productLoading) {
    return (
      <VendorLayout title="Edit Product">
        <div className="max-w-2xl space-y-6">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </VendorLayout>
    );
  }

  // New products need phone, exact location and bank account first (the database enforces it too).
  if (!isEditing && setup && !setup.complete) {
    return (
      <VendorLayout title="Add New Product">
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center">
          <p className="font-semibold">Complete your shop setup first</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your {missingSetupItems(setup).join(", ")} in Settings. Then you can list products.
          </p>
          <Button asChild className="mt-4 rounded-full"><Link to="/vendor/settings">Open Settings</Link></Button>
        </div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout title={isEditing ? "Edit Product" : "Add New Product"}>
      <form onSubmit={handleSubmit} className="pb-24 md:pb-6">
        <div className="max-w-2xl mx-auto space-y-4 md:space-y-6">
          {/* Progress Header - Mobile */}
          <div className="md:hidden sticky top-0 z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">
                {isEditing ? "Edit Product" : "New Product"}
              </h2>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {isEditing ? "Save" : "Create"}
              </Button>
            </div>
          </div>

          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">1</span>
                Basic Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm">Product Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  placeholder="e.g. Premium Kaftan Set"
                  required
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="Describe your product - materials, fit, care instructions..."
                  rows={4}
                  className="resize-none"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category" className="text-sm">Category *</Label>
                {categoriesLoading ? (
                  <Skeleton className="h-11 w-full" />
                ) : (
                  <Select
                    value={formData.category_id}
                    onValueChange={(value) =>
                      setFormData((prev) => ({ ...prev, category_id: value }))
                    }
                    required
                  >
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Stock */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">2</span>
                Pricing & Stock
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm">Price (₦) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, price: e.target.value }))
                      }
                      placeholder="0"
                      min="0"
                      step="100"
                      required
                      className="h-11 pl-7"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="compare_at_price" className="text-sm">Compare Price</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
                    <Input
                      id="compare_at_price"
                      type="number"
                      value={formData.compare_at_price}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          compare_at_price: e.target.value,
                        }))
                      }
                      placeholder="0"
                      min="0"
                      step="100"
                      className="h-11 pl-7"
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground">Original price for showing discount</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stock" className="text-sm">Stock Quantity *</Label>
                <Input
                  id="stock"
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      stock_quantity: e.target.value,
                    }))
                  }
                  placeholder="How many do you have?"
                  min="0"
                  required
                  className="h-11"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="sizes" className="text-sm">Sizes</Label>
                  <Input
                    id="sizes"
                    value={formData.sizes}
                    onChange={(e) => setFormData((prev) => ({ ...prev, sizes: e.target.value }))}
                    placeholder="S, M, L, XL"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="colors" className="text-sm">Colours</Label>
                  <Input
                    id="colors"
                    value={formData.colors}
                    onChange={(e) => setFormData((prev) => ({ ...prev, colors: e.target.value }))}
                    placeholder="White, Navy, Gold"
                    className="h-11"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground -mt-2">
                Separate with commas. Leave empty if the item has one size or colour. Buyers must pick one when you list several.
              </p>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">3</span>
                Product Images
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Add up to 6 photos. Shoppers see them in this order and the first is the main photo. Use the arrows to change the order.
              </p>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((image, index) => (
                  <div key={image.url} className="space-y-1.5">
                    <div
                      className={`relative rounded-xl overflow-hidden border-2 aspect-square ${
                        index === 0 ? "border-primary ring-2 ring-primary/20" : "border-border"
                      }`}
                    >
                      <img src={image.url} alt={`Photo ${index + 1}`} className="w-full h-full object-cover" />
                      <span className="absolute top-1 left-1 text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded-full font-medium">
                        {index === 0 ? "Main" : index + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeImage(index)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-black/60 text-white flex items-center justify-center"
                        aria-label={`Remove photo ${index + 1}`}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {images.length > 1 && (
                      <div className="flex items-center justify-between gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                          onClick={() => moveImage(index, index - 1)} disabled={index === 0} aria-label="Move left">
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        {index !== 0 ? (
                          <Button type="button" variant="ghost" size="sm" className="h-7 px-1.5 text-[11px]"
                            onClick={() => moveImage(index, 0)} aria-label="Make main photo">
                            <Star className="h-3 w-3 mr-0.5" />
                            Main
                          </Button>
                        ) : <span />}
                        <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                          onClick={() => moveImage(index, index + 1)} disabled={index === images.length - 1} aria-label="Move right">
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}

                {images.length < 6 && (
                  <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-xl cursor-pointer hover:bg-muted/50 hover:border-primary/50 transition-all">
                    {uploading ? (
                      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    ) : (
                      <>
                        <Upload className="h-6 w-6 text-muted-foreground mb-1" />
                        <span className="text-xs text-muted-foreground">Add Photo</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                      disabled={uploading}
                    />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <span className="flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">4</span>
                Visibility & Features
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex-1">
                  <Label htmlFor="is_active" className="text-sm font-medium">Publish Product</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Make visible to customers
                  </p>
                </div>
                <Switch
                  id="is_active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, is_active: checked }))
                  }
                />
              </div>

              <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    {formData.featured ? "Featured on homepage" : "Homepage promotion"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {isEditing
                      ? "Show this product in the homepage carousel"
                      : "Save the product first, then promote it"}
                  </p>
                </div>
                {isEditing && id && (
                  <Button asChild type="button" size="sm" variant="outline" className="gap-1.5 flex-shrink-0">
                    <Link to={`/vendor/promote?product=${id}`}>
                      <Megaphone className="h-3.5 w-3.5" />
                      Promote
                    </Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Desktop Actions */}
          <div className="hidden md:flex gap-4 pt-2">
            <Button type="submit" size="lg" disabled={submitting} className="gap-2">
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Product"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={() => navigate("/vendor/products")}
            >
              Cancel
            </Button>
          </div>

          {/* Mobile Fixed Actions */}
          <div className="md:hidden fixed bottom-0 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-40">
            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate("/vendor/products")}
              >
                Cancel
              </Button>
              <Button type="submit" className="flex-1 gap-2" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditing ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      </form>

    </VendorLayout>
  );
}
