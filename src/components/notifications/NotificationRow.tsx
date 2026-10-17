import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { differenceInMinutes, format, isThisWeek, isToday } from "date-fns";
import {
  AlertCircle, BadgePercent, CreditCard, Info, MessageCircle, Package, Phone, ShoppingBag, Star, Trash2, X,
} from "lucide-react";
import { localizedNotification, type Notification } from "@/hooks/useNotifications";
import { cn } from "@/lib/utils";

/** How far a row slides to reveal Delete, and how far a swipe must go to stay open. */
const DELETE_WIDTH_PX = 84;
const OPEN_THRESHOLD_PX = 48;
/** A finger that moves less than this is a tap, not a swipe. */
const TAP_SLOP_PX = 8;
const MINUTES_PER_HOUR = 60;

const CATEGORY_STYLE: Record<Notification["category"], { icon: React.ElementType; tint: string }> = {
  order: { icon: ShoppingBag, tint: "bg-[#0A84FF]/15 text-[#0A84FF]" },
  payment: { icon: CreditCard, tint: "bg-[#30D158]/15 text-[#248A3D] dark:text-[#30D158]" },
  product: { icon: Package, tint: "bg-[#FF9F0A]/15 text-[#C77700] dark:text-[#FF9F0A]" },
  review: { icon: Star, tint: "bg-[#FFD60A]/15 text-[#9A7400] dark:text-[#FFD60A]" },
  system: { icon: AlertCircle, tint: "bg-muted text-muted-foreground" },
  promotion: { icon: BadgePercent, tint: "bg-[#BF5AF2]/15 text-[#8E3CC2] dark:text-[#BF5AF2]" },
  general: { icon: Info, tint: "bg-muted text-muted-foreground" },
  message: { icon: MessageCircle, tint: "bg-[#30D158]/15 text-[#248A3D] dark:text-[#30D158]" },
  call: { icon: Phone, tint: "bg-[#30D158]/15 text-[#248A3D] dark:text-[#30D158]" },
};

/** "now", "5m", "3h" today; weekday this week; date after that. */
function shortTime(iso: string): string {
  const date = new Date(iso);
  const minutes = differenceInMinutes(new Date(), date);
  if (minutes < 1) return "now";
  if (isToday(date)) return minutes < MINUTES_PER_HOUR ? `${minutes}m` : `${Math.floor(minutes / MINUTES_PER_HOUR)}h`;
  if (isThisWeek(date)) return format(date, "EEE");
  return format(date, "d MMM");
}

interface NotificationRowProps {
  notification: Notification;
  isNew: boolean;
  onOpen: (notification: Notification) => void;
  onDelete: (id: string) => void;
}

/**
 * One notification in an inset list. Tap opens it; swipe left (phone) or the
 * x on hover (computer) deletes it.
 */
export function NotificationRow({ notification, isNew, onOpen, onDelete }: NotificationRowProps) {
  const { i18n } = useTranslation();
  const text = localizedNotification(notification, i18n.language ?? "en");
  const style = CATEGORY_STYLE[notification.category] ?? CATEGORY_STYLE.general;
  const Icon = style.icon;
  const unread = !notification.is_read;

  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const swiped = useRef(false);

  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, base: offset };
    swiped.current = false;
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!start.current) return;
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    if (!swiped.current && (Math.abs(dx) < TAP_SLOP_PX || Math.abs(dy) > Math.abs(dx))) return;
    swiped.current = true;
    setDragging(true);
    setOffset(Math.min(0, Math.max(-DELETE_WIDTH_PX * 1.4, start.current.base + dx)));
  };
  const onTouchEnd = () => {
    setDragging(false);
    setOffset((current) => (current < -OPEN_THRESHOLD_PX ? -DELETE_WIDTH_PX : 0));
    start.current = null;
  };

  const handleClick = () => {
    if (swiped.current) return;
    if (offset !== 0) {
      setOffset(0);
      return;
    }
    onOpen(notification);
  };

  return (
    <li className={cn("relative overflow-hidden", isNew && "animate-in fade-in-0 slide-in-from-top-3 duration-500")}>
      {/* Revealed by swiping left. */}
      <button
        type="button"
        onClick={() => onDelete(notification.id)}
        className="absolute inset-y-0 right-0 flex items-center justify-center bg-destructive text-destructive-foreground"
        style={{ width: DELETE_WIDTH_PX }}
        aria-label="Delete notification"
        tabIndex={offset === 0 ? -1 : 0}
      >
        <Trash2 className="h-5 w-5" />
      </button>

      <div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(e) => e.key === "Enter" && onOpen(notification)}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${offset}px)` }}
        className={cn(
          "group relative flex cursor-pointer items-start gap-3 bg-card py-3 pl-3.5 pr-3 active:bg-muted/60",
          !dragging && "transition-transform duration-200 ease-out",
        )}
      >
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", style.tint)}>
          <Icon className="h-[19px] w-[19px]" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <p className={cn("min-w-0 flex-1 truncate text-[15px] leading-tight", unread ? "font-semibold" : "font-medium text-foreground/85")}>
              {text.title}
            </p>
            <span className={cn("shrink-0 text-xs tabular-nums", unread ? "font-medium text-primary" : "text-muted-foreground")}>
              {shortTime(notification.created_at)}
            </span>
          </div>
          <div className="mt-0.5 flex items-start gap-2">
            <p className="line-clamp-2 min-w-0 flex-1 break-words text-[13px] leading-snug text-muted-foreground">{text.message}</p>
            {unread && <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Unread" />}
          </div>
        </div>

        <button
          type="button"
          aria-label="Delete notification"
          className="absolute right-1.5 top-1.5 hidden rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm hover:text-foreground sm:group-hover:block"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(notification.id);
          }}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </li>
  );
}
