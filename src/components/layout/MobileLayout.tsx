import { ReactNode } from "react";
import { MobileHeader } from "./MobileHeader";
import { BottomNav } from "./BottomNav";
import { cn } from "@/lib/utils";

interface MobileLayoutProps {
  children: ReactNode;
  hideHeader?: boolean;
  hideBottomNav?: boolean;
}

export function MobileLayout({ children, hideHeader = false, hideBottomNav = false }: MobileLayoutProps) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {!hideHeader && <MobileHeader />}
      <main className={cn("flex-1", !hideBottomNav && "pb-20")}>
        {children}
      </main>
      {!hideBottomNav && <BottomNav />}
    </div>
  );
}
