import { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { VendorSidebar } from "./VendorSidebar";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { Skeleton } from "@/components/ui/skeleton";

interface VendorLayoutProps {
  children: ReactNode;
  title: string;
}

export function VendorLayout({ children, title }: VendorLayoutProps) {
  const { isLoading, userId } = useVendorAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <VendorSidebar />
        <main className="flex-1 bg-muted/30">
          <header className="h-16 border-b bg-background flex items-center px-6 gap-4">
            <SidebarTrigger />
            <h1 className="text-xl font-semibold">{title}</h1>
          </header>
          <div className="p-6">{children}</div>
        </main>
      </div>
    </SidebarProvider>
  );
}

export { useVendorAuth };
