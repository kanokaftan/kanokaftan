import { useEffect, useRef, useState } from "react";
import { Bell, Package, CreditCard, AlertCircle, Info, Star, Megaphone, MessageCircle, X, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications, Notification, localizedNotification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const categoryIcons: Record<string, React.ElementType> = {
  order: Package,
  payment: CreditCard,
  product: Package,
  review: Star,
  system: AlertCircle,
  promotion: Megaphone,
  general: MessageCircle,
  message: MessageCircle,
  call: Phone,
};

const typeColors: Record<string, string> = {
  info: "bg-muted text-foreground",
  success: "bg-muted text-foreground",
  warning: "bg-muted text-foreground",
  order: "bg-primary/10 text-primary",
  payment: "bg-muted text-foreground",
  system: "bg-muted text-muted-foreground",
};

export interface NotificationItemProps {
  notification: Notification;
  isNew: boolean;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string | null) => void;
}

export function NotificationItem({ notification, isNew, onMarkAsRead, onDelete, onNavigate }: NotificationItemProps) {
  const Icon = categoryIcons[notification.category] || Info;
  const { i18n } = useTranslation();
  const text = localizedNotification(notification, i18n.language ?? "en");

  return (
    <div
      role="button"
      tabIndex={0}
      className={cn(
        "group relative flex cursor-pointer items-start gap-3 pl-4 transition-colors hover:bg-muted/40 active:bg-muted/70",
        !notification.is_read && "bg-primary/[0.04]",
        isNew && "animate-in fade-in-0 slide-in-from-top-3 duration-400"
      )}
      onClick={() => {
        if (!notification.is_read) onMarkAsRead(notification.id);
        onNavigate(notification.action_url);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          if (!notification.is_read) onMarkAsRead(notification.id);
          onNavigate(notification.action_url);
        }
      }}
    >
      <div className={cn("mt-3 flex h-10 w-10 shrink-0 items-center justify-center rounded-full", typeColors[notification.type] || typeColors.info)}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      {/* WhatsApp-style divider: starts after the icon, none under the last row */}
      <div className="min-w-0 flex-1 border-b border-border/60 py-3 pr-10 group-last:border-b-0">
        <p className={cn("line-clamp-2 break-words text-sm leading-snug", !notification.is_read ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
          {text.title}
        </p>
        <p className="mt-0.5 line-clamp-2 break-words text-xs leading-relaxed text-muted-foreground">
          {text.message}
        </p>
        <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground/70">
          {!notification.is_read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />}
          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
        </p>
      </div>
      <button
        type="button"
        aria-label="Delete notification"
        className="absolute right-2 top-2.5 rounded-full p-1.5 text-muted-foreground/60 transition-opacity hover:bg-muted hover:text-foreground sm:opacity-0 sm:group-hover:opacity-100"
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

interface NotificationBellProps {
  /** The notifications page for this part of the app (shop, seller or admin). */
  href?: string;
}

/** Bell with an unread badge; opens the full notifications page. */
export function NotificationBell({ href = "/notifications" }: NotificationBellProps) {
  const { notifications, unreadCount, isLoading } = useNotifications();
  const [isWiggling, setIsWiggling] = useState(false);
  const [badgeKey, setBadgeKey] = useState(0);
  const prevNotifIdsRef = useRef<Set<string>>(new Set(notifications.map((n) => n.id)));
  // Skip the animation for the first batch loaded from the server
  const hasLoadedRef = useRef(!isLoading && notifications.length > 0);

  // Wiggle the bell and pop the badge when something new arrives.
  useEffect(() => {
    const incoming = hasLoadedRef.current ? notifications.filter((n) => !prevNotifIdsRef.current.has(n.id)) : [];
    if (!isLoading) hasLoadedRef.current = true;
    prevNotifIdsRef.current = new Set(notifications.map((n) => n.id));
    if (incoming.length === 0) return;
    setIsWiggling(true);
    setBadgeKey((k) => k + 1);
    const timer = window.setTimeout(() => setIsWiggling(false), 600);
    return () => window.clearTimeout(timer);
  }, [notifications, isLoading]);

  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link to={href} aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}>
        <Bell className={cn("h-5 w-5 transition-transform", isWiggling && "animate-wiggle")} />
        {unreadCount > 0 && (
          <span
            key={badgeKey}
            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-xs font-bold text-destructive-foreground animate-in zoom-in-50 duration-300"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Link>
    </Button>
  );
}
