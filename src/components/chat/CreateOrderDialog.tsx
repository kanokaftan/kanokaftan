import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Minus, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { AddressAutocomplete } from "@/components/address/AddressAutocomplete";

interface PickedItem {
  product_id: string;
  name: string;
  store_name: string | null;
  price: number;
  quantity: number;
}

function formatPrice(amount: number) {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);
}

/**
 * Admin builds an order for the customer in a support chat. Prices come from
 * the catalogue on the server; the delivery fee is what the delivery company quoted.
 */
export function CreateOrderDialog({
  open,
  onOpenChange,
  customerId,
  conversationId,
  suggestedProductId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  conversationId: string;
  suggestedProductId?: string | null;
}) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<PickedItem[]>([]);
  const [deliveryFee, setDeliveryFee] = useState("");
  const [address, setAddress] = useState({ full_name: "", phone: "", street_address: "", city: "", state: "", landmark: "" });
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const { data: results, isFetching } = useQuery({
    queryKey: ["admin-product-search", search, suggestedProductId],
    queryFn: async () => {
      let query = supabase
        .from("products")
        .select("id, name, price, stock_quantity, vendor:profiles!products_vendor_id_fkey(store_name)")
        .eq("is_active", true)
        .limit(8);
      query = search.trim()
        ? query.ilike("name", `%${search.trim()}%`)
        : suggestedProductId
          ? query.eq("id", suggestedProductId)
          : query.order("created_at", { ascending: false });
      const { data, error } = await query;
      if (error) throw error;
      return data ?? [];
    },
    enabled: open,
  });

  const subtotal = useMemo(() => items.reduce((sum, i) => sum + i.price * i.quantity, 0), [items]);
  const fee = Number(deliveryFee) || 0;

  const addItem = (product: NonNullable<typeof results>[number]) => {
    setItems((current) => {
      const existing = current.find((i) => i.product_id === product.id);
      if (existing) {
        return current.map((i) => (i.product_id === product.id ? { ...i, quantity: i.quantity + 1 } : i));
      }
      const vendor = product.vendor as { store_name: string | null } | null;
      return [...current, { product_id: product.id, name: product.name, store_name: vendor?.store_name ?? null, price: Number(product.price), quantity: 1 }];
    });
  };

  const changeQty = (productId: string, delta: number) =>
    setItems((current) =>
      current
        .map((i) => (i.product_id === productId ? { ...i, quantity: i.quantity + delta } : i))
        .filter((i) => i.quantity > 0),
    );

  const addressValid = address.full_name && address.phone && address.street_address && address.city && address.state;
  const canSubmit = items.length > 0 && deliveryFee !== "" && fee >= 0 && addressValid && !saving;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      const { error } = await supabase.rpc("admin_create_order", {
        p_customer_id: customerId,
        p_items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        p_delivery_fee: fee,
        p_shipping_address: address,
        p_notes: notes || null,
        p_conversation_id: conversationId,
      });
      if (error) throw new Error(error.message);
      toast.success("Order created and payment link sent in the chat");
      queryClient.invalidateQueries({ queryKey: ["messages", conversationId] });
      setItems([]);
      setDeliveryFee("");
      setNotes("");
      onOpenChange(false);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not create order");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create order for this customer</DialogTitle>
          <DialogDescription>
            The customer gets a payment link in this chat. The vendor is paid half when the customer pays and the rest
            after delivery.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Products</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products" className="pl-9" />
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-1">
              {isFetching ? (
                <Loader2 className="m-2 h-4 w-4 animate-spin" />
              ) : !results?.length ? (
                <p className="p-2 text-sm text-muted-foreground">No products found.</p>
              ) : (
                results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addItem(p)}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    <span className="truncate">
                      {p.name}
                      <span className="text-xs text-muted-foreground"> · {(p.vendor as { store_name: string | null } | null)?.store_name ?? "Vendor"} · {p.stock_quantity} in stock</span>
                    </span>
                    <span className="ml-2 flex-shrink-0 font-medium">{formatPrice(Number(p.price))}</span>
                  </button>
                ))
              )}
            </div>
          </div>

          {items.length > 0 && (
            <div className="space-y-2 rounded-md bg-muted/50 p-2">
              {items.map((item) => (
                <div key={item.product_id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="min-w-0 flex-1 truncate">{item.name}</span>
                  <div className="flex items-center gap-1">
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => changeQty(item.product_id, -1)} aria-label="Decrease">
                      {item.quantity === 1 ? <Trash2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
                    </Button>
                    <span className="w-6 text-center">{item.quantity}</span>
                    <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => changeQty(item.product_id, 1)} aria-label="Increase">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="w-24 text-right">{formatPrice(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="delivery-fee">Delivery fee (from the delivery company)</Label>
            <Input id="delivery-fee" type="number" min={0} value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} placeholder="e.g. 2500" />
          </div>

          <div className="space-y-2">
            <Label>Deliver to</Label>
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Full name" value={address.full_name} onChange={(e) => setAddress({ ...address, full_name: e.target.value })} />
              <Input placeholder="Phone" value={address.phone} onChange={(e) => setAddress({ ...address, phone: e.target.value })} />
              <div className="col-span-2">
                <AddressAutocomplete
                  placeholder="Street address (start typing)"
                  value={address.street_address}
                  onChange={(v) => setAddress((a) => ({ ...a, street_address: v }))}
                  onSelectSuggestion={(s) => setAddress((a) => ({ ...a, city: s.city || a.city, state: s.state || a.state }))}
                  stateHint={address.state || undefined}
                />
              </div>
              <Input placeholder="City" value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
              <Input placeholder="State" value={address.state} onChange={(e) => setAddress({ ...address, state: e.target.value })} />
              <Input className="col-span-2" placeholder="Landmark (optional)" value={address.landmark} onChange={(e) => setAddress({ ...address, landmark: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="order-notes">Notes (size, colour, etc.)</Label>
            <Textarea id="order-notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>

          <div className="flex justify-between border-t pt-3 text-sm font-medium">
            <span>Total the customer pays</span>
            <span>{formatPrice(subtotal + fee)}</span>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create & send payment link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
