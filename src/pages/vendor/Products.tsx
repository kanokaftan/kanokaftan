import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { useVendorProducts } from "@/hooks/useVendorProducts";
import { useProductMutations } from "@/hooks/useProductMutations";
import { useFeaturedListing } from "@/hooks/useFeaturedListing";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Package, Plus, MoreVertical, Pencil, Trash2, Eye, EyeOff, PackageX, CheckCircle, Star, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";

export default function VendorProducts() {
  const { userId } = useVendorAuth();
  const { user } = useAuth();
  const { data: products, isLoading, refetch } = useVendorProducts(userId);
  const { deleteProduct, toggleProductStatus } = useProductMutations(userId);
  const { toast } = useToast();
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [stockEdit, setStockEdit] = useState<{ id: string; name: string; current: number } | null>(null);
  const [newStock, setNewStock] = useState<string>("");
  const [featuredProduct, setFeaturedProduct] = useState<{ id: string; name: string } | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"payment" | "promo">("payment");

  const { isProcessing, applyPromoCode, initPayment } = useFeaturedListing({
    onSuccess: () => {
      setFeaturedProduct(null);
      setPromoCode("");
      refetch();
    },
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const handleDelete = () => {
    if (deleteId) {
      deleteProduct.mutate(deleteId);
      setDeleteId(null);
    }
  };

  const updateStock = async (productId: string, quantity: number) => {
    const { error } = await supabase
      .from("products")
      .update({ stock_quantity: quantity })
      .eq("id", productId);

    if (error) {
      toast({
        title: "Error updating stock",
        description: error.message,
        variant: "destructive",
      });
    } else {
      toast({
        title: quantity === 0 ? "Marked as sold out" : "Stock updated",
        description: quantity === 0 ? "Product is now marked as sold out" : `Stock updated to ${quantity} units`,
      });
      refetch();
    }
  };

  const handleStockUpdate = () => {
    if (stockEdit && newStock !== "") {
      updateStock(stockEdit.id, parseInt(newStock, 10));
      setStockEdit(null);
      setNewStock("");
    }
  };

  const handleFeatureProduct = async () => {
    if (!featuredProduct) return;

    if (paymentMethod === "promo") {
      const success = await applyPromoCode(featuredProduct.id, promoCode);
      if (success) {
        setFeaturedProduct(null);
        setPromoCode("");
      }
    } else {
      const email = user?.email;
      if (!email) {
        toast({
          title: "Email required",
          description: "Please ensure you have an email associated with your account.",
          variant: "destructive",
        });
        return;
      }
      
      const callbackUrl = `${window.location.origin}/vendor/products?featured_ref=`;
      const authUrl = await initPayment(featuredProduct.id, email, callbackUrl);
      
      if (authUrl) {
        window.location.href = authUrl;
      }
    }
  };

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive" className="text-[10px] px-1.5">Sold Out</Badge>;
    }
    if (quantity < 5) {
      return <Badge variant="outline" className="text-[10px] px-1.5 border-amber-500 text-amber-600">{quantity} left</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] px-1.5">{quantity}</Badge>;
  };

  return (
    <VendorLayout title="Products">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground hidden md:block">
            Manage your product listings
          </p>
          <Button asChild size="sm" className="ml-auto">
            <Link to="/vendor/products/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Product
            </Link>
          </Button>
        </div>

        {/* Products List - Mobile Card Layout */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : products?.length === 0 ? (
          <Card className="text-center py-12 px-4">
            <Package className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="font-semibold mb-2">No products yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Start by adding your first product listing
            </p>
            <Button asChild size="sm">
              <Link to="/vendor/products/new">
                <Plus className="h-4 w-4 mr-1.5" />
                Add Your First Product
              </Link>
            </Button>
          </Card>
        ) : (
          <div className="space-y-2">
            {products?.map((product) => (
              <Card key={product.id} className="p-3">
                <div className="flex items-start gap-3">
                  {/* Product Image */}
                  <div className="relative flex-shrink-0">
                    {product.product_images?.[0] ? (
                      <img
                        src={product.product_images[0].url}
                        alt={product.name}
                        className="h-16 w-16 rounded-lg object-cover"
                      />
                    ) : (
                      <div className="h-16 w-16 rounded-lg bg-muted flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                    {product.featured && (
                      <Star className="absolute -top-1 -right-1 h-4 w-4 text-amber-500 fill-amber-500" />
                    )}
                  </div>
                  
                  {/* Product Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{product.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {product.category?.name || "Uncategorized"}
                        </p>
                      </div>
                      
                      {/* Actions */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0 -mt-1 -mr-1">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem asChild>
                            <Link to={`/vendor/products/${product.id}`}>
                              <Pencil className="h-4 w-4 mr-2" />
                              Edit Product
                            </Link>
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem
                            onClick={() => {
                              setStockEdit({
                                id: product.id,
                                name: product.name,
                                current: product.stock_quantity,
                              });
                              setNewStock(product.stock_quantity.toString());
                            }}
                          >
                            <Package className="h-4 w-4 mr-2" />
                            Update Stock
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          {!product.featured && (
                            <DropdownMenuItem
                              onClick={() => setFeaturedProduct({ id: product.id, name: product.name })}
                              className="text-amber-600"
                            >
                              <Star className="h-4 w-4 mr-2" />
                              Make Featured (₦1,000)
                            </DropdownMenuItem>
                          )}
                          
                          {product.stock_quantity > 0 ? (
                            <DropdownMenuItem
                              onClick={() => updateStock(product.id, 0)}
                            >
                              <PackageX className="h-4 w-4 mr-2" />
                              Mark Sold Out
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem
                              onClick={() => {
                                setStockEdit({
                                  id: product.id,
                                  name: product.name,
                                  current: 0,
                                });
                                setNewStock("10");
                              }}
                            >
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Restock
                            </DropdownMenuItem>
                          )}
                          
                          <DropdownMenuItem
                            onClick={() =>
                              toggleProductStatus.mutate({
                                productId: product.id,
                                isActive: !product.is_active,
                              })
                            }
                          >
                            {product.is_active ? (
                              <>
                                <EyeOff className="h-4 w-4 mr-2" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Activate
                              </>
                            )}
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setDeleteId(product.id)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete Product
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    {/* Price & Status Row */}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="font-semibold text-sm">{formatCurrency(product.price)}</span>
                      {getStockBadge(product.stock_quantity)}
                      <Badge
                        variant={product.is_active ? "default" : "secondary"}
                        className={`text-[10px] px-1.5 ${product.is_active ? "bg-green-600" : ""}`}
                      >
                        {product.is_active ? "Active" : "Inactive"}
                      </Badge>
                      {product.featured && (
                        <Badge className="bg-amber-500 text-[10px] px-1.5">Featured</Badge>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[90vw] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this product. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Stock Update Dialog */}
      <Dialog open={!!stockEdit} onOpenChange={() => setStockEdit(null)}>
        <DialogContent className="max-w-[90vw] md:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
            <DialogDescription className="truncate">
              {stockEdit?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="stock">Stock Quantity</Label>
            <Input
              id="stock"
              type="number"
              min="0"
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              className="mt-2"
              placeholder="Enter new stock quantity"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setStockEdit(null)}>
              Cancel
            </Button>
            <Button onClick={handleStockUpdate}>
              Update Stock
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Featured Listing Dialog */}
      <Dialog open={!!featuredProduct} onOpenChange={() => setFeaturedProduct(null)}>
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
              <p className="font-medium text-sm truncate">{featuredProduct?.name}</p>
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
                  You'll be redirected to Paystack to complete the payment securely.
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
            <Button variant="outline" onClick={() => setFeaturedProduct(null)}>
              Cancel
            </Button>
            <Button 
              onClick={handleFeatureProduct}
              disabled={isProcessing || (paymentMethod === "promo" && !promoCode)}
              className="bg-amber-500 hover:bg-amber-600"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processing...
                </>
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
