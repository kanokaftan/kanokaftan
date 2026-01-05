import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminVendors, AdminVendor } from "@/hooks/useAdminVendors";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search, BadgeCheck, Package, Wallet, Eye, Store } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { VendorDetailModal } from "@/components/admin/VendorDetailModal";

export default function AdminVendors() {
  const { vendors, isLoading, verifyVendor } = useAdminVendors();
  const [search, setSearch] = useState("");
  const [selectedVendor, setSelectedVendor] = useState<AdminVendor | null>(null);

  const filteredVendors = vendors.filter(vendor => 
    vendor.store_name?.toLowerCase().includes(search.toLowerCase()) ||
    vendor.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    vendor.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleVerify = async (vendorId: string, currentStatus: boolean) => {
    try {
      await verifyVendor.mutateAsync({ vendorId, isVerified: !currentStatus });
      toast.success(currentStatus ? "Vendor unverified" : "Vendor verified successfully");
      setSelectedVendor(null);
    } catch (error) {
      toast.error("Failed to update vendor verification");
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  // Stats
  const stats = {
    total: vendors.length,
    verified: vendors.filter(v => v.is_verified).length,
    pending: vendors.filter(v => !v.is_verified).length,
    totalSales: vendors.reduce((sum, v) => sum + v.total_sales, 0),
  };

  return (
    <AdminLayout title="Vendors">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <Store className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.total}</p>
                <p className="text-xs text-muted-foreground">Total Vendors</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-green-500/20">
                <BadgeCheck className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{stats.verified}</p>
                <p className="text-xs text-muted-foreground">Verified</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-amber-500/20">
                <Store className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-amber-600">{stats.pending}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-500/20">
                <Wallet className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-blue-600">{formatCurrency(stats.totalSales)}</p>
                <p className="text-xs text-muted-foreground">Total Sales</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search vendors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3 mb-20">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
        ) : filteredVendors.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No vendors found</p>
        ) : (
          filteredVendors.map((vendor) => (
            <Card 
              key={vendor.id} 
              className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => setSelectedVendor(vendor)}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-14 w-14 border">
                    <AvatarImage src={vendor.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary/10 text-primary">
                      {vendor.store_name?.charAt(0) || vendor.full_name?.charAt(0) || "V"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate">{vendor.store_name || "No store name"}</p>
                      {vendor.is_verified && <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />}
                    </div>
                    <p className="text-sm text-muted-foreground truncate">{vendor.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{vendor.email}</p>
                  </div>
                </div>
                
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="font-bold">{vendor.product_count}</p>
                    <p className="text-xs text-muted-foreground">Products</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="font-bold text-green-600">{formatCurrency(vendor.total_sales)}</p>
                    <p className="text-xs text-muted-foreground">Sales</p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/50">
                    <p className="font-bold text-amber-600">{formatCurrency(vendor.pending_payout)}</p>
                    <p className="text-xs text-muted-foreground">Pending</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    {vendor.is_verified ? (
                      <Badge className="bg-green-100 text-green-800 gap-1">
                        <BadgeCheck className="h-3 w-3" />
                        Verified
                      </Badge>
                    ) : (
                      <Badge variant="outline">Pending Verification</Badge>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedVendor(vendor);
                    }}
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead className="text-center">Products</TableHead>
                <TableHead className="text-right">Sales</TableHead>
                <TableHead className="text-right">Pending</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={8}><Skeleton className="h-12 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    No vendors found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map((vendor) => (
                  <TableRow 
                    key={vendor.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => setSelectedVendor(vendor)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="border">
                          <AvatarImage src={vendor.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {vendor.store_name?.charAt(0) || "V"}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium">{vendor.store_name || "No store name"}</span>
                            {vendor.is_verified && <BadgeCheck className="h-4 w-4 text-primary" />}
                          </div>
                          <span className="text-sm text-muted-foreground">{vendor.full_name}</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{vendor.email}</p>
                        <p className="text-muted-foreground">{vendor.phone || "No phone"}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">{vendor.product_count}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-green-600">{formatCurrency(vendor.total_sales)}</span>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="font-medium text-amber-600">{formatCurrency(vendor.pending_payout)}</span>
                    </TableCell>
                    <TableCell className="text-center">
                      {vendor.is_verified ? (
                        <Badge className="gap-1 bg-green-100 text-green-800">
                          <BadgeCheck className="h-3 w-3" />
                          Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {format(new Date(vendor.created_at), "MMM dd, yyyy")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedVendor(vendor);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant={vendor.is_verified ? "outline" : "default"}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerify(vendor.id, vendor.is_verified);
                          }}
                          disabled={verifyVendor.isPending}
                        >
                          {vendor.is_verified ? "Unverify" : "Verify"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </div>

      {/* Vendor Detail Modal */}
      <VendorDetailModal
        vendor={selectedVendor}
        open={!!selectedVendor}
        onOpenChange={(open) => !open && setSelectedVendor(null)}
        onVerify={handleVerify}
      />
    </AdminLayout>
  );
}