import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isToday, isYesterday } from "date-fns";
import { Bell, CheckCheck, ChevronLeft, Loader2, Settings2, Trash2 } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { VendorLayout } from "@/components/vendor/VendorLayout";
import { NotificationItem } from "@/components/notifications/NotificationBell";
import { NotificationSettingsSheet } from "@/components/notifications/NotificationSettingsSheet";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

type Area = "shop" | "seller" | "admin";
type Filter = "all" | "unread";

/** How long a freshly arrived notification keeps its slide-in highlight. */
const NEW_HIGHLIGHT_MS = 2000;

function groupLabel(date: Date): string {
  if (isToday(date)) return "Today";
  if (isYesterday(date)) return "Yesterday";
  return "Earlier";
}

/** Today / Yesterday / Earlier, keeping the newest-first order. */
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

  const visible = filter === "unread" ? notifications.filter((n) => !n.is_read) : notifications;
  const groups = groupByDay(visible);

  const open = (url: string | null) => {
    if (url) navigate(url);
  };

  return (
    <div className={cn(area === "shop" && "pt-2")}>
      {/* Title row */}
      <div className="mb-3 flex items-center gap-2 px-4">
        {area === "shop" && (
          <Button variant="ghost" size="icon" className="-ml-2 h-9 w-9 rounded-full" onClick={() => navigate(-1)} aria-label="Back">
            <ChevronLeft className="h-5 w-5" />
          </Button>
        )}
        <h1 className={cn("font-display text-2xl font-bold", area !== "shop" && "sr-only")}>Notifications</h1>
        {unreadCount > 0 && (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground animate-in zoom-in-50">
            {unreadCount} new
          </span>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-9 w-9 rounded-full"
          onClick={() => setSettingsOpen(true)}
          aria-label="Notification settings"
        >
          <Settings2 className="h-5 w-5" />
        </Button>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2 px-4">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="h-9 rounded-full">
            <TabsTrigger value="all" className="rounded-full px-4">All</TabsTrigger>
            <TabsTrigger value="unread" className="rounded-full px-4">Unread</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="h-9 rounded-full text-xs" onClick={() => markAllAsRead.mutate()} disabled={markAllAsRead.isPending}>
              <CheckCheck className="mr-1 h-4 w-4" /> Mark all read
            </Button>
          )}
          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 rounded-full text-muted-foreground hover:text-destructive"
              onClick={() => setConfirmClear(true)}
              aria-label="Clear all notifications"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-4 px-4 py-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex animate-pulse gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-muted" />
              <div className="flex-1 space-y-2 pt-1">
                <div className="h-3 w-3/4 rounded bg-muted" />
                <div className="h-3 w-1/2 rounded bg-muted" />
              </div>
            </div>
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="px-6 py-20 text-center animate-in fade-in-0 duration-300">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Bell className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="font-medium">{filter === "unread" ? "No unread notifications" : "All caught up!"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filter === "unread" ? "You've read everything." : "Order updates, messages and offers will show up here."}
          </p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.label} aria-label={group.label}>
            <h2 className="px-4 pb-1 pt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.label}</h2>
            <div>
              {group.items.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  isNew={newIds.has(notification.id)}
                  onMarkAsRead={(id) => markAsRead.mutate(id)}
                  onDelete={(id) => deleteNotification.mutate(id)}
                  onNavigate={open}
                />
              ))}
            </div>
          </section>
        ))
      )}

      <NotificationSettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent className="rounded-2xl">
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
