import { ReactNode, useEffect, useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { LogOut, MoreHorizontal, Search, ShoppingBag } from "lucide-react";
import { signOutThisDevice } from "@/lib/signOut";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAdminOverview, type AdminOverview } from "@/hooks/useAdminOverview";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ADMIN_NAV, ADMIN_NAV_ITEMS, ADMIN_TAB_URLS, isActivePath, type AdminNavItem } from "@/components/admin/adminNav";
import { cn } from "@/lib/utils";

interface AdminLayoutProps {
  children: ReactNode;
  title: string;
}

const MAX_BADGE = 99;

function CountBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span className={cn("min-w-[1.25rem] rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-semibold leading-none text-destructive-foreground", className)}>
      {count > MAX_BADGE ? `${MAX_BADGE}+` : count}
    </span>
  );
}

function itemCount(item: AdminNavItem, overview: AdminOverview | undefined): number {
  return overview && item.count ? item.count(overview) : 0;
}

/** Quick search: jump to any admin page, or look up an order, seller, customer or product by name. */
function AdminQuickSearch({ open, onOpenChange, overview }: { open: boolean; onOpenChange: (open: boolean) => void; overview?: AdminOverview }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const go = (url: string) => {
    onOpenChange(false);
    navigate(url);
  };
  const q = query.trim();
  const searches = q
    ? [
        { label: `Orders matching "${q}"`, url: `/admin/orders?q=${encodeURIComponent(q)}` },
        { label: `Sellers matching "${q}"`, url: `/admin/vendors?q=${encodeURIComponent(q)}` },
        { label: `Customers matching "${q}"`, url: `/admin/users?q=${encodeURIComponent(q)}` },
        { label: `Products matching "${q}"`, url: `/admin/products?q=${encodeURIComponent(q)}` },
      ]
    : [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Search pages, orders, sellers…" value={query} onValueChange={setQuery} />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>Nothing found.</CommandEmpty>
        {searches.length > 0 && (
          <>
            <CommandGroup heading="Look up">
              {searches.map((s) => (
                // The value includes the query so cmdk always keeps these visible.
                <CommandItem key={s.url} value={`lookup ${s.label}`} onSelect={() => go(s.url)}>
                  <Search className="mr-2" />
                  {s.label}
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandSeparator />
          </>
        )}
        {ADMIN_NAV.map((group) => (
          <CommandGroup key={group.title} heading={group.title}>
            {group.items.map((item) => (
              <CommandItem key={item.url} value={`${item.title} ${item.hint} ${item.keywords ?? ""}`} onSelect={() => go(item.url)}>
                <item.icon className="mr-2" />
                <div className="min-w-0 flex-1">
                  <p className="truncate">{item.title}</p>
                  <p className="truncate text-xs text-muted-foreground">{item.hint}</p>
                </div>
                <CountBadge count={itemCount(item, overview)} />
              </CommandItem>
            ))}
          </CommandGroup>
        ))}
      </CommandList>
    </CommandDialog>
  );
}

function SearchButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex items-center gap-2 rounded-xl bg-muted/70 px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted", className)}
    >
      <Search className="h-4 w-4" />
      <span className="flex-1 text-left">Search</span>
      <kbd className="hidden rounded border bg-background px-1.5 text-[10px] font-medium md:inline">⌘K</kbd>
    </button>
  );
}

export function AdminLayout({ children, title }: AdminLayoutProps) {
  const { isLoading, isAdmin, user } = useAdminAuth();
  const { data: overview } = useAdminOverview();
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // ⌘K / Ctrl+K opens quick search anywhere in the admin.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // End the admin unlock too, so the key is needed again next time.
  const handleLogout = () => signOutThisDevice({ redirectTo: "/", lockAdmin: true });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
          <BrandLogo tile className="h-8 w-8 rounded-lg" />
          Opening admin…
        </div>
        <Skeleton className="h-12 w-full mb-4 rounded-xl" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  // Not an admin (or the admin key has expired): say so instead of showing an empty page.
  // useAdminAuth also sends people to /admin to sign in or unlock.
  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6 text-center">
        <BrandLogo tile className="h-14 w-14" />
        <h1 className="text-lg font-bold">Admin access needed</h1>
        <p className="max-w-xs text-sm text-muted-foreground">
          {user?.email
            ? `You're signed in as ${user.email}, which isn't unlocked for admin. Unlock it with the admin key, or switch to your admin account.`
            : "Sign in with your admin account to continue."}
        </p>
        <Link to="/admin" replace className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
          Go to admin sign-in
        </Link>
      </div>
    );
  }

  const tabItems = ADMIN_TAB_URLS.map((url) => ADMIN_NAV_ITEMS.find((i) => i.url === url)).filter((i): i is AdminNavItem => !!i);
  const onTab = tabItems.some((i) => isActivePath(location.pathname, i.url));
  const moreCount = ADMIN_NAV_ITEMS.filter((i) => !ADMIN_TAB_URLS.includes(i.url)).reduce((n, i) => n + itemCount(i, overview), 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Phone header: brand, search, notifications */}
      <header className="md:hidden fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="flex h-14 items-center gap-2 px-3">
          <Link to="/admin/dashboard" className="flex shrink-0 items-center gap-2" aria-label="Admin home">
            <BrandLogo tile className="h-8 w-8 rounded-lg" />
          </Link>
          <SearchButton onClick={() => setSearchOpen(true)} className="flex-1" />
          <NotificationBell href="/admin/notifications" />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 z-40 hidden h-full w-64 flex-col border-r bg-card md:flex">
        <div className="flex items-center gap-2.5 px-4 pb-3 pt-4">
          <BrandLogo tile className="h-9 w-9" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold leading-tight text-foreground">Kano Kaftan</p>
            <p className="text-xs text-muted-foreground">Admin</p>
          </div>
          <div className="ml-auto">
            <NotificationBell href="/admin/notifications" />
          </div>
        </div>
        <div className="px-3 pb-2">
          <SearchButton onClick={() => setSearchOpen(true)} className="w-full" />
        </div>
        <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
          {ADMIN_NAV.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">{group.title}</p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = isActivePath(location.pathname, item.url);
                  return (
                    <Link
                      key={item.url}
                      to={item.url}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
                        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.title}</span>
                      <CountBadge count={itemCount(item, overview)} className={active ? "bg-primary-foreground text-primary" : undefined} />
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="space-y-0.5 border-t p-3">
          <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
            <ShoppingBag className="h-4 w-4" />
            Go to store
          </Link>
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="md:ml-64">
        <main className="min-h-screen pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-[calc(env(safe-area-inset-top)+3.5rem)] md:pb-6 md:pt-0">
          <div className="p-4 md:p-6">
            <h1 className="mb-4 text-2xl font-bold tracking-tight text-foreground md:mb-6">{title}</h1>
            {children}
          </div>
        </main>
      </div>

      {/* Phone tab bar */}
      <nav className="md:hidden fixed inset-x-0 bottom-0 z-40 border-t border-border/60 bg-background/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl">
        <div className="grid h-14 grid-cols-5">
          {tabItems.map((item) => {
            const active = isActivePath(location.pathname, item.url);
            const count = itemCount(item, overview);
            return (
              <Link
                key={item.url}
                to={item.url}
                className={cn("relative flex flex-col items-center justify-center gap-0.5 transition-colors", active ? "text-primary" : "text-muted-foreground")}
              >
                <item.icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                <span className="text-[10px] font-medium">{item.title}</span>
                <CountBadge count={count} className="absolute left-1/2 top-1 ml-1.5" />
              </Link>
            );
          })}
          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            className={cn("relative flex flex-col items-center justify-center gap-0.5 transition-colors", !onTab ? "text-primary" : "text-muted-foreground")}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px] font-medium">More</span>
            <CountBadge count={moreCount} className="absolute left-1/2 top-1 ml-1.5" />
          </button>
        </div>
      </nav>

      {/* Phone "More": every page, grouped, as big tap targets */}
      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-3xl pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <BrandLogo tile className="h-7 w-7 rounded-lg" />
              Kano Kaftan Admin
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-5">
            {ADMIN_NAV.map((group) => (
              <div key={group.title}>
                <p className="pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/70">{group.title}</p>
                <div className="grid grid-cols-3 gap-2">
                  {group.items.map((item) => {
                    const active = isActivePath(location.pathname, item.url);
                    return (
                      <Link
                        key={item.url}
                        to={item.url}
                        onClick={() => setMoreOpen(false)}
                        className={cn(
                          "relative flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-xs font-medium transition-colors active:scale-95",
                          active ? "border-primary bg-primary/10 text-primary" : "border-border bg-card text-foreground",
                        )}
                      >
                        <item.icon className="h-5 w-5" />
                        <span className="leading-tight">{item.title}</span>
                        <CountBadge count={itemCount(item, overview)} className="absolute right-1.5 top-1.5" />
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-2 gap-2 border-t pt-4">
              <Link to="/" onClick={() => setMoreOpen(false)} className="flex items-center justify-center gap-2 rounded-xl border bg-card py-3 text-sm font-medium">
                <ShoppingBag className="h-4 w-4" />
                Go to store
              </Link>
              <button type="button" onClick={handleLogout} className="flex items-center justify-center gap-2 rounded-xl border border-destructive/30 py-3 text-sm font-medium text-destructive">
                <LogOut className="h-4 w-4" />
                Log out
              </button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AdminQuickSearch open={searchOpen} onOpenChange={setSearchOpen} overview={overview} />
    </div>
  );
}

export { useAdminAuth };
