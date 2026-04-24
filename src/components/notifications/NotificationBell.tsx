import { useEffect, useRef, useState } from "react";
import { Bell, CheckCheck, Trash2, Package, CreditCard, AlertCircle, Info, Star, Megaphone, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNotifications, Notification } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

const categoryIcons: Record<string, React.ElementType> = {
  order: Package,
  payment: CreditCard,
  product: Package,
  review: Star,
  system: AlertCircle,
  promotion: Megaphone,
  general: MessageCircle,
};

const typeColors: Record<string, string> = {
  info: "bg-blue-100 text-blue-600",
  success: "bg-green-100 text-green-600",
  warning: "bg-yellow-100 text-yellow-600",
  order: "bg-primary/10 text-primary",
  payment: "bg-emerald-100 text-emerald-600",
  system: "bg-muted text-muted-foreground",
};

interface NotificationItemProps {
  notification: Notification;
  isNew: boolean;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string | null) => void;
}

function NotificationItem({ notification, isNew, onMarkAsRead, onDelete, onNavigate }: NotificationItemProps) {
  const Icon = categoryIcons[notification.category] || Info;

  return (
    <div
      className={cn(
        "group p-3 border-b last:border-b-0 hover:bg-muted/50 transition-all duration-200 cursor-pointer",
        !notification.is_read && "bg-primary/5",
        isNew && "animate-in fade-in-0 slide-in-from-top-3 duration-400"
      )}
      onClick={() => {
        if (!notification.is_read) onMarkAsRead(notification.id);
        onNavigate(notification.action_url);
      }}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-full shrink-0 transition-transform group-hover:scale-110", typeColors[notification.type] || typeColors.info)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("text-sm truncate", !notification.is_read ? "font-semibold text-foreground" : "font-medium text-foreground/80")}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
            {notification.message}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

export function NotificationBell() {
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  const [isWiggling, setIsWiggling] = useState(false);
  const [badgeKey, setBadgeKey] = useState(0);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const prevCountRef = useRef(unreadCount);
  const prevNotifIdsRef = useRef<Set<string>>(new Set(notifications.map((n) => n.id)));

  // Detect new notifications and trigger animations
  useEffect(() => {
    const currentIds = new Set(notifications.map((n) => n.id));
    const incoming = notifications.filter((n) => !prevNotifIdsRef.current.has(n.id));

    if (incoming.length > 0) {
      // Wiggle bell
      setIsWiggling(true);
      setTimeout(() => setIsWiggling(false), 600);

      // Pop badge
      setBadgeKey((k) => k + 1);

      // Mark incoming as "new" for slide-in animation, clear after 2s
      setNewIds((prev) => {
        const next = new Set(prev);
        incoming.forEach((n) => next.add(n.id));
        return next;
      });
      setTimeout(() => {
        setNewIds((prev) => {
          const next = new Set(prev);
          incoming.forEach((n) => next.delete(n.id));
          return next;
        });
      }, 2000);
    }

    prevNotifIdsRef.current = currentIds;
    prevCountRef.current = unreadCount;
  }, [notifications, unreadCount]);

  const handleNavigate = (url: string | null) => {
    if (url) navigate(url);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className={cn("h-5 w-5 transition-transform", isWiggling && "animate-wiggle")} />
          {unreadCount > 0 && (
            <span
              key={badgeKey}
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold animate-in zoom-in-50 duration-300"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0 shadow-lg" align="end">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-muted/30">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h4 className="font-semibold text-sm">Notifications</h4>
            {unreadCount > 0 && (
              <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-medium">
                {unreadCount} new
              </span>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => markAllAsRead.mutate()}
            >
              <CheckCheck className="h-3 w-3 mr-1" />
              Mark all read
            </Button>
          )}
        </div>

        <ScrollArea className="h-[320px]">
          {isLoading ? (
            <div className="space-y-3 p-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-3 animate-pulse">
                  <div className="h-9 w-9 rounded-full bg-muted shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center animate-in fade-in-0 duration-300">
              <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                <Bell className="h-7 w-7 text-muted-foreground/50" />
              </div>
              <p className="text-sm font-medium text-foreground">All caught up!</p>
              <p className="text-xs text-muted-foreground mt-1">No notifications yet</p>
            </div>
          ) : (
            <div>
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  isNew={newIds.has(notification.id)}
                  onMarkAsRead={(id) => markAsRead.mutate(id)}
                  onDelete={(id) => deleteNotification.mutate(id)}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-2 border-t bg-muted/20">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={() => clearAll.mutate()}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear all
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
