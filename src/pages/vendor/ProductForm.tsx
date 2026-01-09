import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { useVendorProduct } from "@/hooks/useVendorProducts";
import { useProductMutations } from "@/hooks/useProductMutations";
import { useCategories } from "@/hooks/useProducts";
import { useFeaturedListing } from "@/hooks/useFeaturedListing";
import { useAuth } from "@/contexts/AuthContext";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Upload, X, Loader2, Star } from "lucide-react";

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useVendorAuth();
  const { user } = useAuth();
  const { data: existingProduct, isLoading: productLoading } = useVendorProduct(id || null);
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { createProduct, updateProduct, uploadImage } = useProductMutations(userId);

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
  });

  const [images, setImages] = useState<{ url: string; is_primary: boolean }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // Featured listing state
  const [showFeaturedDialog, setShowFeaturedDialog] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"payment" | "promo">("payment");
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);

  const { isProcessing, applyPromoCode, initPayment } = useFeaturedListing({
    onSuccess: () => {
      setShowFeaturedDialog(false);
      setPromoCode("");
      setFormData((prev) => ({ ...prev, featured: true }));
    },
  });


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
      });
      setImages(
        existingProduct.product_images?.map((img: any) => ({
          url: img.url,
          is_primary: img.is_primary,
        })) || []
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
        return { url, is_primary: images.length === 0 };
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
    setImages((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      // If we removed the primary image, make the first one primary
      if (prev[index].is_primary && updated.length > 0) {
        updated[0].is_primary = true;
      }
      return updated;
    });
  };

  const setPrimaryImage = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) => ({
        ...img,
        is_primary: i === index,
      }))
    );
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
      featured: formData.featured,
    };

    const imageData = images.map((img, index) => ({
      url: img.url,
      is_primary: img.is_primary,
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
                Add up to 6 images. First image will be the main product photo.
              </p>
              <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
                {images.map((image, index) => (
                  <div
                    key={index}
                    className={`relative group rounded-xl overflow-hidden border-2 aspect-square ${
                      image.is_primary ? "border-primary ring-2 ring-primary/20" : "border-border"
                    }`}
                  >
                    <img
                      src={image.url}
                      alt={`Product ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 p-2">
                      {!image.is_primary && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => setPrimaryImage(index)}
                          className="w-full text-xs h-8"
                        >
                          Set Primary
                        </Button>
                      )}
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => removeImage(index)}
                        className="w-full text-xs h-8"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Remove
                      </Button>
                    </div>
                    {image.is_primary && (
                      <span className="absolute top-1 left-1 text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-medium">
                        Main
                      </span>
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

              <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <div className="flex-1">
                  <Label htmlFor="featured" className="text-sm font-medium flex items-center gap-2">
                    <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    Featured Listing
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Boost visibility for ₦1,000
                  </p>
                </div>
                <Switch
                  id="featured"
                  checked={formData.featured}
                  disabled={formData.featured}
                  onCheckedChange={(checked) => {
                    if (checked && !formData.featured) {
                      setShowFeaturedDialog(true);
                    }
                  }}
                />
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

      {/* Featured Listing Payment Dialog */}
      <Dialog open={showFeaturedDialog} onOpenChange={setShowFeaturedDialog}>
        <DialogContent className="max-w-[90vw] md:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Star className="h-5 w-5 text-amber-500" />
              Feature Your Listing
            </DialogTitle>
            <DialogDescription>
              Featured products appear at the top of search results and homepage.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <div className="p-3 mb-4 rounded-lg bg-muted">
              <p className="font-medium text-sm truncate">{formData.name || "New Product"}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Cost: <span className="font-semibold text-foreground">₦1,000</span>
              </p>
            </div>
            
            <Tabs value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as "payment" | "promo")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="payment" className="text-xs">Pay with Paystack</TabsTrigger>
                <TabsTrigger value="promo" className="text-xs">Use Promo Code</TabsTrigger>
              </TabsList>
              
              <TabsContent value="payment" className="mt-4">
                <p className="text-sm text-muted-foreground">
                  {isEditing 
                    ? "You'll be redirected to Paystack to complete the payment securely."
                    : "Save the product first, then you can feature it from the Products page."
                  }
                </p>
              </TabsContent>
              
              <TabsContent value="promo" className="mt-4">
                <Label htmlFor="promoCode">Promo Code</Label>
                <Input
                  id="promoCode"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                  placeholder="Enter promo code"
                  className="mt-2"
                />
              </TabsContent>
            </Tabs>
          </div>
          
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowFeaturedDialog(false)}>
              Cancel
            </Button>
            <Button 
              onClick={async () => {
                if (!isEditing) {
                  // For new products, just close dialog - they need to save first
                  setShowFeaturedDialog(false);
                  return;
                }
                
                if (paymentMethod === "promo" && id) {
                  const success = await applyPromoCode(id, promoCode);
                  if (success) {
                    setFormData((prev) => ({ ...prev, featured: true }));
                  }
                } else if (id) {
                  const email = user?.email;
                  if (email) {
                    const callbackUrl = `${window.location.origin}/vendor/products?reference=`;
                    const authUrl = await initPayment(id, email, callbackUrl);
                    if (authUrl) {
                      window.location.href = authUrl;
                    }
                  }
                }
              }}
              disabled={isProcessing || (paymentMethod === "promo" && !promoCode) || !isEditing}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : !isEditing ? (
                "Save Product First"
              ) : paymentMethod === "promo" ? (
                "Apply Code"
              ) : (
                "Pay ₦1,000"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </VendorLayout>
  );
}
