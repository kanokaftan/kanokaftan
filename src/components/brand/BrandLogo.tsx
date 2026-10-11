import { cn } from "@/lib/utils";

/**
 * The K² logo (bold K with a white T-shirt). It switches to the white-K version
 * in dark mode by itself. With `tile` it sits on a white rounded square (app-icon
 * style), always in the black version.
 */
export function BrandLogo({ className, tile = false, alt = "Kano Kaftan" }: { className?: string; tile?: boolean; alt?: string }) {
  if (tile) {
    return (
      <span className={cn("inline-flex items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5", className)}>
        {/* Sized against the tile itself (a % padding would follow the parent's width instead). */}
        <img src="/logo.svg" alt={alt} className="object-contain" style={{ width: "86%", height: "86%" }} draggable={false} />
      </span>
    );
  }
  return (
    <span className={cn("relative inline-block", className)}>
      <img src="/logo.svg" alt={alt} className="h-full w-full object-contain dark:hidden" draggable={false} />
      <img src="/logo-dark.svg" alt={alt} className="hidden h-full w-full object-contain dark:block" draggable={false} />
    </span>
  );
}
