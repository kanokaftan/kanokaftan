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
import { useState } from "react";
import { ChevronRight, Download, Landmark, Loader2, ShieldAlert, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { downloadCsv } from "@/lib/csv";
import { CopyNumber } from "@/components/admin/CopyNumber";
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
  "Name", "Email", "Phone", "Joined", "Bank", "Account name", "Account number", "Bank linked on",
  "Invited by", "Friends invited", "Friends verified", "K² earned", "Warnings",
];

const dateOrBlank = (value: string | null | undefined) => (value ? format(new Date(value), "yyyy-MM-dd") : "");

function toCsvRow(user: AdminUser): unknown[] {
  return [
    user.full_name ?? "", user.email, user.phone ?? "", dateOrBlank(user.created_at),
    user.bank?.bank_name ?? "", user.bank?.account_name ?? "", user.bank ? (user.bank.account_number ?? `••${user.bank.last4} (full number not saved)`) : "", dateOrBlank(user.bank?.verified_at),
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

/** Bank, account name and full account number (copyable) a user linked. */
function BankDetails({ bank }: { bank: NonNullable<AdminUser["bank"]> }) {
  return (
    <div className="min-w-0 text-sm">
      <p className="flex items-center gap-1.5 text-xs font-medium text-green-700 dark:text-green-400">
        <Landmark className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span className="break-words">{bank.bank_name}</span>
      </p>
      <p className="break-words font-medium">{bank.account_name}</p>
      {bank.account_number ? (
        <CopyNumber value={bank.account_number} />
      ) : (
        <p className="text-xs text-muted-foreground">••{bank.last4} · full number not saved yet (linked before it was kept)</p>
      )}
    </div>
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
          Bank, account name (checked with Paystack against the user's name) and account number, ready to copy for paying someone
          by hand. Accounts linked before 20 Oct only kept the last 4 digits; those users are asked to confirm their number once.
          Each bank account can belong to one user only.
        </p>
      )}

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span className="text-destructive">{error instanceof Error ? error.message : "Couldn't load people."}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      )}

      {/* One list for every screen size: rows stack on phones and spread into columns on wider screens, never wider than the page. */}
      {isLoading ? (
        [...Array(6)].map((_, i) => <Skeleton key={i} className="mb-3 h-20 w-full rounded-2xl" />)
      ) : users.length === 0 ? (
        <p className="py-8 text-center text-muted-foreground">No one found</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {users.map((user) => (
            <li key={user.id}>
              <div
                role="link"
                tabIndex={0}
                onClick={() => open(user)}
                onKeyDown={(e) => e.key === "Enter" && open(user)}
                className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 p-3 transition-colors hover:bg-muted/40 active:bg-muted/60 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.3fr)_minmax(0,0.8fr)_auto] md:items-center md:px-4"
              >
                <Avatar className="h-10 w-10">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback>{initial(user)}</AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                    <span className="break-words font-medium">{user.full_name || "No name"}</span>
                    <FlagBadge user={user} />
                  </p>
                  <p className="break-all text-sm text-muted-foreground">{user.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {user.phone || "No phone"} · joined {format(new Date(user.created_at), "d MMM yyyy")}
                  </p>
                </div>

                <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground md:order-last" aria-hidden="true" />

                <div className="col-span-3 col-start-1 min-w-0 pl-[52px] md:col-span-1 md:col-start-auto md:pl-0">
                  {user.bank ? <BankDetails bank={user.bank} /> : <span className="text-xs text-muted-foreground">Bank not linked</span>}
                </div>

                <div className="col-span-3 col-start-1 min-w-0 pl-[52px] text-sm md:col-span-1 md:col-start-auto md:pl-0">
                  {user.friendsInvited > 0 ? (
                    <p>{user.friendsInvited} invited · {user.friendsVerified} verified</p>
                  ) : (
                    <p className="text-xs text-muted-foreground">No invites</p>
                  )}
                  {user.invitedBy && <p className="break-words text-xs text-muted-foreground">Joined via {user.invitedBy.name}</p>}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mb-20 md:mb-0">
        <AdminPagination page={page} totalPages={totalPages} totalItems={total} pageSize={PAGE_SIZE} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}
