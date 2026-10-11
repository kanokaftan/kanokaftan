import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { useAdminUsers } from "@/hooks/useAdminUsers";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, Search, Store } from "lucide-react";
import { format } from "date-fns";

const PAGE_SIZE = 20;
/** Sellers live on the Vendors page and admins aren't customers. */
const NOT_CUSTOMER_ROLES = new Set(["admin", "vendor"]);

/** Customers only. Tap one for their orders, spending and chats with sellers. */
export default function AdminUsers() {
  const navigate = useNavigate();
  const { users, isLoading } = useAdminUsers();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const customers = users.filter((user) => !user.roles.some((role) => NOT_CUSTOMER_ROLES.has(role)));
  const sellerCount = users.filter((user) => user.roles.includes("vendor")).length;
  const query = search.trim().toLowerCase();
  const filteredUsers = customers.filter((user) =>
    !query ||
    user.full_name?.toLowerCase().includes(query) ||
    user.email.toLowerCase().includes(query) ||
    user.phone?.includes(query)
  );

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE);
  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search]);

  const open = (userId: string) => navigate(`/admin/users/${userId}`);
  const initial = (user: { full_name: string | null; email: string }) => (user.full_name?.charAt(0) || user.email.charAt(0)).toUpperCase();

  return (
    <AdminLayout title="Customers">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, email or phone"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {isLoading ? "…" : `${customers.length} ${customers.length === 1 ? "customer" : "customers"}`} ·{" "}
          <Link to="/admin/vendors" className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
            <Store className="h-3 w-3" />{sellerCount === 1 ? "1 seller is" : `${sellerCount} sellers are`} on the Sellers page
          </Link>
        </p>
      </div>

      {/* Mobile: WhatsApp-style list */}
      <div className="md:hidden">
        {isLoading ? (
          [...Array(6)].map((_, i) => <Skeleton key={i} className="mb-3 h-14 w-full rounded-xl" />)
        ) : filteredUsers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No customers found</p>
        ) : (
          <ul>
            {paginatedUsers.map((user) => (
              <li key={user.id}>
                <button type="button" onClick={() => open(user.id)} className="flex w-full items-center gap-3 py-2.5 text-left active:bg-muted/60">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback>{initial(user)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1 border-b border-border/60 pb-2.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="truncate font-medium">{user.full_name || "No name"}</p>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{format(new Date(user.created_at), "d MMM yyyy")}</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="md:hidden mb-20">
        <AdminPagination page={page} totalPages={totalPages} totalItems={filteredUsers.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>

      {/* Desktop table */}
      <div className="hidden md:block">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No customers found</TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id} className="cursor-pointer" onClick={() => open(user.id)}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar>
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback>{initial(user)}</AvatarFallback>
                        </Avatar>
                        <span className="font-medium">{user.full_name || "No name"}</span>
                      </div>
                    </TableCell>
                    <TableCell>{user.email}</TableCell>
                    <TableCell>{user.phone || "–"}</TableCell>
                    <TableCell>{format(new Date(user.created_at), "MMM dd, yyyy")}</TableCell>
                    <TableCell><ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" /></TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <AdminPagination page={page} totalPages={totalPages} totalItems={filteredUsers.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}
