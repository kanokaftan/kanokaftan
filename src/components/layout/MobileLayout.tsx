import { ReactNode, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { MobileHeader } from "./MobileHeader";
import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

interface MobileLayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
  hideBottomNav?: boolean;
  /** Show the search icon in the top bar (home page only; other pages have their own search or don't need one). */
  headerSearch?: boolean;
}

/** Tab order, used to slide pages in from the side you are moving towards. */
const TAB_ORDER = ["/", "/orders", "/messages", "/wishlist", "/profile"];

function tabIndex(pathname: string): number {
  return TAB_ORDER.findIndex((href) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`)));
}

/** Remembered across page changes (each page mounts its own layout). */
let lastPath: string | null = null;

function enterAnimation(pathname: string): string {
  const from = lastPath === null ? -1 : tabIndex(lastPath);
  const to = tabIndex(pathname);
  if (lastPath === pathname || lastPath === null) return "";
  // Switching tabs: slide sideways like the bubble. Anything else: soft rise.
  if (from !== -1 && to !== -1 && from !== to) {
    return to > from ? "animate-in fade-in-0 slide-in-from-right-8 duration-300" : "animate-in fade-in-0 slide-in-from-left-8 duration-300";
  }
  return "animate-in fade-in-0 slide-in-from-bottom-2 duration-300";
}

export function MobileLayout({ children, hideHeader = false, hideBottomNav = false, headerSearch = false }: MobileLayoutProps) {
  const { pathname } = useLocation();
  // Worked out once per page, so a re-render mid-slide doesn't cut it short.
  const animation = useMemo(() => enterAnimation(pathname), [pathname]);
  useEffect(() => {
    lastPath = pathname;
  }, [pathname]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip bg-background">
      {!hideHeader && <MobileHeader showSearch={headerSearch} />}
      <main key={pathname} className={cn("flex-1 motion-reduce:animate-none", !hideBottomNav && "pb-28", animation)}>
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
