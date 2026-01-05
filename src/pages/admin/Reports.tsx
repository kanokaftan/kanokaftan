import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAdminReports } from "@/hooks/useAdminReports";
import { FileDown, TrendingUp, Package, Store, Users } from "lucide-react";
import { 
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";
import { format } from "date-fns";

export default function AdminReports() {
  const { data: reports, isLoading } = useAdminReports();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const exportToCSV = (data: any[], filename: string) => {
    if (!data.length) return;
    const headers = Object.keys(data[0]).join(",");
    const rows = data.map(row => Object.values(row).join(",")).join("\n");
    const csv = `${headers}\n${rows}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
  };

  return (
    <AdminLayout title="Reports">
      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4 lg:w-auto lg:inline-grid">
          <TabsTrigger value="sales" className="gap-2">
            <TrendingUp className="h-4 w-4 hidden sm:block" />Sales
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4 hidden sm:block" />Products
          </TabsTrigger>
          <TabsTrigger value="vendors" className="gap-2">
            <Store className="h-4 w-4 hidden sm:block" />Vendors
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="h-4 w-4 hidden sm:block" />Users
          </TabsTrigger>
        </TabsList>

        {/* Sales Report */}
        <TabsContent value="sales" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Weekly Sales Report</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => exportToCSV(reports?.salesReport || [], "sales-report")}
            >
              <FileDown className="h-4 w-4" />Export
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue & Orders (8 weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={reports?.salesReport}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis yAxisId="left" className="text-xs" tick={{ fontSize: 10 }} tickFormatter={(v) => `₦${(v/1000)}k`} />
                    <YAxis yAxisId="right" orientation="right" className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(value: number, name: string) => 
                      name === "totalRevenue" ? formatCurrency(value) : value
                    } />
                    <Legend />
                    <Bar yAxisId="left" dataKey="totalRevenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar yAxisId="right" dataKey="totalOrders" name="Orders" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead>Revenue</TableHead>
                  <TableHead>Orders</TableHead>
                  <TableHead>Avg Order Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  reports?.salesReport.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.period}</TableCell>
                      <TableCell>{formatCurrency(row.totalRevenue)}</TableCell>
                      <TableCell>{row.totalOrders}</TableCell>
                      <TableCell>{formatCurrency(row.averageOrderValue)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>

        {/* Products Report */}
        <TabsContent value="products" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Product Performance Report</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => exportToCSV(reports?.productReport || [], "products-report")}
            >
              <FileDown className="h-4 w-4" />Export
            </Button>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-3 mb-20">
            {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : (
              reports?.productReport.slice(0, 20).map((product, i) => (
                <Card key={product.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">#{i + 1}</span>
                      <Badge variant="outline">{product.category}</Badge>
                    </div>
                    <p className="font-medium mb-2">{product.name}</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Sold</p>
                        <p className="font-semibold">{product.totalSold}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-semibold">{formatCurrency(product.revenue)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Stock</p>
                        <p className={`font-semibold ${product.stockRemaining < 10 ? "text-red-600" : ""}`}>
                          {product.stockRemaining}
                        </p>
                      </div>
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
                    <TableHead>#</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Units Sold</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Stock</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(10)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    reports?.productReport.slice(0, 50).map((product, i) => (
                      <TableRow key={product.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{product.name}</TableCell>
                        <TableCell><Badge variant="outline">{product.category}</Badge></TableCell>
                        <TableCell>{product.vendor}</TableCell>
                        <TableCell>{product.totalSold}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(product.revenue)}</TableCell>
                        <TableCell>
                          <span className={product.stockRemaining < 10 ? "text-red-600 font-medium" : ""}>
                            {product.stockRemaining}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        {/* Vendors Report */}
        <TabsContent value="vendors" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Vendor Performance Report</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => exportToCSV(reports?.vendorReport || [], "vendors-report")}
            >
              <FileDown className="h-4 w-4" />Export
            </Button>
          </div>

          {/* Mobile View */}
          <div className="md:hidden space-y-3 mb-20">
            {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-28 w-full" />)
            ) : (
              reports?.vendorReport.map((vendor, i) => (
                <Card key={vendor.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">#{i + 1}</span>
                        <p className="font-semibold">{vendor.storeName}</p>
                      </div>
                      {vendor.isVerified ? (
                        <Badge className="bg-green-100 text-green-800">Verified</Badge>
                      ) : (
                        <Badge variant="outline">Pending</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{vendor.name}</p>
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Products</p>
                        <p className="font-semibold">{vendor.totalProducts}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Orders</p>
                        <p className="font-semibold">{vendor.totalOrders}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Revenue</p>
                        <p className="font-semibold">{formatCurrency(vendor.totalRevenue)}</p>
                      </div>
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
                    <TableHead>#</TableHead>
                    <TableHead>Store Name</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Products</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Revenue</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(10)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={8}><Skeleton className="h-8 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : (
                    reports?.vendorReport.map((vendor, i) => (
                      <TableRow key={vendor.id}>
                        <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                        <TableCell className="font-medium">{vendor.storeName}</TableCell>
                        <TableCell>{vendor.name}</TableCell>
                        <TableCell>{vendor.totalProducts}</TableCell>
                        <TableCell>{vendor.totalOrders}</TableCell>
                        <TableCell className="font-semibold">{formatCurrency(vendor.totalRevenue)}</TableCell>
                        <TableCell>
                          {vendor.isVerified ? (
                            <Badge className="bg-green-100 text-green-800">Verified</Badge>
                          ) : (
                            <Badge variant="outline">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(vendor.joinedDate), "MMM dd, yyyy")}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        {/* Users Report */}
        <TabsContent value="users" className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">User Activity Report</h2>
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-2"
              onClick={() => exportToCSV(reports?.userReport || [], "users-report")}
            >
              <FileDown className="h-4 w-4" />Export
            </Button>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">User Growth & Activity (8 weeks)</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={reports?.userReport}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="period" className="text-xs" tick={{ fontSize: 10 }} />
                    <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="newUsers" name="New Users" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="activeUsers" name="Active Users" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="totalOrders" name="Orders" stroke="#f59e0b" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Week</TableHead>
                  <TableHead>New Users</TableHead>
                  <TableHead>Active Users</TableHead>
                  <TableHead>Total Orders</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={4}><Skeleton className="h-8 w-full" /></TableCell>
                    </TableRow>
                  ))
                ) : (
                  reports?.userReport.map((row, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{row.period}</TableCell>
                      <TableCell>{row.newUsers}</TableCell>
                      <TableCell>{row.activeUsers}</TableCell>
                      <TableCell>{row.totalOrders}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
