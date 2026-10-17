import { useState } from "react";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { Boxes, CheckCircle2, Circle, MapPin, Phone, RefreshCw, Truck } from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { DeliveryActions } from "@/components/admin/DeliveryActions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCombinedShipments, type CombinedShipment } from "@/hooks/useAdminOverview";
import { cn } from "@/lib/utils";

type ShipmentFilter = "ready" | "packing" | "all";

const FILTERS: { key: ShipmentFilter; label: string }[] = [
  { key: "ready", label: "Ready to collect" },
  { key: "packing", label: "Still packing" },
  { key: "all", label: "All" },
];

const formatNaira = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);

function placeLine(parts: Array<string | undefined | null>): string {
  return parts.filter((p) => p && p.trim()).join(", ");
}

function ShipmentCard({ shipment }: { shipment: CombinedShipment }) {
  const readyCount = shipment.sellers.filter((s) => s.ready).length;
  const allReady = readyCount === shipment.sellers.length;
  const to = shipment.shipping_address ?? {};

  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">
            Order <span className="font-mono">#{shipment.order_id.slice(0, 8).toUpperCase()}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            {format(new Date(shipment.created_at), "d MMM, h:mm a")} · {formatNaira(Number(shipment.total))}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold",
            shipment.dispatched
              ? "bg-primary/10 text-primary"
              : allReady
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
          )}
        >
          {shipment.dispatched ? "Rider sent" : allReady ? "Ready to collect" : `${readyCount}/${shipment.sellers.length} ready`}
        </span>
      </div>

      {/* Pickups, in collection order */}
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Collect from {shipment.sellers.length} sellers</p>
        <ol className="space-y-2">
          {shipment.sellers.map((s, i) => (
            <li key={s.vendor_id} className="flex gap-3 rounded-xl bg-muted/50 p-3 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <Link to={`/admin/vendors/${s.vendor_id}`} className="truncate font-medium hover:underline">{s.store_name}</Link>
                  <span className={cn("flex shrink-0 items-center gap-1 text-xs", s.ready ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>
                    {s.ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
                    {s.ready ? "Packed" : "Packing"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {s.items} item{s.items === 1 ? "" : "s"}
                  {placeLine([s.address.street, s.address.city, s.address.state]) && ` · ${placeLine([s.address.street, s.address.city, s.address.state])}`}
                </p>
                {s.phone && (
                  <a href={`tel:${s.phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
                    <Phone className="h-3 w-3" />
                    {s.phone}
                  </a>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* Drop-off */}
      <div className="flex gap-2 rounded-xl border border-dashed p-3 text-sm">
        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <div className="min-w-0">
          <p className="font-medium">Deliver to {to.full_name || shipment.customer_name}</p>
          <p className="text-xs text-muted-foreground">
            {placeLine([to.street_address, to.landmark && `near ${to.landmark}`, to.city, to.state]) || "Address in order"}
          </p>
          {(to.phone || shipment.customer_phone) && (
            <a href={`tel:${to.phone || shipment.customer_phone}`} className="mt-1 inline-flex items-center gap-1 text-xs text-primary">
              <Phone className="h-3 w-3" />
              {to.phone || shipment.customer_phone}
            </a>
          )}
        </div>
      </div>

      {shipment.delivery_company && (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Truck className="h-3.5 w-3.5" />
          {shipment.delivery_company}
        </p>
      )}

      {/* One shipment for the whole order: same company, one pickup code. */}
      <DeliveryActions orderId={shipment.order_id} paymentStatus="paid" escrowStatus="held" />
    </div>
  );
}

export default function AdminShipments() {
  const { data: shipments = [], isLoading, error, refetch, isFetching } = useCombinedShipments();
  const [filter, setFilter] = useState<ShipmentFilter>("ready");

  const isReady = (s: CombinedShipment) => s.sellers.every((x) => x.ready);
  const counts: Record<ShipmentFilter, number> = {
    ready: shipments.filter(isReady).length,
    packing: shipments.filter((s) => !isReady(s)).length,
    all: shipments.length,
  };
  const visible = shipments.filter((s) => filter === "all" || (filter === "ready" ? isReady(s) : !isReady(s)));

  return (
    <AdminLayout title="Shipments">
      <div className="space-y-4">
        <div className="flex items-start gap-3 rounded-2xl bg-primary/5 p-4 text-sm">
          <Boxes className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            Orders with items from several sellers go out as <span className="font-medium text-foreground">one shipment</span>. Each seller
            marks their part packed; when all are ready, send one rider to collect from each and deliver everything together.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                filter === f.key ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
              )}
            >
              {f.label} <span className="opacity-70">{counts[f.key]}</span>
            </button>
          ))}
          </div>
          <Button variant="ghost" size="icon" className="shrink-0" onClick={() => refetch()} disabled={isFetching} aria-label="Refresh">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}
          </div>
        ) : error ? (
          <div className="rounded-2xl border p-6 text-center text-sm">
            <p className="text-destructive">{error instanceof Error ? error.message : "Couldn't load shipments."}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : visible.length === 0 ? (
          <div className="rounded-2xl border bg-card py-12 text-center">
            <Boxes className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">
              {filter === "ready" ? "No combined orders are ready to collect." : filter === "packing" ? "No sellers are still packing." : "No combined orders waiting."}
            </p>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {visible.map((s) => <ShipmentCard key={s.order_id} shipment={s} />)}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
