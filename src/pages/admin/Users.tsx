import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminListToolbar, type ListChip } from "@/components/admin/AdminListToolbar";
import {
  useAdminUsers, useAdminUserRoleCounts, ADMIN_USER_ROLE_FILTERS, DEFAULT_USER_ROLE_FILTER, type AdminUserRoleFilter,
} from "@/hooks/useAdminUsers";
import { useAdminListState, useKeepPageInRange } from "@/hooks/useAdminListState";
import { totalPagesOf } from "@/hooks/adminList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight } from "lucide-react";
import { format } from "date-fns";

const ROLE_LABELS: Record<AdminUserRoleFilter, string> = {
  customer: "Customers",
  vendor: "Sellers",
  admin: "Admins",
  all: "Everyone",
};

/** People who signed up (customers by default). Tap one for their orders, spending and chats with sellers. */
export default function AdminUsers() {
  const navigate = useNavigate();
  const list = useAdminListState({ filters: ADMIN_USER_ROLE_FILTERS, defaultFilter: DEFAULT_USER_ROLE_FILTER });
  const { users, total, isLoading, isFetching, error, refetch } = useAdminUsers(list.params);
  const { data: roleCounts } = useAdminUserRoleCounts(list.params.search);
  const { page, setPage, pageSize: PAGE_SIZE } = list;
  const totalPages = totalPagesOf(total, PAGE_SIZE);
  useKeepPageInRange(page, setPage, isLoading ? undefined : total, PAGE_SIZE);
  const paginatedUsers = users;
  const filteredUsers = users;
  const chips: ListChip<AdminUserRoleFilter>[] = ADMIN_USER_ROLE_FILTERS.map((role) => ({
    value: role,
    label: ROLE_LABELS[role],
    count: roleCounts?.[role],
  }));

  // Sellers open their seller page; everyone else their customer page.
  const open = (user: { id: string; roles: string[] }) =>
    navigate(user.roles.includes("vendor") ? `/admin/vendors/${user.id}` : `/admin/users/${user.id}`);
  const initial = (user: { full_name: string | null; email: string }) => (user.full_name?.charAt(0) || user.email.charAt(0)).toUpperCase();

  return (
    <AdminLayout title="Customers">
      <AdminListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        placeholder="Search name, email, phone or shop"
        chips={chips}
        filter={list.filter}
        onFilterChange={list.setFilter}
        total={isLoading ? undefined : total}
        noun={["person", "people"]}
        busy={list.isSearchPending || isFetching}
      />

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span className="text-destructive">{error instanceof Error ? error.message : "Couldn't load people."}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      )}

      {/* Mobile: WhatsApp-style list */}
      <div className="md:hidden">
        {isLoading ? (
          [...Array(6)].map((_, i) => <Skeleton key={i} className="mb-3 h-14 w-full rounded-xl" />)
        ) : filteredUsers.length === 0 ? (
          <p className="text-center text-muted-foreground py-8">No one found</p>
        ) : (
          <ul>
            {paginatedUsers.map((user) => (
              <li key={user.id}>
                <button type="button" onClick={() => open(user)} className="flex w-full items-center gap-3 py-2.5 text-left active:bg-muted/60">
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
        <AdminPagination page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
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
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No one found</TableCell>
                </TableRow>
              ) : (
                paginatedUsers.map((user) => (
                  <TableRow key={user.id} className="cursor-pointer" onClick={() => open(user)}>
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
        <AdminPagination page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}
