import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminVendors } from "@/hooks/useAdminVendors";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, BadgeCheck, Package } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

export default function AdminVendors() {
  const { vendors, isLoading, verifyVendor } = useAdminVendors();
  const [search, setSearch] = useState("");

  const filteredVendors = vendors.filter(vendor => 
    vendor.store_name?.toLowerCase().includes(search.toLowerCase()) ||
    vendor.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    vendor.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleVerify = async (vendorId: string, currentStatus: boolean) => {
    try {
      await verifyVendor.mutateAsync({ vendorId, isVerified: !currentStatus });
      toast.success(currentStatus ? "Vendor unverified" : "Vendor verified successfully");
    } catch (error) {
      toast.error("Failed to update vendor verification");
    }
  };

  return (
    <AdminLayout title="Vendors">
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
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
        ) : filteredVendors.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No vendors found</p>
        ) : (
          filteredVendors.map((vendor) => (
            <div key={vendor.id} className="bg-card rounded-lg p-4 border">
              <div className="flex items-start gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={vendor.avatar_url || undefined} />
                  <AvatarFallback>{vendor.store_name?.charAt(0) || vendor.full_name?.charAt(0) || "V"}</AvatarFallback>
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
              <div className="mt-3 flex items-center gap-4">
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <Package className="h-4 w-4" />
                  <span>{vendor.product_count} products</span>
                </div>
                {vendor.is_verified ? (
                  <Badge className="bg-green-100 text-green-800">Verified</Badge>
                ) : (
                  <Badge variant="outline">Pending</Badge>
                )}
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t">
                <span className="text-xs text-muted-foreground">
                  Joined {format(new Date(vendor.created_at), "MMM dd, yyyy")}
                </span>
                <Button
                  size="sm"
                  variant={vendor.is_verified ? "outline" : "default"}
                  onClick={() => handleVerify(vendor.id, vendor.is_verified)}
                  disabled={verifyVendor.isPending}
                >
                  {vendor.is_verified ? "Unverify" : "Verify"}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Vendor</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Products</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredVendors.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No vendors found
                  </TableCell>
                </TableRow>
              ) : (
                filteredVendors.map((vendor) => (
                  <TableRow key={vendor.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={vendor.avatar_url || undefined} />
                          <AvatarFallback>{vendor.store_name?.charAt(0) || "V"}</AvatarFallback>
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
                    <TableCell>{vendor.email}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {vendor.product_count}
                      </div>
                    </TableCell>
                    <TableCell>
                      {vendor.is_verified ? (
                        <Badge className="gap-1 bg-green-100 text-green-800">
                          <BadgeCheck className="h-3 w-3" />Verified
                        </Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </TableCell>
                    <TableCell>{format(new Date(vendor.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant={vendor.is_verified ? "outline" : "default"}
                        onClick={() => handleVerify(vendor.id, vendor.is_verified)}
                        disabled={verifyVendor.isPending}
                      >
                        {vendor.is_verified ? "Unverify" : "Verify"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AdminLayout>
  );
}
