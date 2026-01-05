import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { useAdminOrders } from "@/hooks/useAdminOrders";
import { Users, Store, Package, ShoppingCart, DollarSign, TrendingUp, TrendingDown, Percent, Activity, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { 
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend 
} from "recharts";

const COLORS = ["hsl(var(--primary))", "hsl(var(--secondary))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

export default function AdminDashboard() {
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: analytics, isLoading: analyticsLoading } = useAdminAnalytics(30);
  const { orders, isLoading: ordersLoading } = useAdminOrders();

  const recentOrders = orders.slice(0, 5);
  const isLoading = statsLoading || analyticsLoading;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `₦${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `₦${(amount / 1000).toFixed(1)}K`;
    }
    return formatCurrency(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "processing": return "bg-blue-100 text-blue-800";
      case "shipped": return "bg-purple-100 text-purple-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      case "cancelled": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const GrowthIndicator = ({ value }: { value: number }) => {
    const isPositive = value >= 0;
    return (
      <span className={`flex items-center text-xs font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}>
        {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
        {Math.abs(value).toFixed(1)}%
      </span>
    );
  };

  // Prepare chart data
  const revenueChartData = analytics?.dailyRevenue.slice(-14).map(d => ({
    date: format(new Date(d.date), "MMM dd"),
    revenue: d.revenue,
    orders: d.orders,
  })) || [];

  const categoryChartData = analytics?.categoryBreakdown.slice(0, 5) || [];

  return (
    <AdminLayout title="Dashboard">
      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-grid">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        {/* OVERVIEW TAB */}
        <TabsContent value="overview" className="space-y-6">
          {/* Key Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Revenue</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-20" /> : (
                  <>
                    <div className="text-2xl font-bold">{formatCompactCurrency(analytics?.totalRevenueThisMonth || 0)}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <GrowthIndicator value={analytics?.revenueGrowth || 0} />
                      <span className="text-xs text-muted-foreground">vs last month</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Orders</CardTitle>
                <ShoppingCart className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-20" /> : (
                  <>
                    <div className="text-2xl font-bold">{analytics?.totalOrdersThisMonth || 0}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <GrowthIndicator value={analytics?.orderGrowth || 0} />
                      <span className="text-xs text-muted-foreground">vs last month</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">New Users</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-20" /> : (
                  <>
                    <div className="text-2xl font-bold">{analytics?.newUsersThisMonth || 0}</div>
                    <div className="flex items-center gap-1 mt-1">
                      <GrowthIndicator value={analytics?.userGrowth || 0} />
                      <span className="text-xs text-muted-foreground">vs last month</span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Avg Order</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-8 w-20" /> : (
                  <>
                    <div className="text-2xl font-bold">{formatCurrency(analytics?.averageOrderValue || 0)}</div>
                    <div className="text-xs text-muted-foreground mt-1">per transaction</div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Users className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                    <p className="text-xs text-muted-foreground">Total Users</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-900">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-green-100 dark:bg-green-900">
                    <Store className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalVendors || 0}</p>
                    <p className="text-xs text-muted-foreground">Vendors ({stats?.verifiedVendors} verified)</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-900">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900">
                    <Package className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalProducts || 0}</p>
                    <p className="text-xs text-muted-foreground">Products</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-950/20 dark:border-yellow-900">
              <CardContent className="pt-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-yellow-100 dark:bg-yellow-900">
                    <ShoppingCart className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-yellow-600">{stats?.pendingOrders || 0}</p>
                    <p className="text-xs text-muted-foreground">Pending Orders</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Revenue Trend (14 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <AreaChart data={revenueChartData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 10 }} tickFormatter={(v) => `₦${(v/1000)}k`} />
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fillOpacity={1} fill="url(#colorRevenue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Orders (14 days)</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <Skeleton className="h-[250px] w-full" />
                ) : (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={revenueChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" className="text-xs" tick={{ fontSize: 10 }} />
                      <YAxis className="text-xs" tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Orders */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent Orders</CardTitle>
            </CardHeader>
            <CardContent>
              {ordersLoading ? (
                <div className="space-y-3">
                  {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
                </div>
              ) : recentOrders.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No orders yet</p>
              ) : (
                <div className="space-y-3">
                  {recentOrders.map((order) => (
                    <div key={order.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {order.customer?.full_name || order.customer?.email || "Customer"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {format(new Date(order.created_at), "MMM dd, yyyy HH:mm")} • {order.order_items.length} items
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                        <span className="font-semibold">{formatCurrency(Number(order.total))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ANALYTICS TAB */}
        <TabsContent value="analytics" className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Top Products */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Selling Products</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : analytics?.topProducts.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No sales data yet</p>
                ) : (
                  <div className="space-y-3">
                    {analytics?.topProducts.slice(0, 5).map((product, i) => (
                      <div key={product.id} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5">{i + 1}</span>
                        <div className="h-10 w-10 rounded bg-muted overflow-hidden flex-shrink-0">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-xs text-muted-foreground">N/A</div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{product.name}</p>
                          <p className="text-xs text-muted-foreground">{product.totalSold} sold</p>
                        </div>
                        <span className="font-semibold text-sm">{formatCurrency(product.revenue)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Top Vendors */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Top Vendors</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="space-y-3">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                ) : analytics?.topVendors.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">No vendor data yet</p>
                ) : (
                  <div className="space-y-3">
                    {analytics?.topVendors.slice(0, 5).map((vendor, i) => (
                      <div key={vendor.id} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-muted-foreground w-5">{i + 1}</span>
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={vendor.avatar || undefined} />
                          <AvatarFallback>{vendor.storeName?.charAt(0) || "V"}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate text-sm">{vendor.storeName}</p>
                          <p className="text-xs text-muted-foreground">{vendor.orderCount} orders</p>
                        </div>
                        <span className="font-semibold text-sm">{formatCurrency(vendor.totalSales)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Category Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Products by Category</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-[300px] w-full" />
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={categoryChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={2}
                        dataKey="count"
                        label={({ name, percentage }) => `${name} (${percentage}%)`}
                        labelLine={false}
                      >
                        {categoryChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col justify-center space-y-2">
                    {categoryChartData.map((cat, i) => (
                      <div key={cat.name} className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                        <span className="flex-1 text-sm">{cat.name}</span>
                        <span className="text-sm font-medium">{cat.count} products</span>
                        <span className="text-sm text-muted-foreground">({cat.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* INSIGHTS TAB */}
        <TabsContent value="insights" className="space-y-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Conversion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-12 w-20" /> : (
                  <div className="flex items-center gap-2">
                    <Percent className="h-8 w-8 text-primary" />
                    <span className="text-3xl font-bold">{(analytics?.conversionRate || 0).toFixed(1)}%</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Users who made a purchase</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Revenue Growth</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-12 w-20" /> : (
                  <div className="flex items-center gap-2">
                    {(analytics?.revenueGrowth || 0) >= 0 ? (
                      <TrendingUp className="h-8 w-8 text-green-500" />
                    ) : (
                      <TrendingDown className="h-8 w-8 text-red-500" />
                    )}
                    <span className={`text-3xl font-bold ${(analytics?.revenueGrowth || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {(analytics?.revenueGrowth || 0) >= 0 ? "+" : ""}{(analytics?.revenueGrowth || 0).toFixed(1)}%
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Compared to last month</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Order Growth</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? <Skeleton className="h-12 w-20" /> : (
                  <div className="flex items-center gap-2">
                    {(analytics?.orderGrowth || 0) >= 0 ? (
                      <TrendingUp className="h-8 w-8 text-green-500" />
                    ) : (
                      <TrendingDown className="h-8 w-8 text-red-500" />
                    )}
                    <span className={`text-3xl font-bold ${(analytics?.orderGrowth || 0) >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {(analytics?.orderGrowth || 0) >= 0 ? "+" : ""}{(analytics?.orderGrowth || 0).toFixed(1)}%
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-2">Compared to last month</p>
              </CardContent>
            </Card>
          </div>

          {/* Month over Month Comparison */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Month-over-Month Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">This Month Revenue</p>
                  <p className="text-xl font-bold">{formatCurrency(analytics?.totalRevenueThisMonth || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">vs {formatCurrency(analytics?.totalRevenueLastMonth || 0)} last month</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">This Month Orders</p>
                  <p className="text-xl font-bold">{analytics?.totalOrdersThisMonth || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">vs {analytics?.totalOrdersLastMonth || 0} last month</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <p className="text-sm text-muted-foreground mb-1">New Users</p>
                  <p className="text-xl font-bold">{analytics?.newUsersThisMonth || 0}</p>
                  <p className="text-xs text-muted-foreground mt-1">vs {analytics?.newUsersLastMonth || 0} last month</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Key Insights */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Key Insights</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analytics?.topProducts[0] && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-900">
                    <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-green-800 dark:text-green-200">Best Selling Product</p>
                      <p className="text-sm text-green-700 dark:text-green-300">
                        "{analytics.topProducts[0].name}" has generated {formatCurrency(analytics.topProducts[0].revenue)} from {analytics.topProducts[0].totalSold} sales
                      </p>
                    </div>
                  </div>
                )}
                {analytics?.topVendors[0] && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900">
                    <Store className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-blue-800 dark:text-blue-200">Top Performing Vendor</p>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        "{analytics.topVendors[0].storeName}" leads with {formatCurrency(analytics.topVendors[0].totalSales)} in sales from {analytics.topVendors[0].orderCount} orders
                      </p>
                    </div>
                  </div>
                )}
                {(analytics?.averageOrderValue || 0) > 0 && (
                  <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900">
                    <Activity className="h-5 w-5 text-purple-600 mt-0.5" />
                    <div>
                      <p className="font-medium text-purple-800 dark:text-purple-200">Average Order Value</p>
                      <p className="text-sm text-purple-700 dark:text-purple-300">
                        Customers spend an average of {formatCurrency(analytics?.averageOrderValue || 0)} per order
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
