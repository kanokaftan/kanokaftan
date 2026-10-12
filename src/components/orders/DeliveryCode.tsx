import { useQuery } from "@tanstack/react-query";
import { KeyRound, Phone, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * The customer's pickup code: made when they pay, given to the rider only when
 * the parcel is in their hands. Also shows which company is delivering.
 */
export function DeliveryCode({ orderId }: { orderId: string }) {
  const { data: delivery } = useQuery({
    queryKey: ["order-delivery", orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("order_deliveries")
        .select("delivery_company, company_phone, pickup_code, tracking_reference, dispatched_at")
        .eq("order_id", orderId)
        .maybeSingle();
      if (error) {
        console.error("[DeliveryCode] could not load delivery", { orderId, error });
        throw error;
      }
      return data;
    },
  });

  if (!delivery) return null;

  const heading = delivery.dispatched_at
    ? `On its way with ${delivery.delivery_company}`
    : delivery.delivery_company
      ? `${delivery.delivery_company} will deliver your order`
      : "We're arranging your delivery";

  return (
    <div className="mt-4 rounded-lg border border-primary/30 bg-primary/5 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Truck className="h-4 w-4 shrink-0 text-primary" />
          <span>
            {heading}
            {delivery.tracking_reference && (
              <span className="font-normal text-muted-foreground"> · Ref {delivery.tracking_reference}</span>
            )}
          </span>
        </div>
        {delivery.company_phone && (
          <a href={`tel:${delivery.company_phone}`} className="flex shrink-0 items-center gap-1 text-xs font-medium text-primary" aria-label={`Call ${delivery.delivery_company}`}>
            <Phone className="h-3.5 w-3.5" />Call
          </a>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-md bg-background p-3">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <KeyRound className="h-4 w-4" />
          Delivery code
        </div>
        <span className="font-mono text-2xl font-bold tracking-widest">{delivery.pickup_code}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Give this code to the rider only when your parcel is in your hands. Don't share it with anyone else, including
        the seller.
      </p>
    </div>
  );
}
