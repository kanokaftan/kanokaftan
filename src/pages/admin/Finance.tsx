import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAdminFinance } from "@/hooks/useAdminFinance";
import { DollarSign, TrendingUp, Wallet, CreditCard, Building } from "lucide-react";
import { format } from "date-fns";

export default function AdminFinance() {
  const { payouts, transactions, isLoading, totalPlatformRevenue, totalGMV, pendingPayouts } = useAdminFinance();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "processing": return "bg-blue-100 text-blue-800";
      case "shipped": return "bg-purple-100 text-purple-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <AdminLayout title="Finance & Payouts">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total GMV</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{formatCurrency(totalGMV)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Gross merchandise value</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-100 to-green-50 border-green-200 dark:from-green-950/30 dark:to-green-950/10 dark:border-green-900">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Platform Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold text-green-600">{formatCurrency(totalPlatformRevenue)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">10% platform fee</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vendor Earnings</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{formatCurrency(pendingPayouts)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total vendor payouts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Transactions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{transactions.length}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Total transactions</p>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payouts" className="space-y-6">
        <TabsList>
          <TabsTrigger value="payouts">Vendor Payouts</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Payouts Tab */}
        <TabsContent value="payouts">
          {/* Mobile View */}
          <div className="md:hidden space-y-3 mb-20">
            {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : payouts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No vendor payouts yet</p>
            ) : (
              payouts.map((payout) => (
                <Card key={payout.vendorId}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar>
                        <AvatarImage src={payout.avatar || undefined} />
                        <AvatarFallback>{payout.storeName?.charAt(0) || "V"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold truncate">{payout.storeName || payout.vendorName}</p>
                        <p className="text-sm text-muted-foreground">{payout.vendorName}</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <p className="text-muted-foreground">Total Sales</p>
                        <p className="font-semibold">{formatCurrency(payout.totalSales)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Net Payout</p>
                        <p className="font-semibold text-green-600">{formatCurrency(payout.netPayout)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Platform Fee</p>
                        <p className="font-medium">{formatCurrency(payout.platformFee)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Orders</p>
                        <p className="font-medium">{payout.completedOrders} completed</p>
                      </div>
                    </div>
                    {payout.bankName && (
                      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm text-muted-foreground">
                        <Building className="h-4 w-4" />
                        <span>{payout.bankName} - {payout.accountNumber?.slice(-4).padStart(10, "•")}</span>
                      </div>
                    )}
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
                    <TableHead>Total Sales</TableHead>
                    <TableHead>Platform Fee (10%)</TableHead>
                    <TableHead>Net Payout</TableHead>
                    <TableHead>Orders</TableHead>
                    <TableHead>Bank Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : payouts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No vendor payouts yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    payouts.map((payout) => (
                      <TableRow key={payout.vendorId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar>
                              <AvatarImage src={payout.avatar || undefined} />
                              <AvatarFallback>{payout.storeName?.charAt(0) || "V"}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{payout.storeName || payout.vendorName}</p>
                              <p className="text-sm text-muted-foreground">{payout.vendorName}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">{formatCurrency(payout.totalSales)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatCurrency(payout.platformFee)}</TableCell>
                        <TableCell className="font-semibold text-green-600">{formatCurrency(payout.netPayout)}</TableCell>
                        <TableCell>
                          <span className="text-green-600">{payout.completedOrders}</span>
                          {payout.pendingOrders > 0 && (
                            <span className="text-muted-foreground"> (+{payout.pendingOrders} pending)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payout.bankName ? (
                            <div className="text-sm">
                              <p>{payout.bankName}</p>
                              <p className="text-muted-foreground">{payout.accountNumber?.slice(-4).padStart(10, "•")}</p>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">Not set</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          {/* Mobile View */}
          <div className="md:hidden space-y-3 mb-20">
            {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : transactions.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions yet</p>
            ) : (
              transactions.slice(0, 50).map((tx) => (
                <Card key={tx.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium">{tx.vendorName}</p>
                      <Badge className={getStatusColor(tx.status)}>{tx.status}</Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{tx.customerName}</span>
                      <span className="font-semibold">{formatCurrency(tx.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                      <span>{format(new Date(tx.createdAt), "MMM dd, yyyy HH:mm")}</span>
                      <span>Fee: {formatCurrency(tx.platformFee)}</span>
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
                    <TableHead>Date</TableHead>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Platform Fee</TableHead>
                    <TableHead>Net Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => (
                      <TableRow key={i}>
                        <TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : transactions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        No transactions yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    transactions.slice(0, 50).map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">{format(new Date(tx.createdAt), "MMM dd, HH:mm")}</TableCell>
                        <TableCell className="font-medium">{tx.vendorName}</TableCell>
                        <TableCell>{tx.customerName}</TableCell>
                        <TableCell className="font-medium">{formatCurrency(tx.amount)}</TableCell>
                        <TableCell className="text-muted-foreground">{formatCurrency(tx.platformFee)}</TableCell>
                        <TableCell className="font-semibold text-green-600">{formatCurrency(tx.netAmount)}</TableCell>
                        <TableCell><Badge className={getStatusColor(tx.status)}>{tx.status}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
