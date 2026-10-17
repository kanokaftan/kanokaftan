import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/useNotifications";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

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
    <Button asChild variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
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
