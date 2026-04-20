import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminProducts } from "@/hooks/useAdminProducts";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Search, Star, Trash2, Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";

const PAGE_SIZE = 20;

export default function AdminProducts() {
  const { products, isLoading, toggleFeatured, toggleActive, deleteProduct } = useAdminProducts();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const navigate = useNavigate();

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / PAGE_SIZE);
  const paginatedProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);

  const handleToggleFeatured = async (productId: string, currentStatus: boolean) => {
    try {
      await toggleFeatured.mutateAsync({ productId, featured: !currentStatus });
      toast.success(currentStatus ? "Product unfeatured" : "Product featured");
    } catch {
      toast.error("Failed to update product");
    }
  };

  const handleToggleActive = async (productId: string, currentStatus: boolean) => {
    try {
      await toggleActive.mutateAsync({ productId, isActive: !currentStatus });
      toast.success(currentStatus ? "Product deactivated" : "Product activated");
    } catch {
      toast.error("Failed to update product");
    }
  };

  const handleDelete = async (productId: string) => {
    try {
      await deleteProduct.mutateAsync(productId);
      toast.success("Product deleted");
    } catch {
      toast.error("Failed to delete product");
    }
  };

  return (
    <AdminLayout title="Products">
      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button onClick={() => navigate("/admin/products/new")} className="gap-2 flex-shrink-0">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Add Product</span>
        </Button>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3 mb-20">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
        ) : filteredProducts.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-muted-foreground mb-4">No products yet</p>
            <Button onClick={() => navigate("/admin/products/new")} className="gap-2">
              <Plus className="h-4 w-4" /> Add First Product
            </Button>
          </div>
        ) : (
          paginatedProducts.map((product) => (
            <div key={product.id} className="bg-card rounded-lg p-4 border">
              <div className="flex gap-3">
                <div className="h-16 w-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                  {product.product_images[0] ? (
                    <img src={product.product_images[0].url} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">No img</div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link to={`/products/${product.slug}`} className="font-medium hover:underline line-clamp-1 text-sm">
                    {product.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{product.category?.name || "Uncategorized"}</p>
                  <p className="font-semibold mt-1 text-sm">{formatCurrency(Number(product.price))}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3">
                <Badge variant={product.is_active ? "default" : "secondary"}>
                  {product.is_active ? "Active" : "Inactive"}
                </Badge>
                {product.featured && (
                  <Badge className="bg-yellow-100 text-yellow-800 gap-1">
                    <Star className="h-3 w-3" /> Featured
                  </Badge>
                )}
                <span className="text-xs text-muted-foreground ml-auto">Stock: {product.stock_quantity}</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={product.featured} onCheckedChange={() => handleToggleFeatured(product.id, product.featured)} />
                    Featured
                  </label>
                  <label className="flex items-center gap-2 text-xs">
                    <Switch checked={product.is_active} onCheckedChange={() => handleToggleActive(product.id, product.is_active)} />
                    Active
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => navigate(`/admin/products/${product.id}/edit`)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button size="sm" variant="destructive"><Trash2 className="h-3.5 w-3.5" /></Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Product?</AlertDialogTitle>
                        <AlertDialogDescription>This will permanently delete "{product.name}".</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleDelete(product.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Mobile pagination */}
      <div className="md:hidden mb-20">
        <AdminPagination page={page} totalPages={totalPages} totalItems={filteredProducts.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Featured</TableHead>
              <TableHead>Active</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <TableRow key={i}>
                  <TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell>
                </TableRow>
              ))
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No products found. <Button variant="link" onClick={() => navigate("/admin/products/new")}>Add your first product</Button>
                </TableCell>
              </TableRow>
            ) : (
              paginatedProducts.map((product) => (
                <TableRow key={product.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {product.product_images[0] ? (
                          <img src={product.product_images[0].url} alt={product.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-xs">N/A</div>
                        )}
                      </div>
                      <Link to={`/products/${product.slug}`} className="font-medium hover:underline line-clamp-1">
                        {product.name}
                      </Link>
                    </div>
                  </TableCell>
                  <TableCell>{product.category?.name || "—"}</TableCell>
                  <TableCell>{formatCurrency(Number(product.price))}</TableCell>
                  <TableCell>{product.stock_quantity}</TableCell>
                  <TableCell>
                    <Switch checked={product.featured} onCheckedChange={() => handleToggleFeatured(product.id, product.featured)} />
                  </TableCell>
                  <TableCell>
                    <Switch checked={product.is_active} onCheckedChange={() => handleToggleActive(product.id, product.is_active)} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button size="sm" variant="ghost" onClick={() => navigate(`/admin/products/${product.id}/edit`)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="sm" variant="ghost" className="text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Product?</AlertDialogTitle>
                            <AlertDialogDescription>This will permanently delete "{product.name}". This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(product.id)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="hidden md:block">
        <AdminPagination page={page} totalPages={totalPages} totalItems={filteredProducts.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}
