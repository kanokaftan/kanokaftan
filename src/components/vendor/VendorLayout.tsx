import { ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Package, ShoppingCart, Settings, LogOut, User, BadgeCheck, Megaphone, CircleFadingPlus,
  MessageCircle, LayoutGrid,
} from "lucide-react";
import { useConversations } from "@/hooks/useChat";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { signOutThisDevice } from "@/lib/signOut";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { BubbleTabBar } from "@/components/layout/BubbleTabBar";

interface VendorLayoutProps {
  children: ReactNode;
  title: string;
}

const navItems = [
  { title: "Dashboard", url: "/vendor/dashboard", icon: LayoutDashboard },
  { title: "Products", url: "/vendor/products", icon: Package },
  { title: "Orders", url: "/vendor/orders", icon: ShoppingCart },
  { title: "Chats", url: "/vendor/messages", icon: MessageCircle },
  { title: "Promote", url: "/vendor/promote", icon: Megaphone },
  { title: "Stories", url: "/vendor/stories", icon: CircleFadingPlus },
  { title: "Verification", url: "/vendor/verification", icon: BadgeCheck },
  { title: "Settings", url: "/vendor/settings", icon: Settings },
];

/** Pages reached from the "More" tab, so that tab stays lit on them. */
const MORE_PATHS = ["/vendor/more", "/vendor/promote", "/vendor/stories", "/vendor/verification", "/vendor/settings", "/vendor/notifications"];

/** Unread customer (and Kano Kaftan) chats for the seller's Chats tab. */
function useSellerUnreadChats(): number {
  const { conversations } = useConversations();
  return conversations.filter((c) => c.unread && (c.role === "vendor" || c.role === "support_user")).length;
}

export function VendorLayout({ children, title }: VendorLayoutProps) {
  const { isLoading, isVendor } = useVendorAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const unreadChats = useSellerUnreadChats();

  const handleLogout = () => signOutThisDevice({ redirectTo: "/vendor/login" });

  if (isLoading || !isVendor) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-muted/30">
      {/* Mobile header: big clear title, alerts on the right (everything else is in the tab bar) */}
      <header className="sticky top-0 z-40 bg-gradient-to-b from-muted via-muted/85 to-transparent px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] md:hidden">
        <div className="liquid-glass flex h-14 items-center justify-between rounded-full pl-5 pr-2">
          <h1 className="truncate text-[17px] font-semibold">{title}</h1>
          <div className="flex items-center gap-1">
            <NotificationBell href="/vendor/notifications" />
          </div>
        </div>
      </header>

      {/* Desktop Layout */}
      <div className="flex-1 flex">
        {/* Desktop Sidebar */}
        <aside className="hidden md:flex md:w-64 md:flex-col md:border-r md:bg-background">
          <div className="h-16 border-b flex items-center px-6">
            <span className="font-semibold text-lg">Vendor Portal</span>
          </div>
          <nav className="flex-1 p-4 space-y-1">
            {navItems.map((item) => (
              <Link
                key={item.url}
                to={item.url}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors",
                  location.pathname === item.url || location.pathname.startsWith(`${item.url}/`)
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span className="flex-1">{item.title}</span>
                {item.url === "/vendor/messages" && unreadChats > 0 && (
                  <span className="rounded-full bg-red-500 px-1.5 text-[11px] font-semibold leading-5 text-white">{unreadChats}</span>
                )}
              </Link>
            ))}
          </nav>
          <div className="p-4 border-t space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start gap-3"
              onClick={() => navigate("/account")}
            >
              <User className="h-4 w-4" />
              Switch to Shopper
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-muted-foreground"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col min-w-0">
          {/* Desktop Header */}
          <header className="hidden md:flex h-16 border-b bg-background items-center px-6">
            <h1 className="text-xl font-semibold">{title}</h1>
          </header>
          <div className="flex-1 p-4 md:p-6 pb-28 md:pb-6">{children}</div>
        </main>
      </div>

      {/* Phone tab bar: the five things sellers do most */}
      <BubbleTabBar
        className="md:hidden"
        items={[
          { href: "/vendor/dashboard", label: "Home", icon: LayoutDashboard },
          { href: "/vendor/products", label: "Products", icon: Package },
          { href: "/vendor/orders", label: "Orders", icon: ShoppingCart },
          { href: "/vendor/messages", label: "Chats", icon: MessageCircle, badge: unreadChats },
          {
            href: "/vendor/more",
            label: "More",
            icon: LayoutGrid,
            match: (pathname) => MORE_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)),
          },
        ]}
      />
    </div>
  );
}

export { useVendorAuth };
