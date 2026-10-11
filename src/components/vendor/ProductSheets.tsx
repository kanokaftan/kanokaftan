import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  CheckCircle, ExternalLink, Eye, EyeOff, ImagePlus, Loader2, Megaphone, Minus, Package, PackageX, Pencil, Plus, Trash2,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface SheetProduct {
  id: string;
  name: string;
  slug: string;
  stock_quantity: number;
  is_active: boolean;
  image?: string | null;
  price?: number;
  compare_at_price?: number | null;
}

/** Biggest stock a seller can type (stops accidental extra zeros). */
const MAX_STOCK = 99_999;
const QUICK_ADDS = [1, 5, 10];

/** Stock editor that slides up from the bottom: big −/+ buttons and quick adds. */
export function StockSheet({
  product, onClose, onSave, saving,
}: {
  product: SheetProduct | null;
  onClose: () => void;
  onSave: (quantity: number) => void;
  saving?: boolean;
}) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (product) setValue(product.stock_quantity === 0 ? 10 : product.stock_quantity);
  }, [product]);

  const clamp = (n: number) => Math.min(MAX_STOCK, Math.max(0, Math.round(n || 0)));

  return (
    <Sheet open={!!product} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>Stock</SheetTitle>
          <SheetDescription className="truncate">{product?.name}</SheetDescription>
        </SheetHeader>
        <div className="mt-5 flex items-center justify-center gap-4">
          <Button type="button" variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={() => setValue((v) => clamp(v - 1))} aria-label="One less">
            <Minus className="h-6 w-6" />
          </Button>
          <input
            type="number"
            inputMode="numeric"
            min={0}
            max={MAX_STOCK}
            value={value}
            onChange={(e) => setValue(clamp(Number(e.target.value)))}
            className="w-28 rounded-2xl border bg-background py-2 text-center text-4xl font-semibold tabular-nums outline-none focus:ring-2 focus:ring-ring"
            aria-label="Pieces in stock"
          />
          <Button type="button" variant="outline" size="icon" className="h-14 w-14 rounded-full" onClick={() => setValue((v) => clamp(v + 1))} aria-label="One more">
            <Plus className="h-6 w-6" />
          </Button>
        </div>
        <div className="mt-4 flex justify-center gap-2">
          {QUICK_ADDS.map((n) => (
            <Button key={n} type="button" variant="secondary" size="sm" className="rounded-full" onClick={() => setValue((v) => clamp(v + n))}>
              +{n}
            </Button>
          ))}
          <Button type="button" variant="secondary" size="sm" className="rounded-full text-red-600" onClick={() => setValue(0)}>
            Sold out
          </Button>
        </div>
        <Button className="mt-6 h-12 w-full rounded-full text-base" onClick={() => onSave(value)} disabled={saving || value === product?.stock_quantity}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {value === 0 ? "Mark as sold out" : `Save · ${value} in stock`}
        </Button>
      </SheetContent>
    </Sheet>
  );
}

interface Action {
  icon: LucideIcon;
  label: string;
  to?: string;
  onClick?: () => void;
  danger?: boolean;
}

/** iOS-style action sheet for one product. */
export function ProductActionSheet({
  product, onClose, onEditStock, onToggleVisible, onMarkSoldOut, onDelete, onCreatePost,
}: {
  product: SheetProduct | null;
  onClose: () => void;
  onEditStock: () => void;
  onToggleVisible: () => void;
  onMarkSoldOut: () => void;
  onDelete: () => void;
  /** Branded Instagram / WhatsApp Status image. */
  onCreatePost?: () => void;
}) {
  if (!product) return <Sheet open={false} />;
  const soldOut = product.stock_quantity === 0;
  const actions: Action[] = [
    { icon: Pencil, label: "Edit product", to: `/vendor/products/${product.id}` },
    { icon: soldOut ? CheckCircle : Package, label: soldOut ? "Restock" : "Change stock", onClick: onEditStock },
    ...(!soldOut ? [{ icon: PackageX, label: "Mark sold out", onClick: onMarkSoldOut }] : []),
    ...(onCreatePost ? [{ icon: ImagePlus, label: "Create Instagram / Status post", onClick: onCreatePost }] : []),
    { icon: Megaphone, label: "Promote on homepage", to: `/vendor/promote?product=${product.id}` },
    { icon: ExternalLink, label: "View in shop", to: `/products/${product.slug}` },
    { icon: product.is_active ? EyeOff : Eye, label: product.is_active ? "Hide from customers" : "Show to customers", onClick: onToggleVisible },
    { icon: Trash2, label: "Delete product", onClick: onDelete, danger: true },
  ];

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="rounded-t-3xl px-3 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="flex-row items-center gap-3 space-y-0 px-2 pb-2 text-left">
          <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
            {product.image ? <img src={product.image} alt="" className="h-full w-full object-cover" /> : <Package className="m-3 h-6 w-6 text-muted-foreground" />}
          </div>
          <div className="min-w-0">
            <SheetTitle className="truncate text-base">{product.name}</SheetTitle>
            <SheetDescription>{soldOut ? "Sold out" : `${product.stock_quantity} in stock`}{product.is_active ? "" : " · hidden"}</SheetDescription>
          </div>
        </SheetHeader>
        <ul className="overflow-hidden rounded-2xl bg-muted/50">
          {actions.map((action) => {
            const className = cn(
              "flex w-full items-center gap-3 px-4 py-3.5 text-left text-[15px] active:bg-muted",
              action.danger && "text-red-600",
            );
            const content = <><action.icon className="h-5 w-5" aria-hidden="true" />{action.label}</>;
            return (
              <li key={action.label} className="border-b border-border/60 last:border-b-0">
                {action.to ? (
                  <Link to={action.to} className={className} onClick={onClose}>{content}</Link>
                ) : (
                  <button type="button" className={className} onClick={() => { onClose(); action.onClick?.(); }}>{content}</button>
                )}
              </li>
            );
          })}
        </ul>
        <Button variant="secondary" className="mt-2 h-12 w-full rounded-2xl text-[15px] font-semibold" onClick={onClose}>
          Cancel
        </Button>
      </SheetContent>
    </Sheet>
  );
}
