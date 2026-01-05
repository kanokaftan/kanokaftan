import { Bell, Check, CheckCheck, Trash2, Package, CreditCard, AlertCircle, Info, Star, Megaphone } from "lucide-react";
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

const categoryIcons = {
  order: Package,
  payment: CreditCard,
  product: Package,
  review: Star,
  system: AlertCircle,
  promotion: Megaphone,
  general: Info,
};

const typeColors = {
  info: "bg-blue-100 text-blue-600",
  success: "bg-green-100 text-green-600",
  warning: "bg-yellow-100 text-yellow-600",
  order: "bg-purple-100 text-purple-600",
  payment: "bg-emerald-100 text-emerald-600",
  system: "bg-gray-100 text-gray-600",
};

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (url: string | null) => void;
}

function NotificationItem({ notification, onMarkAsRead, onDelete, onNavigate }: NotificationItemProps) {
  const Icon = categoryIcons[notification.category] || Info;
  
  return (
    <div
      className={cn(
        "p-3 border-b last:border-b-0 hover:bg-muted/50 transition-colors cursor-pointer",
        !notification.is_read && "bg-primary/5"
      )}
      onClick={() => {
        if (!notification.is_read) {
          onMarkAsRead(notification.id);
        }
        onNavigate(notification.action_url);
      }}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-full shrink-0", typeColors[notification.type])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className={cn("text-sm font-medium truncate", !notification.is_read && "font-semibold")}>
              {notification.title}
            </p>
            {!notification.is_read && (
              <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
            )}
          </div>
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
            {notification.message}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100"
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
    clearAll 
  } = useNotifications();

  const handleNavigate = (url: string | null) => {
    if (url) {
      navigate(url);
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-medium">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between p-3 border-b">
          <h4 className="font-semibold">Notifications</h4>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => markAllAsRead.mutate()}
              >
                <CheckCheck className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>
        
        <ScrollArea className="h-[300px]">
          {isLoading ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="group">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onMarkAsRead={(id) => markAsRead.mutate(id)}
                  onDelete={(id) => deleteNotification.mutate(id)}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {notifications.length > 0 && (
          <div className="p-2 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground"
              onClick={() => clearAll.mutate()}
            >
              <Trash2 className="h-3 w-3 mr-1" />
              Clear all notifications
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
