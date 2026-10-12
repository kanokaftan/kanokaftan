import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, MessageCircle, RefreshCw, Send, Truck, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useLogisticsCompanies, whatsappNumber } from "@/hooks/useLogistics";
import { toast } from "sonner";
import { BrandIcon } from "@/components/brand/BrandIcon";

interface DeliveryActionsProps {
  orderId: string;
  paymentStatus: string;
  escrowStatus: string | null;
}

const PICKUP_CODE_DIGITS = 6;

/** Six random digits (used only if the admin wants a fresh code). */
function newPickupCode(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 10 ** PICKUP_CODE_DIGITS;
  return String(n).padStart(PICKUP_CODE_DIGITS, "0");
}

interface ShippingAddress {
  full_name?: string;
  phone?: string;
  street_address?: string;
  city?: string;
  state?: string;
  landmark?: string;
}

interface StoreAddress {
  street_address?: string;
  address?: string;
  city?: string;
  state?: string;
}

/** Everything the delivery company needs, except the customer's pickup code. */
function useDeliveryJob(orderId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["delivery-job", orderId],
    enabled,
    queryFn: async () => {
      const [{ data: delivery, error: deliveryError }, { data: order, error: orderError }, { data: items, error: itemsError }] = await Promise.all([
        supabase.from("order_deliveries").select("*").eq("order_id", orderId).maybeSingle(),
        supabase.from("orders").select("id, shipping_address, total").eq("id", orderId).maybeSingle(),
        supabase.from("order_items").select("product_name, quantity, vendor_id").eq("order_id", orderId),
      ]);
      if (deliveryError || orderError || itemsError) throw deliveryError || orderError || itemsError;
      const vendorIds = [...new Set((items ?? []).map((i) => i.vendor_id))];
      const { data: vendors, error: vendorsError } = vendorIds.length
        ? await supabase.from("profiles").select("id, store_name, store_address, phone").in("id", vendorIds)
        : { data: [], error: null };
      if (vendorsError) throw vendorsError;
      return { delivery, order, items: items ?? [], vendors: vendors ?? [] };
    },
  });
}

function jobMessage(job: NonNullable<ReturnType<typeof useDeliveryJob>["data"]>): string {
  const to = (job.order?.shipping_address ?? {}) as ShippingAddress;
  const pickups = job.vendors.map((v) => {
    const a = (v.store_address ?? {}) as StoreAddress;
    const place = [a.street_address || a.address, a.city, a.state].filter(Boolean).join(", ");
    return `• ${v.store_name ?? "Seller"}${place ? `, ${place}` : ""}${v.phone ? ` (${v.phone})` : ""}`;
  });
  const items = job.items.map((i) => `• ${i.quantity} × ${i.product_name}`);
  return [
    `New Kano Kaftan delivery, order #${job.order?.id.slice(0, 8).toUpperCase()}`,
    "",
    "Pick up from:",
    ...(pickups.length ? pickups : ["• (we'll send the pickup point)"]),
    "",
    "Items:",
    ...items,
    "",
    "Deliver to:",
    `${to.full_name ?? ""}, ${to.phone ?? ""}`,
    [to.street_address, to.landmark && `near ${to.landmark}`, to.city, to.state].filter(Boolean).join(", "),
    "",
    "The customer will give the rider a 6-digit code on delivery. Please send us the code to confirm.",
  ].join("\n");
}

