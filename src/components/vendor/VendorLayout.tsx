import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { 
  LayoutDashboard, Package, ShoppingCart, Settings, 
  Menu, X, LogOut, User, ChevronLeft 
} from "lucide-react";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

interface VendorLayoutProps {
  children: ReactNode;
  title: string;
}

const navItems = [
  { title: "Dashboard", url: "/vendor/dashboard", icon: LayoutDashboard },
  { title: "Products", url: "/vendor/products", icon: Package },
  { title: "Orders", url: "/vendor/orders", icon: ShoppingCart },
  { title: "Settings", url: "/vendor/settings", icon: Settings },
];

export function VendorLayout({ children, title }: VendorLayoutProps) {
  const { isLoading } = useVendorAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (isLoading) {
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
      {/* Mobile Header */}
      <header className="sticky top-0 z-50 h-14 border-b bg-background flex items-center justify-between px-4 md:hidden">
        <div className="flex items-center gap-3">
          <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetHeader className="p-4 border-b">
                <SheetTitle>Vendor Portal</SheetTitle>
              </SheetHeader>
              <nav className="flex flex-col p-2">
                {navItems.map((item) => (
                  <Link
                    key={item.url}
                    to={item.url}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-lg transition-colors",
                      location.pathname === item.url
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    <span>{item.title}</span>
                  </Link>
                ))}
                <div className="border-t my-2" />
                <Link
                  to="/account"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted"
                >
                  <User className="h-5 w-5" />
                  <span>Switch to Shopper</span>
                </Link>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-muted text-left text-muted-foreground"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Logout</span>
                </button>
              </nav>
            </SheetContent>
          </Sheet>
          <h1 className="font-semibold">{title}</h1>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => navigate("/account")}
        >
          <User className="h-5 w-5" />
        </Button>
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
                  location.pathname === item.url
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.title}</span>
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
          <div className="flex-1 p-4 md:p-6 pb-20 md:pb-6">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t bg-background">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => (
            <Link
              key={item.url}
              to={item.url}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors",
                location.pathname === item.url
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.title}</span>
            </Link>
          ))}
        </div>
      </nav>
    </div>
  );
}

export { useVendorAuth };
