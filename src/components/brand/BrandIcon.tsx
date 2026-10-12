import { siFacebook, siInstagram, siTiktok, siWhatsapp, siX } from "simple-icons";
import { cn } from "@/lib/utils";

/** Official brand marks (Simple Icons). Drawn in the current text colour unless `colored`. */
const ICONS = {
  whatsapp: siWhatsapp,
  instagram: siInstagram,
  facebook: siFacebook,
  x: siX,
  tiktok: siTiktok,
} as const;

export type Brand = keyof typeof ICONS;

export function BrandIcon({ brand, className, colored = false }: { brand: Brand; className?: string; colored?: boolean }) {
  const icon = ICONS[brand];
  return (
    <svg
      role="img"
      viewBox="0 0 24 24"
      aria-hidden="true"
      className={cn("h-4 w-4 shrink-0", className)}
      fill={colored ? `#${icon.hex}` : "currentColor"}
    >
      <path d={icon.path} />
    </svg>
  );
}
