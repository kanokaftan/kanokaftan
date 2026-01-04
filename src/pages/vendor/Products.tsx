import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { useVendorProducts } from "@/hooks/useVendorProducts";
import { useProductMutations } from "@/hooks/useProductMutations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { Package, Plus, MoreHorizontal, Pencil, Trash2, Eye, EyeOff, PackageX, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export default function VendorProducts() {
  const { userId } = useVendorAuth();
  const { data: products, isLoading, refetch } = useVendorProducts(userId);
  const { deleteProduct, toggleProductStatus } = useProductMutations(userId);
  const { toast } = useToast();
  
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [stockEdit, setStockEdit] = useState<{ id: string; name: string; current: number } | null>(null);
  const [newStock, setNewStock] = useState<string>("");

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

  const getStockBadge = (quantity: number) => {
    if (quantity === 0) {
      return <Badge variant="destructive" className="text-xs">Sold Out</Badge>;
    }
    if (quantity < 5) {
      return <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">{quantity} left</Badge>;
    }
    return <span className="text-sm">{quantity}</span>;
  };

  return (
    <VendorLayout title="Products">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <p className="text-muted-foreground">
            Manage your product listings
          </p>
          <Button asChild>
            <Link to="/vendor/products/new">
              <Plus className="h-4 w-4 mr-2" />
              Add Product
            </Link>
          </Button>
        </div>

        {/* Products Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : products?.length === 0 ? (
          <div className="text-center py-16 border rounded-lg bg-background">
            <Package className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
            <h3 className="text-lg font-semibold mb-2">No products yet</h3>
            <p className="text-muted-foreground mb-6">
              Start by adding your first product listing
            </p>
            <Button asChild>
              <Link to="/vendor/products/new">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Product
              </Link>
            </Button>
          </div>
        ) : (
          <div className="border rounded-lg bg-background overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[70px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => (
                  <TableRow key={product.id} className="group">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {product.product_images?.[0] ? (
                          <img
                            src={product.product_images[0].url}
                            alt={product.name}
                            className="h-12 w-12 rounded-md object-cover"
                          />
                        ) : (
                          <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground truncate max-w-[200px]">
                            {product.description || "No description"}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {product.category?.name || "Uncategorized"}
                    </TableCell>
                    <TableCell>{formatCurrency(product.price)}</TableCell>
                    <TableCell>
                      {getStockBadge(product.stock_quantity)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={product.is_active ? "default" : "secondary"}
                        className={product.is_active ? "bg-green-600 hover:bg-green-700" : ""}
                      >
                        {product.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreHorizontal className="h-4 w-4" />
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
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
