import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { useVendorProducts } from "@/hooks/useVendorProducts";
import { useVendorOrders } from "@/hooks/useVendorOrders";
import { useProductMutations } from "@/hooks/useProductMutations";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Package,
  ShoppingCart,
  TrendingUp,
  AlertTriangle,
  Plus,
  Pencil,
  Trash2,
  PackageX,
  CheckCircle,
  Store,
  MoreVertical,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function VendorDashboard() {
  const navigate = useNavigate();
  const { userId } = useVendorAuth();
  const { data: products, isLoading: productsLoading, refetch } = useVendorProducts(userId);
  const { orders, isLoading: ordersLoading } = useVendorOrders(userId);
  const { deleteProduct, toggleProductStatus } = useProductMutations(userId);
  const { toast } = useToast();
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [stockEdit, setStockEdit] = useState<{ id: string; name: string; current: number } | null>(null);
  const [newStock, setNewStock] = useState<string>("");

  const totalProducts = products?.length || 0;
  const activeProducts = products?.filter((p) => p.is_active).length || 0;
  const soldOutProducts = products?.filter((p) => p.stock_quantity === 0).length || 0;
  const lowStock = products?.filter((p) => p.stock_quantity > 0 && p.stock_quantity < 5).length || 0;
  
  // Only count paid orders for stats
  const paidOrders = orders?.filter(o => o.payment_status === "paid") || [];
  const totalOrders = paidOrders.length;
  const totalRevenue = paidOrders.reduce((sum, order) => {
    const vendorItems = order.order_items.reduce(
      (itemSum, item) => itemSum + item.quantity * item.unit_price,
      0
    );
    return sum + vendorItems;
  }, 0);

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

  const handleMarkSoldOut = (productId: string) => {
    updateStock(productId, 0);
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

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive" className="text-[10px] px-1.5">Sold Out</Badge>;
    }
    if (quantity < 5) {
      return <Badge variant="outline" className="text-[10px] px-1.5 border-amber-500 text-amber-600">Low</Badge>;
    }
    return <Badge variant="secondary" className="text-[10px] px-1.5">{quantity}</Badge>;
  };

  return (
    <VendorLayout title="Dashboard">
      <div className="space-y-4 md:space-y-6">
        {/* Quick Actions - Mobile optimized */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
          <Button asChild size="sm" className="flex-shrink-0">
            <Link to="/vendor/products/new">
              <Plus className="h-4 w-4 mr-1.5" />
              Add Product
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="flex-shrink-0">
            <Link to="/vendor/products">
              <Package className="h-4 w-4 mr-1.5" />
              All Products
            </Link>
          </Button>
        </div>

        {/* Stats Cards - 2x2 grid on mobile */}
        <div className="grid grid-cols-2 gap-3 md:gap-4 md:grid-cols-4">
          <Card className="p-3 md:p-0">
            <CardHeader className="hidden md:flex md:flex-row md:items-center md:justify-between md:space-y-0 md:pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              {productsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="flex items-center gap-2 md:block">
                    <Package className="h-4 w-4 text-muted-foreground md:hidden" />
                    <div className="text-xl md:text-2xl font-bold">{totalProducts}</div>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                    {activeProducts} active
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="p-3 md:p-0">
            <CardHeader className="hidden md:flex md:flex-row md:items-center md:justify-between md:space-y-0 md:pb-2">
              <CardTitle className="text-sm font-medium">Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              {ordersLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="flex items-center gap-2 md:block">
                    <ShoppingCart className="h-4 w-4 text-muted-foreground md:hidden" />
                    <div className="text-xl md:text-2xl font-bold">{totalOrders}</div>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">All time</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className="p-3 md:p-0">
            <CardHeader className="hidden md:flex md:flex-row md:items-center md:justify-between md:space-y-0 md:pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              {ordersLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="flex items-center gap-2 md:block">
                    <TrendingUp className="h-4 w-4 text-muted-foreground md:hidden" />
                    <div className="text-lg md:text-2xl font-bold truncate">
                      {formatCurrency(totalRevenue)}
                    </div>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">From sales</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={`p-3 md:p-0 ${lowStock > 0 || soldOutProducts > 0 ? "border-amber-300 bg-amber-50/50" : ""}`}>
            <CardHeader className="hidden md:flex md:flex-row md:items-center md:justify-between md:space-y-0 md:pb-2">
              <CardTitle className="text-sm font-medium">Alerts</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${lowStock > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent className="p-0 md:p-6 md:pt-0">
              {productsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="flex items-center gap-2 md:block">
                    <AlertTriangle className={`h-4 w-4 md:hidden ${lowStock > 0 || soldOutProducts > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                    <div className="text-xl md:text-2xl font-bold">{lowStock + soldOutProducts}</div>
                  </div>
                  <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
                    {soldOutProducts} out · {lowStock} low
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Inventory List */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between py-3 md:py-6">
            <CardTitle className="text-base md:text-lg">Inventory</CardTitle>
            <Link to="/vendor/products" className="text-xs md:text-sm text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent className="p-3 md:p-6 pt-0 md:pt-0">
            {productsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : products?.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Store className="h-10 w-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm mb-3">No products yet</p>
                <Button asChild size="sm">
                  <Link to="/vendor/products/new">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Product
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {products?.slice(0, 6).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center gap-3 p-2 md:p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    {/* Product Image */}
                    {product.product_images?.[0] ? (
                      <img
                        src={product.product_images[0].url}
                        alt={product.name}
                        className="h-10 w-10 md:h-12 md:w-12 rounded-md object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-10 w-10 md:h-12 md:w-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                        <Package className="h-4 w-4 md:h-5 md:w-5 text-muted-foreground" />
                      </div>
                    )}
                    
                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{product.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">
                          {formatCurrency(product.price)}
                        </span>
                        {getStockBadge(product.stock_quantity)}
                      </div>
                    </div>
                    
                    {/* Actions Dropdown - Better for mobile */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem asChild>
                          <Link to={`/vendor/products/${product.id}`}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
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
                        {product.stock_quantity > 0 ? (
                          <DropdownMenuItem onClick={() => handleMarkSoldOut(product.id)}>
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
                          onClick={() => toggleProductStatus.mutate({
                            productId: product.id,
                            isActive: !product.is_active,
                          })}
                        >
                          {product.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={() => setDeleteId(product.id)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="max-w-[90vw] md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Product</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this product and cannot be undone.
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
    </VendorLayout>
  );
}
