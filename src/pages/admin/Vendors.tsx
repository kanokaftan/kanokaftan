import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { useAdminVendors, badgeTierOf, type BadgeTier } from "@/hooks/useAdminVendors";
import { BadgeTierControl, TierChip } from "@/components/admin/BadgeTierControl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Package, Eye } from "lucide-react";
import { format } from "date-fns";
import { VerificationRequests } from "@/components/admin/VerificationRequests";
import { VendorApplications } from "@/components/admin/VendorApplications";
import { usePendingApplicationCount } from "@/hooks/useVendorApplication";
import { usePendingVerificationCount } from "@/hooks/useAdminVerification";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";

const PAGE_SIZE = 20;

type TierFilter = "all" | BadgeTier;

export default function AdminVendors() {
  const { vendors, isLoading } = useAdminVendors();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState<TierFilter>("all");
  const navigate = useNavigate();
  /** Full page with the seller's details, chats with customers, products, orders and payouts. */
  const openVendor = (vendorId: string) => navigate(`/admin/vendors/${vendorId}`);
  const { data: pendingReviewCount = 0 } = usePendingVerificationCount();
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingApplications = usePendingApplicationCount();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam === "verification" || tabParam === "applications" ? tabParam : "vendors";
  const handleTabChange = (tab: string) => {
    const next = new URLSearchParams(searchParams);
    if (tab === "vendors") next.delete("tab");
    else next.set("tab", tab);
    setSearchParams(next, { replace: true });
  };

  const query = search.trim().toLowerCase();
  const filteredVendors = vendors.filter((vendor) =>
    (tierFilter === "all" || badgeTierOf(vendor) === tierFilter) &&
    (!query ||
      vendor.store_name?.toLowerCase().includes(query) ||
      vendor.full_name?.toLowerCase().includes(query) ||
      vendor.email.toLowerCase().includes(query))
  );

  const [page, setPage] = useState(1);
  const totalPages = Math.ceil(filteredVendors.length / PAGE_SIZE);
  const paginatedVendors = filteredVendors.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, tierFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const countOf = (tier: BadgeTier) => vendors.filter((v) => badgeTierOf(v) === tier).length;
  const totalSales = vendors.reduce((sum, v) => sum + v.total_sales, 0);
  const filterTiles: { value: TierFilter; label: string; count: number; dot: string }[] = [
    { value: "all", label: "All sellers", count: vendors.length, dot: "bg-foreground" },
    { value: "gold", label: "Gold", count: countOf("gold"), dot: "bg-[#9A7400]" },
    { value: "blue", label: "Blue", count: countOf("blue"), dot: "bg-[#1D9BF0]" },
    { value: "none", label: "Not verified", count: countOf("none"), dot: "bg-muted-foreground/50" },
  ];

  return (
    <AdminLayout title="Vendors">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="vendors">Vendors</TabsTrigger>
          <TabsTrigger value="applications" className="gap-1.5">
            Applications
            {pendingApplications > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold leading-4 text-white">
                {pendingApplications}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="verification" className="gap-1.5">
            Verification requests
            {pendingReviewCount > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold leading-4 text-white">
                {pendingReviewCount}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="applications">
          <VendorApplications />
        </TabsContent>

        <TabsContent value="verification">
          <VerificationRequests />
        </TabsContent>

        <TabsContent value="vendors">
          {/* Badge filters (also the counts) */}
          <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            {filterTiles.map((tile) => (
              <button
                key={tile.value}
                type="button"
                onClick={() => setTierFilter(tile.value)}
                aria-pressed={tierFilter === tile.value}
                className={`flex items-center justify-between rounded-xl border px-3 py-2.5 text-left transition-colors ${
                  tierFilter === tile.value ? "border-foreground bg-card shadow-sm" : "bg-card/60 hover:bg-card"
                }`}
              >
                <span className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className={`h-2 w-2 rounded-full ${tile.dot}`} />
                  {tile.label}
                </span>
                <span className="text-lg font-bold">{isLoading ? "–" : tile.count}</span>
              </button>
            ))}
          </div>
          <p className="mb-4 text-xs text-muted-foreground">
            Total sales across sellers: <span className="font-semibold text-foreground">{formatCurrency(totalSales)}</span>
          </p>

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
          <div className="md:hidden space-y-3 mb-4">
            {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
            ) : filteredVendors.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No vendors found</p>
            ) : (
              paginatedVendors.map((vendor) => (
                <Card 
                  key={vendor.id} 
                  className="overflow-hidden cursor-pointer hover:shadow-md transition-shadow"
                  onClick={() => openVendor(vendor.id)}
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
                          {vendor.is_verified && <VerifiedBadge tier={vendor.verification_tier} />}
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
                
                    <div className="mt-4 space-y-2 border-t pt-4">
                      <div className="flex items-center justify-between">
                        <TierChip tier={badgeTierOf(vendor)} />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            openVendor(vendor.id);
                          }}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          View
                        </Button>
                      </div>
                      <div onClick={(e) => e.stopPropagation()}>
                        <BadgeTierControl vendorId={vendor.id} tier={badgeTierOf(vendor)} className="flex w-full" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          <div className="md:hidden mb-20">
            <AdminPagination page={page} totalPages={totalPages} totalItems={filteredVendors.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
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
                    paginatedVendors.map((vendor) => (
                      <TableRow 
                        key={vendor.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => openVendor(vendor.id)}
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
                                {vendor.is_verified && <VerifiedBadge tier={vendor.verification_tier} />}
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
                          <TierChip tier={badgeTierOf(vendor)} />
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {format(new Date(vendor.created_at), "MMM dd, yyyy")}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={(e) => {
                                e.stopPropagation();
                                openVendor(vendor.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <BadgeTierControl vendorId={vendor.id} tier={badgeTierOf(vendor)} />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
            <AdminPagination page={page} totalPages={totalPages} totalItems={filteredVendors.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </TabsContent>
      </Tabs>

      {/* Vendor Detail Modal */}
    </AdminLayout>
  );
}