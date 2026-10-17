import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isThisWeek, isToday, isYesterday } from "date-fns";
import { Bell, CheckCheck, ChevronLeft, Loader2, Settings2, Trash2 } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { VendorLayout } from "@/components/vendor/VendorLayout";
import { NotificationRow } from "@/components/notifications/NotificationRow";
import { NotificationSettingsSheet } from "@/components/notifications/NotificationSettingsSheet";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { LanguageToggle } from "@/components/LanguageToggle";

type Area = "shop" | "seller" | "admin";
type Category = Notification["category"];
type Filter = "all" | "unread" | "orders" | "messages" | "payments" | "reviews" | "offers" | "updates";

/** How long a freshly arrived notification keeps its slide-in highlight. */
const NEW_HIGHLIGHT_MS = 2000;
const SKELETON_ROWS = 5;

/** Chips above the list. Topic chips only show when there is something in them. */
const FILTERS: { value: Filter; label: string; categories?: Category[] }[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "orders", label: "Orders", categories: ["order", "product"] },
  { value: "messages", label: "Messages", categories: ["message", "call"] },
  { value: "payments", label: "Payments", categories: ["payment"] },
  { value: "reviews", label: "Reviews", categories: ["review"] },
  { value: "offers", label: "Offers", categories: ["promotion"] },
  { value: "updates", label: "Updates", categories: ["system", "general"] },
];

function matches(filter: Filter, n: Notification): boolean {
  if (filter === "all") return true;
  if (filter === "unread") return !n.is_read;
  return FILTERS.find((f) => f.value === filter)?.categories?.includes(n.category) ?? false;
}

function groupLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  if (isThisWeek(date)) return "This week";
  return "Earlier";
}

/** Today / Yesterday / This week / Earlier, keeping the newest-first order. */
function groupByDay(list: Notification[]): { label: string; items: Notification[] }[] {
  const groups: { label: string; items: Notification[] }[] = [];
  for (const n of list) {
    const label = groupLabel(new Date(n.created_at));
    const last = groups[groups.length - 1];
    if (last?.label === label) last.items.push(n);
    else groups.push({ label, items: [n] });
  }
  return groups;
}

const EMPTY_TEXT: Record<Filter, { title: string; body: string }> = {
  all: { title: "You're all caught up", body: "Order updates, messages and offers will show up here." },
  unread: { title: "Nothing unread", body: "You've read everything. Nice." },
  orders: { title: "No order updates", body: "When an order is placed, shipped or delivered, you'll see it here." },
  messages: { title: "No messages", body: "New chats and missed calls will show up here." },
  payments: { title: "No payment updates", body: "Payments and payouts will show up here." },
  reviews: { title: "No reviews yet", body: "Reviews and replies will show up here." },
  offers: { title: "No offers right now", body: "Deals from shops you follow will show up here." },
  updates: { title: "No updates", body: "News from Kano Kaftan will show up here." },
};

function IconButton({ label, onClick, disabled, children, className }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn("flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-foreground/5 active:scale-95 disabled:opacity-40", className)}
    >
      {children}
    </button>
  );
}