/** Choose/confirm the delivery company, send them the job, then confirm delivery to release the vendor's second half. */
export function DeliveryActions({ orderId, paymentStatus, escrowStatus }: DeliveryActionsProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [companyId, setCompanyId] = useState("");
  const [code, setCode] = useState("");
  const [tracking, setTracking] = useState("");
  const [busy, setBusy] = useState<"save" | "deliver" | null>(null);
  const { data: companies } = useLogisticsCompanies();
  const { data: job, isLoading, refetch } = useDeliveryJob(orderId, open);

  const delivery = job?.delivery ?? null;
  useEffect(() => {
    if (!open || !job) return;
    setCompanyId(job.delivery?.company_id ?? "");
    setCode(job.delivery?.pickup_code ?? "");
    setTracking(job.delivery?.tracking_reference ?? "");
  }, [open, job]);

  const activeCompanies = useMemo(() => (companies ?? []).filter((c) => c.is_active || c.id === companyId), [companies, companyId]);
  const company = activeCompanies.find((c) => c.id === companyId) ?? null;
  const wa = whatsappNumber(company?.whatsapp || company?.phone);

  if (paymentStatus !== "paid" || escrowStatus !== "held") return null;

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    queryClient.invalidateQueries({ queryKey: ["admin-payout-ledger"] });
    queryClient.invalidateQueries({ queryKey: ["logistics-overview"] });
    refetch();
  };

  const handleDispatch = async () => {
    if (!companyId) return;
    setBusy("save");
    const { error } = await supabase.rpc("admin_dispatch_delivery", {
      p_order_id: orderId,
      p_company_id: companyId,
      p_pickup_code: code.trim() || null,
      p_tracking_reference: tracking.trim() || null,
    });
    setBusy(null);
    if (error) {
      console.error("[DeliveryActions] dispatch failed", { orderId, error });
      toast.error(error.message);
      return;
    }
    toast.success(delivery?.dispatched_at ? "Updated. The customer has been told." : "Marked as sent. The customer has been told.");
    refresh();
  };

  const handleDelivered = async () => {
    setBusy("deliver");
    const { error } = await supabase.rpc("admin_mark_delivered", { p_order_id: orderId });
    if (error) {
      setBusy(null);
      console.error("[DeliveryActions] mark delivered failed", { orderId, error });
      toast.error(error.message);
      return;
    }
    // Send the vendor's second half straight away (the hourly run would also pick it up).
    await supabase.functions.invoke("process-payouts", { body: {} }).catch((e) => console.error("[DeliveryActions] payout run failed", e));
    setBusy(null);
    toast.success("Marked delivered. The vendor's remaining payment is on its way.");
    setOpen(false);
    refresh();
  };

  const status = !delivery
    ? "Not set up yet"
    : delivery.dispatched_at
      ? `Sent with ${delivery.delivery_company}`
      : delivery.company_id
        ? `${delivery.delivery_company} chosen automatically, not sent yet`
        : "No company covers this address, choose one";

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <Truck className="mr-1 h-3.5 w-3.5" />
        Delivery
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delivery for order #{orderId.slice(0, 8)}</DialogTitle>
            <DialogDescription>{isLoading ? "Loading…" : status}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Delivery company</Label>
              {activeCompanies.length ? (
                <Select value={companyId} onValueChange={setCompanyId}>
                  <SelectTrigger aria-label="Delivery company"><SelectValue placeholder="Choose a company" /></SelectTrigger>
                  <SelectContent>
                    {activeCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}{c.areas.length ? ` · ${c.areas.slice(0, 3).join(", ")}${c.areas.length > 3 ? "…" : ""}` : c.is_default ? " · default" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="rounded-md bg-muted p-3 text-sm">
                  No delivery companies yet. <Link to="/admin/logistics" className="font-medium underline">Add them in Logistics</Link>.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`code-${orderId}`}>Customer's pickup code</Label>
              <div className="flex gap-2">
                <Input id={`code-${orderId}`} value={code} onChange={(e) => setCode(e.target.value)} className="font-mono text-lg tracking-widest" placeholder="Made automatically" />
                <Button type="button" variant="outline" size="icon" onClick={() => setCode(newPickupCode())} aria-label="Make a new code" title="Make a new code">
                  <Wand2 className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Made when the customer paid and already sent to them. Only the customer and you see it, never the seller or the rider.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor={`tracking-${orderId}`}>Tracking reference (optional)</Label>
              <Input id={`tracking-${orderId}`} value={tracking} onChange={(e) => setTracking(e.target.value)} />
            </div>
            {company && job && wa && (
              <Button asChild variant="secondary" className="w-full">
                <a href={`https://wa.me/${wa}?text=${encodeURIComponent(jobMessage(job))}`} target="_blank" rel="noreferrer">
                  <BrandIcon brand="whatsapp" className="mr-2" />Send job to {company.name} on WhatsApp
                </a>
              </Button>
            )}
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={handleDispatch} disabled={!companyId || busy !== null}>
              {busy === "save" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : delivery?.dispatched_at ? <RefreshCw className="mr-2 h-4 w-4" /> : <Send className="mr-2 h-4 w-4" />}
              {delivery?.dispatched_at ? "Update & notify customer" : "Mark as sent with this company"}
            </Button>
            <Button onClick={handleDelivered} disabled={!delivery?.dispatched_at || busy !== null}>
              {busy === "deliver" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
              Mark delivered (code confirmed)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
