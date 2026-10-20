import { Link, useNavigate } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { ChevronRight, Clock, Gift, ShieldAlert, Store, UserCheck, UserPlus, Users, Wallet } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { AdminListToolbar, type ListChip } from "@/components/admin/AdminListToolbar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminListState, useKeepPageInRange } from "@/hooks/useAdminListState";
import { totalPagesOf } from "@/hooks/adminList";
import { DEFAULT_REFERRER_SORT, REFERRER_SORTS, useAdminReferrers, type Referrer, type ReferrerSort } from "@/hooks/useAdminReferrers";
import { k2 } from "@/lib/k2";
import { cn } from "@/lib/utils";

const SORT_LABELS: Record<ReferrerSort, string> = {
  earned: "Most earned",
  invited: "Most invited",
  verified: "Most verified",
  recent: "Latest invite",
};

function Tile({ icon: Icon, label, value, sub, tone }: { icon: typeof Users; label: string; value: string; sub?: string; tone?: "warn" }) {
  return (
    <div className={cn("rounded-2xl border bg-card p-3", tone === "warn" && "border-amber-500/40 bg-amber-500/5")}>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ReferrerRow({ r, onOpen }: { r: Referrer; onOpen: () => void }) {
  const name = r.full_name || r.email;
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 p-3 transition-colors hover:bg-muted/40 active:bg-muted/60 md:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1fr)_auto] md:items-center md:px-4"
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={r.avatar_url || undefined} />
        <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>

      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-1.5">
          <span className="break-words font-medium">{name}</span>
          {r.is_seller && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
              <Store className="h-3 w-3" />Seller
            </span>
          )}
        </p>
        <p className="break-all text-xs text-muted-foreground">{r.email}</p>
        {r.last_invite_at && (
          <p className="text-[11px] text-muted-foreground">Last friend joined {formatDistanceToNowStrict(new Date(r.last_invite_at), { addSuffix: true })}</p>
        )}
      </div>

      <ChevronRight className="h-4 w-4 shrink-0 self-center text-muted-foreground md:order-last" aria-hidden="true" />

      <div className="col-span-3 col-start-1 min-w-0 pl-[52px] text-sm md:col-span-1 md:col-start-auto md:pl-0">
        <p className="font-medium">{r.invited} invited · {r.verified} verified</p>
        <p className="text-xs text-muted-foreground">
          {[r.waiting > 0 && `${r.waiting} waiting to verify`, r.held > 0 && `${r.held} on hold`, r.blocked > 0 && `${r.blocked} blocked`]
            .filter(Boolean).join(" · ") || "Everyone verified"}
        </p>
      </div>

      <div className="col-span-3 col-start-1 min-w-0 pl-[52px] text-sm md:col-span-1 md:col-start-auto md:pl-0">
        <p className="font-semibold text-green-700 dark:text-green-400">{k2(r.earned_k2)} earned</p>
        <p className="text-xs text-muted-foreground">
          {k2(r.reward_k2)} invites{r.commission_k2 > 0 ? ` + ${k2(r.commission_k2)} from orders` : ""} · {k2(r.balance_k2)} left to spend
        </p>
      </div>
    </div>
  );
}

/** Admin: who invites people, how many joined and verified, and what they earned. */
export default function AdminReferrals() {
  const navigate = useNavigate();
  const list = useAdminListState({ filters: REFERRER_SORTS, defaultFilter: DEFAULT_REFERRER_SORT });
  const { data, isLoading, isFetching, error, refetch } = useAdminReferrers(list.params);
  const { page, setPage, pageSize } = list;
  const total = data?.total ?? 0;
  useKeepPageInRange(page, setPage, isLoading ? undefined : total, pageSize);
  const t = data?.totals;
  const chips: ListChip<ReferrerSort>[] = REFERRER_SORTS.map((sort) => ({ value: sort, label: SORT_LABELS[sort] }));
  const open = (r: Referrer) => navigate(r.is_seller ? `/admin/vendors/${r.id}` : `/admin/users/${r.id}`);

  return (
    <AdminLayout title="Referrals">
      <div className="mb-4 grid grid-cols-2 gap-2 md:grid-cols-4">
        {t ? (
          <>
            <Tile icon={UserPlus} label="People inviting" value={t.referrers.toLocaleString()} />
            <Tile icon={Users} label="Friends joined" value={t.invited.toLocaleString()} sub={`${t.waiting} waiting to verify`} />
            <Tile icon={UserCheck} label="Friends verified" value={t.verified.toLocaleString()}
              sub={t.invited ? `${Math.round((t.verified / t.invited) * 100)}% of those who joined` : undefined} />
            <Tile icon={Wallet} label="K² earned" value={k2(t.reward_k2 + t.commission_k2)}
              sub={`${k2(t.reward_k2)} invites · ${k2(t.commission_k2)} orders`} />
          </>
        ) : (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)
        )}
      </div>

      {t && t.held > 0 && (
        <Link to="/admin/users?filter=suspicious" className="mb-4 flex items-center gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="flex-1">{t.held} invite {t.held === 1 ? "reward is" : "rewards are"} on hold, waiting for you to approve or reject.</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>
      )}

      <AdminListToolbar
        search={list.search}
        onSearchChange={list.setSearch}
        placeholder="Search name or email"
        chips={chips}
        filter={list.filter}
        onFilterChange={list.setFilter}
        total={isLoading ? undefined : total}
        noun={["person inviting", "people inviting"]}
        busy={list.isSearchPending || isFetching}
        actions={
          <Button asChild variant="outline" size="sm" className="h-8 rounded-full">
            <Link to="/admin/settings"><Gift className="mr-1.5 h-3.5 w-3.5" />Reward settings</Link>
          </Button>
        }
      />

      {error && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
          <span className="text-destructive">{error instanceof Error ? error.message : "Couldn't load referrals."}</span>
          <Button variant="outline" size="sm" onClick={() => refetch()}>Try again</Button>
        </div>
      )}

      {isLoading ? (
        [...Array(5)].map((_, i) => <Skeleton key={i} className="mb-3 h-20 w-full rounded-2xl" />)
      ) : !data?.rows.length ? (
        <div className="rounded-2xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Clock className="mx-auto mb-2 h-6 w-6" />
          No one has invited friends yet{list.search ? " matching this search" : ""}.
        </div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {data.rows.map((r) => (
            <li key={r.id}><ReferrerRow r={r} onOpen={() => open(r)} /></li>
          ))}
        </ul>
      )}

      <div className="mb-20 md:mb-0">
        <AdminPagination page={page} totalPages={totalPagesOf(total, pageSize)} totalItems={total} pageSize={pageSize} onPageChange={setPage} />
      </div>
    </AdminLayout>
  );
}
