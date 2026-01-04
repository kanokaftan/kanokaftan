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
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Enter product name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, description: e.target.value }))
                }
                placeholder="Describe your product"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              {categoriesLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : (
                <Select
                  value={formData.category_id}
                  onValueChange={(value) =>
                    setFormData((prev) => ({ ...prev, category_id: value }))
                  }
                  required
                >
                  <SelectTrigger>
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
          <CardHeader>
            <CardTitle>Pricing & Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="price">Price (₦) *</Label>
                <Input
                  id="price"
                  type="number"
                  value={formData.price}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, price: e.target.value }))
                  }
                  placeholder="0"
                  min="0"
                  step="0.01"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="compare_at_price">Compare at Price (₦)</Label>
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
                  step="0.01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="stock">Stock Quantity *</Label>
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
                placeholder="0"
                min="0"
                required
              />
            </div>
          </CardContent>
        </Card>

        {/* Images */}
        <Card>
          <CardHeader>
            <CardTitle>Product Images</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-4 gap-4">
              {images.map((image, index) => (
                <div
                  key={index}
                  className={`relative group rounded-lg overflow-hidden border-2 ${
                    image.is_primary ? "border-primary" : "border-transparent"
                  }`}
                >
                  <img
                    src={image.url}
                    alt={`Product ${index + 1}`}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {!image.is_primary && (
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setPrimaryImage(index)}
                      >
                        Primary
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="destructive"
                      onClick={() => removeImage(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  {image.is_primary && (
                    <span className="absolute top-2 left-2 text-xs bg-primary text-primary-foreground px-2 py-1 rounded">
                      Primary
                    </span>
                  )}
                </div>
              ))}

              <label className="flex flex-col items-center justify-center aspect-square border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                {uploading ? (
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <span className="text-sm text-muted-foreground">Upload</span>
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
            </div>
          </CardContent>
        </Card>

        {/* Status */}
        <Card>
          <CardHeader>
            <CardTitle>Visibility</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="is_active">Active</Label>
                <p className="text-sm text-muted-foreground">
                  Product is visible to customers
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

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="featured" className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-amber-500" />
                  Featured (₦1,000)
                </Label>
                <p className="text-sm text-muted-foreground">
                  Show in featured products section
                </p>
              </div>
              <Switch
                id="featured"
                checked={formData.featured}
                disabled={formData.featured} // Can't toggle off if already featured
                onCheckedChange={(checked) => {
                  if (checked && !formData.featured) {
                    // If turning on and not already featured, show payment dialog
                    setShowFeaturedDialog(true);
                  }
                }}
              />
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-4">
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {isEditing ? "Save Changes" : "Create Product"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/vendor/products")}
          >
            Cancel
          </Button>
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
