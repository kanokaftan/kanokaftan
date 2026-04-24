import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useAdminFinance } from "@/hooks/useAdminFinance";
import { DollarSign, CreditCard, Search } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 20;

export default function AdminFinance() {
  const { transactions, isLoading, totalGMV } = useAdminFinance();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const filteredTx = transactions.filter(tx =>
    tx.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    tx.orderId?.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredTx.length / PAGE_SIZE);
  const paginatedTx = filteredTx.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "bg-green-100 text-green-800";
      case "processing": return "bg-blue-100 text-blue-800";
      case "shipped": return "bg-purple-100 text-purple-800";
      case "pending": return "bg-yellow-100 text-yellow-800";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <AdminLayout title="Finance">
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-8 w-24" /> : (
              <div className="text-2xl font-bold">{formatCurrency(totalGMV)}</div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Paid orders total</p>
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
            <p className="text-xs text-muted-foreground mt-1">Total paid orders</p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="relative max-w-sm mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by customer or order ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Mobile View */}
      <div className="md:hidden space-y-3">
        {isLoading ? (
          [...Array(5)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)
        ) : paginatedTx.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No transactions found</p>
        ) : (
          paginatedTx.map((tx) => (
            <Card key={tx.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-medium truncate flex-1">{tx.customerName}</p>
                  <Badge className={getStatusColor(tx.status)}>{tx.status}</Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-xs text-muted-foreground font-mono">#{tx.orderId.slice(0, 8)}</span>
                  <span className="font-semibold">{formatCurrency(tx.amount)}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {format(new Date(tx.createdAt), "MMM dd, yyyy HH:mm")}
                </p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
      <div className="md:hidden mb-20">
        <AdminPagination page={page} totalPages={totalPages} totalItems={filteredTx.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Order ID</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : paginatedTx.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No transactions found
                  </TableCell>
                </TableRow>
              ) : (
                paginatedTx.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="text-sm">{format(new Date(tx.createdAt), "MMM dd, HH:mm")}</TableCell>
                    <TableCell>{tx.customerName}</TableCell>
                    <TableCell className="font-mono text-xs">#{tx.orderId.slice(0, 8)}</TableCell>
                    <TableCell className="font-semibold">{formatCurrency(tx.amount)}</TableCell>
                    <TableCell><Badge className={getStatusColor(tx.status)}>{tx.status}</Badge></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
        <AdminPagination page={page} totalPages={totalPages} totalItems={filteredTx.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}
