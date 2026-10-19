import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminListToolbar, type ListChip } from "@/components/admin/AdminListToolbar";
import {
  useAdminUsers, useAdminUserRoleCounts, ADMIN_USER_ROLE_FILTERS, DEFAULT_USER_ROLE_FILTER, type AdminUser, type AdminUserRoleFilter,
} from "@/hooks/useAdminUsers";
import { useAdminListState, useKeepPageInRange } from "@/hooks/useAdminListState";
import { totalPagesOf } from "@/hooks/adminList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChevronRight, Landmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const FILTER_LABELS: Record<AdminUserRoleFilter, string> = {
  customer: "All users",
  bank_linked: "Bank linked",
  bank_missing: "No bank yet",
};

/** "GTBank ••4821 · AISHA BELLO": the masked bank account a user linked. */
function BankLine({ bank, compact = false }: { bank: NonNullable<AdminUser["bank"]>; compact?: boolean }) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-1.5 text-green-700 dark:text-green-400", compact ? "text-xs" : "text-sm")}>
      <Landmark className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{bank.bank_name} ••{bank.last4} · {bank.account_name}</span>
    </span>
  );
}

/** Users (buyers only; sellers are on the Sellers page). Tap one for their orders, spending and chats with sellers. */
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
    label: FILTER_LABELS[role],
    count: roleCounts?.[role],
  }));

  const open = (user: { id: string }) => navigate(`/admin/users/${user.id}`);
  const initial = (user: { full_name: string | null; email: string }) => (user.full_name?.charAt(0) || user.email.charAt(0)).toUpperCase();

  return (
    <AdminLayout title={list.filter === "bank_linked" ? "Bank accounts" : "Users"}>
      <AdminListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        placeholder="Search name, email, phone or bank account name"
        chips={chips}
        filter={list.filter}
        onFilterChange={list.setFilter}
        total={isLoading ? undefined : total}
        noun={["user", "users"]}
        busy={list.isSearchPending || isFetching}
      />

      {list.filter === "bank_linked" && (
        <p className="mb-3 rounded-xl bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Bank name, account name (checked with Paystack against the user's name) and the last 4 digits. The full account number is
          never stored, so a leak can't expose it. Each bank account can belong to one user only.
        </p>
      )}

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
                    {user.bank && <BankLine bank={user.bank} compact />}
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
                <TableHead>User</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Bank account</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={6}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No one found</TableCell>
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
                    <TableCell className="max-w-[260px]">
                      {user.bank ? (
                        <div className="min-w-0">
                          <BankLine bank={user.bank} />
                          <p className="text-[11px] text-muted-foreground">Linked {format(new Date(user.bank.verified_at), "d MMM yyyy")}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not linked</span>
                      )}
                    </TableCell>
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
