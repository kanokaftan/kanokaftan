import { cn } from "@/lib/utils";

/**
 * The K² logo (bold K with a white T-shirt). With `tile`, it sits on a small
 * white rounded square so it stays visible on dark backgrounds and in dark mode.
 */
export function BrandLogo({ className, tile = false, alt = "Kano Kaftan" }: { className?: string; tile?: boolean; alt?: string }) {
  // Sized against the tile itself (a % padding would follow the parent's width instead).
  const img = (
    <img src="/logo.svg" alt={alt} className={cn("object-contain", !tile && className)} style={tile ? { width: "86%", height: "86%" } : undefined} draggable={false} />
  );
  if (!tile) return img;
  return <span className={cn("inline-flex items-center justify-center overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5", className)}>{img}</span>;
}
