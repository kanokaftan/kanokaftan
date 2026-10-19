import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { PayoutLedger } from "@/components/admin/PayoutLedger";
import { DisputesPanel } from "@/components/admin/DisputesPanel";
import { PaymentsStatusCard } from "@/components/admin/PaymentsStatusCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAdminFinance } from "@/hooks/useAdminFinance";
import { usePlatformFeeIncome } from "@/hooks/useAdminVerification";
import { DollarSign, TrendingUp, Wallet, CreditCard, Building, Search, BadgeCheck, Megaphone } from "lucide-react";
import { format } from "date-fns";
import { CopyNumber } from "@/components/admin/CopyNumber";

const PAGE_SIZE = 20;

export default function AdminFinance() {
  const { payouts, transactions, isLoading, totalPlatformRevenue, totalGMV, pendingPayouts, feePercent } = useAdminFinance();
  const { data: feeIncome, isLoading: feeIncomeLoading, error: feeIncomeError } = usePlatformFeeIncome();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [vendorPage, setVendorPage] = useState(1);

  const q = search.toLowerCase();
  const filteredTx = transactions.filter(tx =>
    tx.customerName?.toLowerCase().includes(q) ||
    tx.vendorName?.toLowerCase().includes(q) ||
    tx.orderId?.toLowerCase().includes(q)
  );
  const totalPages = Math.ceil(filteredTx.length / PAGE_SIZE);
  const paginatedTx = filteredTx.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const vendorTotalPages = Math.ceil(payouts.length / PAGE_SIZE);
  const paginatedPayouts = payouts.slice((vendorPage - 1) * PAGE_SIZE, vendorPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

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
      <PaymentsStatusCard />
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
            <p className="text-xs text-muted-foreground mt-1">{feePercent}% platform fee</p>
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

      {/* Seller fees (verification + homepage promotions) */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Platform fees from sellers</CardTitle>
        </CardHeader>
        <CardContent>
          {feeIncomeLoading ? (
            <Skeleton className="h-12 w-full" />
          ) : feeIncomeError || !feeIncome ? (
            <p className="text-sm text-muted-foreground">Could not load fee income.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="flex items-start gap-2">
                <BadgeCheck className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <p className="text-muted-foreground">Verification</p>
                  <p className="text-lg font-bold">{formatCurrency(feeIncome.verificationThisMonth)}</p>
                  <p className="text-xs text-muted-foreground">this month · {formatCurrency(feeIncome.verificationAllTime)} all time</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Megaphone className="h-4 w-4 mt-0.5 text-primary" />
                <div>
                  <p className="text-muted-foreground">Promotions</p>
                  <p className="text-lg font-bold">{formatCurrency(feeIncome.featuredThisMonth)}</p>
                  <p className="text-xs text-muted-foreground">this month · {formatCurrency(feeIncome.featuredAllTime)} all time</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="ledger" className="space-y-6">
        <TabsList>
          <TabsTrigger value="ledger">Payouts</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="payouts">Vendor Summary</TabsTrigger>
          <TabsTrigger value="transactions">Transactions</TabsTrigger>
        </TabsList>

        {/* Payouts Tab */}
        <TabsContent value="ledger">
          <PayoutLedger />
        </TabsContent>

        <TabsContent value="disputes">
          <DisputesPanel />
        </TabsContent>

        <TabsContent value="payouts">
          {/* Mobile View */}
          <div className="2xl:hidden space-y-3 mb-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 w-full" />)
            ) : payouts.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No vendor payouts yet</p>
            ) : (
              paginatedPayouts.map((payout) => (
                <Card key={payout.vendorId}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3 mb-3">
                      <Avatar>
                        <AvatarImage src={payout.avatar || undefined} />
                        <AvatarFallback>{payout.storeName?.charAt(0) || "V"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold break-words">{payout.storeName || payout.vendorName}</p>
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
                      <div className="mt-3 flex items-start gap-2 border-t pt-3 text-sm">
                        <Building className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="break-words text-muted-foreground">{payout.bankName}{payout.accountName ? ` · ${payout.accountName}` : ""}</p>
                          {payout.accountNumber && <CopyNumber value={payout.accountNumber} />}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
          <div className="2xl:hidden mb-20"><AdminPagination page={vendorPage} totalPages={vendorTotalPages} totalItems={payouts.length} pageSize={PAGE_SIZE} onPageChange={setVendorPage} /></div>

          {/* Desktop Table */}
          <div className="hidden 2xl:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Total Sales</TableHead>
                    <TableHead>Platform Fee ({feePercent}%)</TableHead>
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
                    paginatedPayouts.map((payout) => (
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
                        <TableCell className="font-medium whitespace-nowrap [overflow-wrap:normal]">{formatCurrency(payout.totalSales)}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap [overflow-wrap:normal]">{formatCurrency(payout.platformFee)}</TableCell>
                        <TableCell className="font-semibold text-green-600 whitespace-nowrap [overflow-wrap:normal]">{formatCurrency(payout.netPayout)}</TableCell>
                        <TableCell>
                          <span className="text-green-600">{payout.completedOrders}</span>
                          {payout.pendingOrders > 0 && (
                            <span className="text-muted-foreground"> (+{payout.pendingOrders} pending)</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {payout.bankName ? (
                            <div className="text-sm">
                              <p className="break-words">{payout.bankName}</p>
                              {payout.accountName && <p className="break-words text-xs text-muted-foreground">{payout.accountName}</p>}
                              {payout.accountNumber && <CopyNumber value={payout.accountNumber} />}
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
            <AdminPagination page={vendorPage} totalPages={vendorTotalPages} totalItems={payouts.length} pageSize={PAGE_SIZE} onPageChange={setVendorPage} />
          </div>
        </TabsContent>

        {/* Transactions Tab */}
        <TabsContent value="transactions">
          <div className="relative max-w-sm mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by customer, vendor or order ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          {/* Mobile View */}
          <div className="2xl:hidden space-y-3 mb-4 md:grid md:grid-cols-2 md:gap-3 md:space-y-0">
            {isLoading ? (
              [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
            ) : filteredTx.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No transactions found</p>
            ) : (
              paginatedTx.map((tx) => (
                <Card key={tx.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium break-words flex-1">{tx.vendorName}</p>
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
          <div className="2xl:hidden mb-20"><AdminPagination page={page} totalPages={totalPages} totalItems={filteredTx.length} pageSize={PAGE_SIZE} onPageChange={setPage} /></div>

          {/* Desktop Table */}
          <div className="hidden 2xl:block">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Order ID</TableHead>
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
                        <TableCell colSpan={8}><Skeleton className="h-10 w-full" /></TableCell>
                      </TableRow>
                    ))
                  ) : filteredTx.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        No transactions found
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedTx.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="text-sm">{format(new Date(tx.createdAt), "MMM dd, HH:mm")}</TableCell>
                        <TableCell className="font-mono text-xs">#{tx.orderId.slice(0, 8)}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap [overflow-wrap:normal]">{tx.vendorName}</TableCell>
                        <TableCell className="whitespace-nowrap [overflow-wrap:normal]">{tx.customerName}</TableCell>
                        <TableCell className="font-medium whitespace-nowrap [overflow-wrap:normal]">{formatCurrency(tx.amount)}</TableCell>
                        <TableCell className="text-muted-foreground whitespace-nowrap [overflow-wrap:normal]">{formatCurrency(tx.platformFee)}</TableCell>
                        <TableCell className="font-semibold text-green-600 whitespace-nowrap [overflow-wrap:normal]">{formatCurrency(tx.netAmount)}</TableCell>
                        <TableCell><Badge className={getStatusColor(tx.status)}>{tx.status}</Badge></TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
            <AdminPagination page={page} totalPages={totalPages} totalItems={filteredTx.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
