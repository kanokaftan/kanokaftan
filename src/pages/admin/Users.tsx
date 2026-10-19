import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminListToolbar, type ListChip } from "@/components/admin/AdminListToolbar";
import {
  useAdminUsers, useAdminUserRoleCounts, fetchAllAdminUsers, ADMIN_USER_ROLE_FILTERS, DEFAULT_USER_ROLE_FILTER, type AdminUser, type AdminUserRoleFilter,
} from "@/hooks/useAdminUsers";
import { useAdminListState, useKeepPageInRange } from "@/hooks/useAdminListState";
import { totalPagesOf } from "@/hooks/adminList";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useState } from "react";
import { ChevronRight, Download, Landmark, Loader2, ShieldAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/csv";
import { HeldRewards, TrustCheckBar } from "@/components/admin/trust/HeldRewards";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

const FILTER_LABELS: Record<AdminUserRoleFilter, string> = {
  customer: "All users",
  bank_linked: "Bank linked",
  bank_missing: "No bank yet",
  suspicious: "Suspicious",
};

const CSV_HEADERS = [
  "Name", "Email", "Phone", "Joined", "Bank", "Account name", "Account (last 4)", "Bank linked on",
  "Invited by", "Friends invited", "Friends verified", "K² earned", "Warnings",
];

const dateOrBlank = (value: string | null | undefined) => (value ? format(new Date(value), "yyyy-MM-dd") : "");

function toCsvRow(user: AdminUser): unknown[] {
  return [
    user.full_name ?? "", user.email, user.phone ?? "", dateOrBlank(user.created_at),
    user.bank?.bank_name ?? "", user.bank?.account_name ?? "", user.bank ? `••${user.bank.last4}` : "", dateOrBlank(user.bank?.verified_at),
    user.invitedBy?.name ?? "", user.friendsInvited, user.friendsVerified, user.k2Earned,
    user.flags.map((f) => f.label).join("; "),
  ];
}

/** "Invited 4 · 3 verified · by Aisha": invite stats under a user's name. */
function InviteLine({ user }: { user: AdminUser }) {
  const parts = [
    user.friendsInvited > 0 && `Invited ${user.friendsInvited} · ${user.friendsVerified} verified`,
    user.invitedBy && `Joined via ${user.invitedBy.name}`,
  ].filter(Boolean);
  if (!parts.length) return null;
  return (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
      <UserPlus className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">{parts.join(" · ")}</span>
    </span>
  );
}

/** Red "2 warnings" pill with the reasons on hover / long-press title. */
function FlagBadge({ user }: { user: AdminUser }) {
  if (!user.flags.length) return null;
  return (
    <span
      title={user.flags.map((f) => f.label).join("\n")}
      className="inline-flex shrink-0 items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-600 dark:text-red-400"
    >
      <ShieldAlert className="h-3 w-3" aria-hidden="true" />
      {user.flags.length === 1 ? "1 warning" : `${user.flags.length} warnings`}
    </span>
  );
}

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
  const [exporting, setExporting] = useState(false);

  const exportCsv = async () => {
    setExporting(true);
    try {
      const rows = await fetchAllAdminUsers(list.params.search ?? "", list.filter);
      if (!rows.length) {
        toast.info("No users to download.");
        return;
      }
      downloadCsv(`kano-kaftan-${list.filter === "customer" ? "users" : list.filter.replace("_", "-")}-${format(new Date(), "yyyy-MM-dd")}.csv`, CSV_HEADERS, rows.map(toCsvRow));
      toast.success(`Downloaded ${rows.length} ${rows.length === 1 ? "user" : "users"}`);
    } catch (e) {
      console.error("[AdminUsers] CSV export failed", e);
      toast.error("Couldn't download the list. Please try again.");
    } finally {
      setExporting(false);
    }
  };
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
        actions={
          <Button variant="outline" size="sm" className="h-8 rounded-full" onClick={exportCsv} disabled={exporting || total === 0}>
            {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
            Download CSV
          </Button>
        }
      />

      {list.filter === "suspicious" && (
        <>
          <HeldRewards />
          <p className="mb-2 rounded-xl bg-red-500/5 px-3 py-2 text-xs text-muted-foreground">
            Accounts that may belong to someone who already has one: a bank account in the same name as another user, the same phone
            number, signed in on the same phone, an invite blocked as the same person, or many friends joining at once. These are hints
            to check, not proof. Open a user to see which account matches, and tap "Not a duplicate" if it's fine.
          </p>
          <TrustCheckBar />
        </>
      )}

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
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="truncate font-medium">{user.full_name || "No name"}</span>
                        <FlagBadge user={user} />
                      </span>
                      <span className="shrink-0 text-[11px] text-muted-foreground">{format(new Date(user.created_at), "d MMM yyyy")}</span>
                    </div>
                    <p className="truncate text-sm text-muted-foreground">{user.email}</p>
                    {user.bank && <BankLine bank={user.bank} compact />}
                    <InviteLine user={user} />
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
                <TableHead>Invites</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={7}><Skeleton className="h-10 w-full" /></TableCell>
                  </TableRow>
                ))
              ) : filteredUsers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No one found</TableCell>
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
                        <FlagBadge user={user} />
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
                    <TableCell className="text-sm">
                      {user.friendsInvited > 0 ? `${user.friendsInvited} invited · ${user.friendsVerified} verified` : <span className="text-muted-foreground">–</span>}
                      {user.invitedBy && <p className="text-[11px] text-muted-foreground">via {user.invitedBy.name}</p>}
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