function NotificationsContent({ area }: { area: Area }) {
  const navigate = useNavigate();
  const { notifications, unreadCount, isLoading, markAsRead, markAllAsRead, deleteNotification, clearAll } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const [confirmClear, setConfirmClear] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const seenIds = useRef<Set<string> | null>(null);

  // Notifications that arrive while the page is open slide in.
  useEffect(() => {
    if (isLoading) return;
    const ids = new Set(notifications.map((n) => n.id));
    if (seenIds.current) {
      const incoming = notifications.filter((n) => !seenIds.current!.has(n.id)).map((n) => n.id);
      if (incoming.length) {
        setNewIds((prev) => new Set([...prev, ...incoming]));
        window.setTimeout(() => setNewIds((prev) => new Set([...prev].filter((id) => !incoming.includes(id)))), NEW_HIGHLIGHT_MS);
      }
    }
    seenIds.current = ids;
  }, [notifications, isLoading]);

  const chips = useMemo(
    () =>
      FILTERS.map((f) => ({ ...f, count: notifications.filter((n) => matches(f.value, n)).length })).filter(
        (f) => f.value === "all" || f.value === "unread" || f.count > 0 || f.value === filter,
      ),
    [notifications, filter],
  );

  const visible = notifications.filter((n) => matches(filter, n));
  const groups = groupByDay(visible);
  const empty = EMPTY_TEXT[filter];

  const openNotification = (n: Notification) => {
    if (!n.is_read) markAsRead.mutate(n.id);
    if (n.action_url) navigate(n.action_url);
  };

  return (
    <div className={cn("pb-24", area === "shop" && "pt-1")}>
      {/* Large title with a glass pill of actions, iOS style */}
      <div className="flex items-center gap-1 px-4">
        {area === "shop" && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="-ml-2 flex h-9 w-9 items-center justify-center rounded-full active:bg-muted"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <div className="liquid-glass ml-auto flex h-11 items-center gap-0.5 rounded-full px-1">
          <IconButton label="Mark all as read" onClick={() => markAllAsRead.mutate()} disabled={unreadCount === 0 || markAllAsRead.isPending}>
            <CheckCheck className="h-[19px] w-[19px]" />
          </IconButton>
          <IconButton label="Clear all notifications" onClick={() => setConfirmClear(true)} disabled={notifications.length === 0}>
            <Trash2 className="h-[18px] w-[18px]" />
          </IconButton>
          <IconButton label="Notification settings" onClick={() => setSettingsOpen(true)}>
            <Settings2 className="h-[19px] w-[19px]" />
          </IconButton>
        </div>
      </div>

      <div className="mt-1 flex items-end justify-between gap-3 px-4">
        <div className="min-w-0">
          <h1 className="font-display text-[28px] font-bold leading-tight">Notifications</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {isLoading ? "Loading…" : unreadCount > 0 ? `${unreadCount} unread` : "No new notifications"}
          </p>
        </div>
        <LanguageToggle className="mb-0.5 shrink-0" />
      </div>

      {/* One row of chips */}
      <div className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" role="tablist" aria-label="Filter notifications">
        {chips.map((chip) => {
          const active = filter === chip.value;
          return (
            <button
              key={chip.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(chip.value)}
              className={cn(
                "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] font-medium transition-colors active:scale-95",
                active ? "border-foreground bg-foreground text-background" : "bg-background",
              )}
            >
              {chip.label}
              {chip.value !== "all" && chip.count > 0 && (
                <span className={cn("tabular-nums", active ? "text-background/70" : "text-muted-foreground")}>{chip.count}</span>
              )}
            </button>
          );
        })}
      </div>

      {isLoading ? (
        <div className="mx-4 mt-4 overflow-hidden rounded-2xl border bg-card">
          {Array.from({ length: SKELETON_ROWS }, (_, i) => (
            <div key={i} className="flex animate-pulse gap-3 border-b px-3.5 py-3 last:border-b-0">
              <div className="h-10 w-10 shrink-0 rounded-xl bg-muted" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="px-8 py-20 text-center animate-in fade-in-0 duration-300">
          <div className="liquid-glass mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-[28px]">
            <Bell className="h-9 w-9 text-muted-foreground" />
          </div>
          <p className="text-lg font-semibold">{empty.title}</p>
          <p className="mt-1 text-sm text-muted-foreground">{empty.body}</p>
          {filter !== "all" && (
            <Button variant="outline" size="sm" className="mt-4 rounded-full" onClick={() => setFilter("all")}>
              Show all
            </Button>
          )}
        </div>
      ) : (
        <>
          {groups.map((group) => (
            <section key={group.label} aria-label={group.label} className="mt-4 px-4">
              <h2 className="mb-1.5 px-1 text-[13px] font-semibold text-muted-foreground">{group.label}</h2>
              <ul className="divide-y divide-border/70 overflow-hidden rounded-2xl border bg-card">
                {group.items.map((notification) => (
                  <NotificationRow
                    key={notification.id}
                    notification={notification}
                    isNew={newIds.has(notification.id)}
                    onOpen={openNotification}
                    onDelete={(id) => deleteNotification.mutate(id)}
                  />
                ))}
              </ul>
            </section>
          ))}
          <p className="mt-4 px-4 text-center text-xs text-muted-foreground sm:hidden">Swipe left on a notification to delete it.</p>
        </>
      )}

      <NotificationSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="max-w-[90vw] rounded-2xl md:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription>This removes them from this list. It can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => clearAll.mutate(undefined, { onSettled: () => setConfirmClear(false) })}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearAll.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** Full notifications page, inside the shop, seller or admin layout. */
export default function NotificationsPage({ area = "shop" }: { area?: Area }) {
  if (area === "admin") {
    return (
      <AdminLayout title="Notifications">
        <div className="-mx-4 md:mx-0">
          <NotificationsContent area={area} />
        </div>
      </AdminLayout>
    );
  }
  if (area === "seller") {
    return (
      <VendorLayout title="Notifications">
        <div className="-mx-4 md:mx-0">
          <NotificationsContent area={area} />
        </div>
      </VendorLayout>
    );
  }
  return (
    <MobileLayout>
      <NotificationsContent area={area} />
    </MobileLayout>
  );
}
