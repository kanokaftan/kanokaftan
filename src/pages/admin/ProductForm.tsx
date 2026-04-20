import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useCategories } from "@/hooks/useProducts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, X, Loader2, Star } from "lucide-react";
import { toast } from "sonner";

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .concat("-", Date.now().toString(36));
}

export default function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const isEditing = !!id;

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
  const [images, setImages] = useState<{ url: string; is_primary: boolean }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(isEditing);

  useEffect(() => {
    if (!isEditing) return;
    const load = async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*, product_images(url, is_primary, display_order)")
        .eq("id", id)
        .single();
      if (error) { toast.error("Failed to load product"); return; }
      if (data) {
        setFormData({
          name: data.name,
          description: data.description || "",
          price: data.price.toString(),
          compare_at_price: data.compare_at_price?.toString() || "",
          stock_quantity: data.stock_quantity.toString(),
          category_id: data.category_id || "",
          is_active: data.is_active,
          featured: data.featured,
          sizes: (data.sizes || []).join(", "),
          colors: (data.colors || []).join(", "),
        });
        setImages(
          (data.product_images || [])
            .sort((a: any, b: any) => a.display_order - b.display_order)
            .map((img: any) => ({ url: img.url, is_primary: img.is_primary }))
        );
      }
      setLoadingProduct(false);
    };
    load();
  }, [id, isEditing]);

  const uploadImage = async (file: File): Promise<string> => {
    const ext = file.name.split(".").pop();
    const fileName = `${user?.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("product-images").upload(fileName, file, { upsert: true });
    if (error) throw error;
    return supabase.storage.from("product-images").getPublicUrl(fileName).data.publicUrl;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    try {
      const uploads = await Promise.all(
        Array.from(files).map(async (file) => ({
          url: await uploadImage(file),
          is_primary: images.length === 0,
        }))
      );
      setImages((prev) => [...prev, ...uploads]);
    } catch {
      toast.error("Image upload failed");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      if (prev[index].is_primary && updated.length > 0) updated[0].is_primary = true;
      return updated;
    });
  };

  const setPrimaryImage = (index: number) =>
    setImages((prev) => prev.map((img, i) => ({ ...img, is_primary: i === index })));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSubmitting(true);

    const productPayload = {
      name: formData.name,
      description: formData.description,
      price: parseFloat(formData.price),
      compare_at_price: formData.compare_at_price ? parseFloat(formData.compare_at_price) : null,
      stock_quantity: parseInt(formData.stock_quantity),
      category_id: formData.category_id || null,
      is_active: formData.is_active,
      featured: formData.featured,
      sizes: formData.sizes.split(",").map((s) => s.trim()).filter(Boolean),
      colors: formData.colors.split(",").map((c) => c.trim()).filter(Boolean),
    };

    const imageData = images.map((img, i) => ({
      url: img.url,
      is_primary: img.is_primary,
      display_order: i,
    }));

    try {
      if (isEditing) {
        const { error } = await supabase.from("products").update(productPayload).eq("id", id);
        if (error) throw error;
        await supabase.from("product_images").delete().eq("product_id", id);
        if (imageData.length > 0) {
          const { error: imgErr } = await supabase.from("product_images").insert(
            imageData.map((img) => ({ ...img, product_id: id }))
          );
          if (imgErr) throw imgErr;
        }
        toast.success("Product updated");
      } else {
        const slug = generateSlug(formData.name);
        const { data: newProduct, error } = await supabase
          .from("products")
          .insert({ ...productPayload, slug })
          .select()
          .single();
        if (error) throw error;
        if (imageData.length > 0) {
          await supabase.from("product_images").insert(
            imageData.map((img) => ({ ...img, product_id: newProduct.id }))
          );
        }
        toast.success("Product created");
      }
      navigate("/admin/products");
    } catch (err: any) {
      toast.error(err.message || "Failed to save product");
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingProduct) {
    return (
      <AdminLayout title="Edit Product">
        <div className="max-w-2xl space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title={isEditing ? "Edit Product" : "Add Product"}>
      <form onSubmit={handleSubmit} className="pb-24 md:pb-6">
        <div className="max-w-2xl mx-auto space-y-4">

          {/* Mobile sticky header */}
          <div className="md:hidden sticky top-14 z-10 bg-background/95 backdrop-blur -mx-4 px-4 py-3 border-b">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold">{isEditing ? "Edit Product" : "New Product"}</h2>
              <Button type="submit" size="sm" disabled={submitting}>
                {submitting && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                {isEditing ? "Save" : "Create"}
              </Button>
            </div>
          </div>

          {/* Basic Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Basic Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Product Name *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Premium Kaftan Set"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData((p) => ({ ...p, description: e.target.value }))}
                  placeholder="Materials, fit, care instructions..."
                  rows={4}
                  className="resize-none"
                />
              </div>
              <div className="space-y-2">
                <Label>Category</Label>
                {categoriesLoading ? (
                  <Skeleton className="h-10 w-full" />
                ) : (
                  <Select
                    value={formData.category_id}
                    onValueChange={(v) => setFormData((p) => ({ ...p, category_id: v }))}
                  >
                    <SelectTrigger><SelectValue placeholder="Select a category" /></SelectTrigger>
                    <SelectContent>
                      {categories?.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Sizes (comma separated)</Label>
                  <Input
                    value={formData.sizes}
                    onChange={(e) => setFormData((p) => ({ ...p, sizes: e.target.value }))}
                    placeholder="S, M, L, XL"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Colors (comma separated)</Label>
                  <Input
                    value={formData.colors}
                    onChange={(e) => setFormData((p) => ({ ...p, colors: e.target.value }))}
                    placeholder="White, Blue, Gold"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pricing & Stock */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Pricing & Stock</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Price (₦) *</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
                    <Input
                      type="number"
                      value={formData.price}
                      onChange={(e) => setFormData((p) => ({ ...p, price: e.target.value }))}
                      placeholder="0"
                      min="0"
                      step="100"
                      required
                      className="pl-7"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Compare Price (₦)</Label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">₦</span>
                    <Input
                      type="number"
                      value={formData.compare_at_price}
                      onChange={(e) => setFormData((p) => ({ ...p, compare_at_price: e.target.value }))}
                      placeholder="0"
                      min="0"
                      step="100"
                      className="pl-7"
                    />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Stock Quantity *</Label>
                <Input
                  type="number"
                  value={formData.stock_quantity}
                  onChange={(e) => setFormData((p) => ({ ...p, stock_quantity: e.target.value }))}
                  placeholder="0"
                  min="0"
                  required
                />
              </div>
            </CardContent>
          </Card>

          {/* Images */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Product Images</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Up to 6 images. Tap to set primary.</p>
              <div className="grid grid-cols-3 gap-3">
                {images.map((image, index) => (
                  <div
                    key={index}
                    className={`relative group rounded-xl overflow-hidden border-2 aspect-square ${
                      image.is_primary ? "border-primary ring-2 ring-primary/20" : "border-border"
                    }`}
                  >
                    <img src={image.url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      {!image.is_primary && (
                        <Button type="button" size="sm" variant="secondary" onClick={() => setPrimaryImage(index)} className="w-full text-xs h-8">
                          Set Main
                        </Button>
                      )}
                      <Button type="button" size="sm" variant="destructive" onClick={() => removeImage(index)} className="w-full text-xs h-8">
                        <X className="h-3 w-3 mr-1" /> Remove
                      </Button>
                    </div>
                    {image.is_primary && (
                      <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-medium">Main</span>
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
                    <input type="file" accept="image/*" multiple className="hidden" onChange={handleImageUpload} disabled={uploading} />
                  </label>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Visibility */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Visibility</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div>
                  <p className="text-sm font-medium">Published</p>
                  <p className="text-xs text-muted-foreground">Visible to customers</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(v) => setFormData((p) => ({ ...p, is_active: v }))}
                />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                  <div>
                    <p className="text-sm font-medium">Featured</p>
                    <p className="text-xs text-muted-foreground">Show on homepage highlights</p>
                  </div>
                </div>
                <Switch
                  checked={formData.featured}
                  onCheckedChange={(v) => setFormData((p) => ({ ...p, featured: v }))}
                />
              </div>
            </CardContent>
          </Card>

          {/* Desktop actions */}
          <div className="hidden md:flex gap-4 pt-2">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {isEditing ? "Save Changes" : "Create Product"}
            </Button>
            <Button type="button" variant="outline" size="lg" onClick={() => navigate("/admin/products")}>
              Cancel
            </Button>
          </div>

          {/* Mobile fixed actions */}
          <div className="md:hidden fixed bottom-14 left-0 right-0 p-4 bg-background/95 backdrop-blur border-t z-40">
            <div className="flex gap-3">
              <Button type="button" variant="outline" className="flex-1" onClick={() => navigate("/admin/products")}>
                Cancel
              </Button>
              <Button type="submit" className="flex-1" disabled={submitting}>
                {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isEditing ? "Save" : "Create"}
              </Button>
            </div>
          </div>
        </div>
      </form>
    </AdminLayout>
  );
}
