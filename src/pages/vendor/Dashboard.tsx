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
  User,
  Store,
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
  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum, order) => {
    const vendorItems = order.order_items.reduce(
      (itemSum, item) => itemSum + item.quantity * item.unit_price,
      0
    );
    return sum + vendorItems;
  }, 0) || 0;

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
      return <Badge variant="destructive" className="text-xs">Sold Out</Badge>;
    }
    if (quantity < 5) {
      return <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">Low Stock</Badge>;
    }
    return <Badge variant="secondary" className="text-xs">{quantity} in stock</Badge>;
  };

  return (
    <VendorLayout title="Dashboard">
      <div className="space-y-6">
        {/* Account Switcher */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            <Button asChild>
              <Link to="/vendor/products/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Product
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link to="/vendor/products">
                <Package className="h-4 w-4 mr-2" />
                All Products
              </Link>
            </Button>
          </div>
          <Button variant="ghost" onClick={() => navigate("/account")}>
            <User className="h-4 w-4 mr-2" />
            Switch to Shopper
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Products</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{totalProducts}</div>
                  <p className="text-xs text-muted-foreground">
                    {activeProducts} active
                  </p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <ShoppingCart className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{totalOrders}</div>
                  <p className="text-xs text-muted-foreground">All time</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Revenue</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <Skeleton className="h-8 w-24" />
              ) : (
                <>
                  <div className="text-2xl font-bold">
                    {formatCurrency(totalRevenue)}
                  </div>
                  <p className="text-xs text-muted-foreground">From sales</p>
                </>
              )}
            </CardContent>
          </Card>

          <Card className={lowStock > 0 ? "border-amber-300 bg-amber-50/50" : ""}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inventory Alerts</CardTitle>
              <AlertTriangle className={`h-4 w-4 ${lowStock > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            </CardHeader>
            <CardContent>
              {productsLoading ? (
                <Skeleton className="h-8 w-16" />
              ) : (
                <>
                  <div className="text-2xl font-bold">{lowStock + soldOutProducts}</div>
                  <p className="text-xs text-muted-foreground">
                    {soldOutProducts} sold out · {lowStock} low stock
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Inventory Quick Actions */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Inventory Management</CardTitle>
            <Link to="/vendor/products" className="text-sm text-primary hover:underline">
              View all →
            </Link>
          </CardHeader>
          <CardContent>
            {productsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : products?.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Store className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="mb-4">No products yet. Start building your inventory.</p>
                <Button asChild>
                  <Link to="/vendor/products/new">
                    <Plus className="h-4 w-4 mr-2" />
                    Add First Product
                  </Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {products?.slice(0, 8).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {product.product_images?.[0] ? (
                        <img
                          src={product.product_images[0].url}
                          alt={product.name}
                          className="h-12 w-12 rounded-md object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center flex-shrink-0">
                          <Package className="h-5 w-5 text-muted-foreground" />
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{product.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-muted-foreground">
                            {formatCurrency(product.price)}
                          </span>
                          {getStockBadge(product.stock_quantity)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1 ml-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setStockEdit({
                            id: product.id,
                            name: product.name,
                            current: product.stock_quantity,
                          });
                          setNewStock(product.stock_quantity.toString());
                        }}
                        title="Update stock"
                      >
                        <Package className="h-4 w-4" />
                      </Button>
                      
                      {product.stock_quantity > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkSoldOut(product.id)}
                          title="Mark sold out"
                        >
                          <PackageX className="h-4 w-4" />
                        </Button>
                      )}
                      
                      {product.stock_quantity === 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setStockEdit({
                              id: product.id,
                              name: product.name,
                              current: 0,
                            });
                            setNewStock("10");
                          }}
                          title="Restock"
                          className="text-green-600 hover:text-green-700"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleProductStatus.mutate({
                          productId: product.id,
                          isActive: !product.is_active,
                        })}
                        title={product.is_active ? "Deactivate" : "Activate"}
                      >
                        {product.is_active ? (
                          <span className="h-2 w-2 rounded-full bg-green-500" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-muted-foreground" />
                        )}
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        asChild
                      >
                        <Link to={`/vendor/products/${product.id}`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      </Button>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(product.id)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
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
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Update Stock</DialogTitle>
            <DialogDescription>
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
          <DialogFooter>
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
