import { useState, useEffect, useMemo } from "react";
import { useNavigate, Link } from "react-router-dom";
import { MapPin, Plus, ChevronRight, CreditCard, ShieldCheck, Truck, Percent, Tag, X, Check } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCart } from "@/hooks/useCart";
import { useAddresses } from "@/hooks/useAddresses";
import { useOrders } from "@/hooks/useOrders";
import { usePayment } from "@/hooks/usePayment";
import { AddressForm } from "@/components/checkout/AddressForm";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  calculateShippingFee, 
  calculateDistance, 
  getDiscountTierDescription,
  validatePromoCode,
  type PromoCodeResult
} from "@/lib/shipping";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

interface VendorLocation {
  id: string;
  latitude: number | null;
  longitude: number | null;
}

export default function Checkout() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { items, isLoading: cartLoading, total } = useCart();
  const { addresses, isLoading: addressesLoading, defaultAddress } = useAddresses();
  const { createOrder } = useOrders();
  const { initiatePayment, isProcessing } = usePayment();

  const [selectedAddressId, setSelectedAddressId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [isAddressSheetOpen, setIsAddressSheetOpen] = useState(false);
  const [isAllAddressesOpen, setIsAllAddressesOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vendorLocations, setVendorLocations] = useState<VendorLocation[]>([]);
  
  // Promo code state
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState<PromoCodeResult | null>(null);
  const [isValidatingPromo, setIsValidatingPromo] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth?redirect=/checkout");
    }
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (defaultAddress && !selectedAddressId) {
      setSelectedAddressId(defaultAddress.id);
    }
  }, [defaultAddress, selectedAddressId]);

  // Fetch vendor locations for cart items
  useEffect(() => {
    const fetchVendorLocations = async () => {
      if (!items.length) return;
      
      const productIds = items.map(item => item.product_id);
      const { data: products } = await supabase
        .from("products")
        .select("vendor_id")
        .in("id", productIds);
      
      if (!products?.length) return;

      const vendorIds = [...new Set(products.map(p => p.vendor_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, store_address")
        .in("id", vendorIds);
      
      if (profiles) {
        const locations = profiles.map(p => {
          const storeAddress = p.store_address as { latitude?: number; longitude?: number } | null;
          return {
            id: p.id,
            latitude: storeAddress?.latitude || null,
            longitude: storeAddress?.longitude || null
          };
        });
        setVendorLocations(locations);
      }
    };

    fetchVendorLocations();
  }, [items]);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  // Calculate shipping based on distance to vendor
  const shippingInfo = useMemo(() => {
    if (!selectedAddress) {
      return calculateShippingFee(null, total, appliedPromo);
    }

    let distanceKm: number | null = null;

    const vendorsWithCoords = vendorLocations.filter(v => v.latitude && v.longitude);

    if (selectedAddress.latitude && selectedAddress.longitude && vendorsWithCoords.length > 0) {
      const distances = vendorsWithCoords.map(vendor => 
        calculateDistance(
          selectedAddress.latitude!,
          selectedAddress.longitude!,
          vendor.latitude!,
          vendor.longitude!
        )
      );
      distanceKm = Math.max(...distances);
    }

    return calculateShippingFee(distanceKm, total, appliedPromo);
  }, [selectedAddress, total, vendorLocations, appliedPromo]);

  const grandTotal = total + shippingInfo.finalFee;
  const discountDescription = getDiscountTierDescription(total);

  const handleApplyPromoCode = async () => {
    if (!promoCode.trim()) {
      toast.error("Please enter a promo code");
      return;
    }

    setIsValidatingPromo(true);
    const result = await validatePromoCode(promoCode.trim().toUpperCase());
    setIsValidatingPromo(false);

    if (result) {
      setAppliedPromo(result);
      toast.success(`Promo code "${result.code}" applied!`);
      setPromoCode("");
    } else {
      toast.error("Invalid or expired promo code");
    }
  };

  const handleRemovePromo = () => {
    setAppliedPromo(null);
    toast.info("Promo code removed");
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      toast.error("Please select a delivery address");
      return;
    }

    if (!user?.email) {
      toast.error("User email not found");
      return;
    }

    setIsSubmitting(true);
    try {
      const order = await createOrder.mutateAsync({
        shipping_address: {
          full_name: selectedAddress.full_name,
          phone: selectedAddress.phone,
          street_address: selectedAddress.street_address,
          city: selectedAddress.city,
          state: selectedAddress.state,
          landmark: selectedAddress.landmark || undefined,
        },
        notes: notes || undefined,
        shipping_fee: shippingInfo.finalFee,
      });

      const paymentResult = await initiatePayment(order.id, user.email);

      if (paymentResult.success && paymentResult.authorization_url) {
        toast.success("Redirecting to payment...");
        window.location.href = paymentResult.authorization_url;
      } else {
        toast.error(paymentResult.error || "Failed to initialize payment. Please try again.");
        navigate(`/orders/${order.id}`);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to place order";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (cartLoading || addressesLoading) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          <Skeleton className="mb-6 h-8 w-36" />
          <div className="space-y-4">
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (items.length === 0) {
    return (
      <MobileLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-6">
          <h1 className="text-lg font-bold">Your cart is empty</h1>
          <p className="mt-2 text-sm text-muted-foreground">Add items to proceed to checkout</p>
          <Button asChild className="mt-6">
            <Link to="/products">Browse Products</Link>
          </Button>
        </div>
      </MobileLayout>
    );
  }

  return (
    <MobileLayout>
      <div className="px-4 py-6 pb-24">
        <h1 className="mb-6 font-display text-xl font-bold">Checkout</h1>

        {/* Delivery Address Section */}
        <div className="rounded-xl bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <h2 className="font-medium">Delivery Address</h2>
          </div>

          {addresses.length === 0 ? (
            <Sheet open={isAddressSheetOpen} onOpenChange={setIsAddressSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Add New Address
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>Add New Address</SheetTitle>
                </SheetHeader>
                <AddressForm onSuccess={() => setIsAddressSheetOpen(false)} />
              </SheetContent>
            </Sheet>
          ) : (
            <>
              <RadioGroup value={selectedAddressId} onValueChange={setSelectedAddressId}>
                {addresses.slice(0, 2).map((address) => (
                  <div
                    key={address.id}
                    className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                      selectedAddressId === address.id
                        ? "border-primary bg-primary/5"
                        : "border-border"
                    }`}
                  >
                    <RadioGroupItem value={address.id} id={address.id} className="mt-1" />
                    <Label htmlFor={address.id} className="flex-1 cursor-pointer">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{address.label}</span>
                        {address.is_default && (
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {address.full_name} • {address.phone}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {address.street_address}, {address.city}, {address.state}
                      </p>
                    </Label>
                  </div>
                ))}
              </RadioGroup>

              <div className="mt-3 flex gap-2">
                <Sheet open={isAddressSheetOpen} onOpenChange={setIsAddressSheetOpen}>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Plus className="mr-1 h-3 w-3" />
                      Add New
                    </Button>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[85vh] overflow-y-auto">
                    <SheetHeader>
                      <SheetTitle>Add New Address</SheetTitle>
                    </SheetHeader>
                    <AddressForm onSuccess={() => setIsAddressSheetOpen(false)} />
                  </SheetContent>
                </Sheet>
                {addresses.length > 2 && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => setIsAllAddressesOpen(true)}
                  >
                    View All ({addresses.length})
                    <ChevronRight className="ml-1 h-3 w-3" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>

        {/* All Addresses Dialog */}
        <Dialog open={isAllAddressesOpen} onOpenChange={setIsAllAddressesOpen}>
          <DialogContent className="max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Select Address</DialogTitle>
            </DialogHeader>
            <RadioGroup value={selectedAddressId} onValueChange={(v) => {
              setSelectedAddressId(v);
              setIsAllAddressesOpen(false);
            }}>
              {addresses.map((address) => (
                <div
                  key={address.id}
                  className={`flex items-start gap-3 rounded-lg border p-3 transition-colors cursor-pointer ${
                    selectedAddressId === address.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value={address.id} id={`all-${address.id}`} className="mt-1" />
                  <Label htmlFor={`all-${address.id}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{address.label}</span>
                      {address.is_default && (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          Default
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {address.full_name} • {address.phone}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {address.street_address}, {address.city}, {address.state}
                    </p>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </DialogContent>
        </Dialog>

        {/* Promo Code Section */}
        <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <h2 className="font-medium">Promo Code</h2>
          </div>
          
          {appliedPromo ? (
            <div className="flex items-center justify-between p-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-green-600" />
                <span className="font-medium text-green-700 dark:text-green-400">{appliedPromo.code}</span>
                <span className="text-sm text-green-600">
                  {appliedPromo.discountType === "free" ? "Free Shipping" : `${appliedPromo.discountValue}% off shipping`}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={handleRemovePromo}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                placeholder="Enter promo code"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                className="flex-1"
              />
              <Button 
                variant="outline" 
                onClick={handleApplyPromoCode}
                disabled={isValidatingPromo}
              >
                {isValidatingPromo ? "..." : "Apply"}
              </Button>
            </div>
          )}
        </div>

        {/* Order Notes */}
        <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-medium">Order Notes (Optional)</h2>
          <Textarea
            placeholder="Any special instructions for your order..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {/* Order Summary */}
        <div className="mt-4 rounded-xl bg-card p-4 shadow-sm">
          <h2 className="mb-3 font-medium">Order Summary</h2>

          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.id} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.product.name} × {item.quantity}
                </span>
                <span>{formatPrice(item.product.price * item.quantity)}</span>
              </div>
            ))}
          </div>

          <Separator className="my-3" />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatPrice(total)}</span>
            </div>
            
            {/* Shipping with distance info */}
            <div className="flex justify-between text-sm">
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground">Shipping</span>
                {shippingInfo.distanceKm && (
                  <span className="text-xs text-muted-foreground">
                    (~{Math.round(shippingInfo.distanceKm)} km)
                  </span>
                )}
              </div>
              <div className="text-right">
                {shippingInfo.discount > 0 || appliedPromo ? (
                  <div className="flex flex-col items-end">
                    <span className="line-through text-xs text-muted-foreground">
                      {formatPrice(shippingInfo.baseFee)}
                    </span>
                    <span className="text-green-600 font-medium">
                      {shippingInfo.finalFee === 0 ? "FREE" : formatPrice(shippingInfo.finalFee)}
                    </span>
                  </div>
                ) : (
                  <span>{formatPrice(shippingInfo.finalFee)}</span>
                )}
              </div>
            </div>

            {/* Discount badge */}
            {(discountDescription || appliedPromo) && (
              <div className="flex items-center gap-1.5 text-xs text-green-600">
                <Percent className="h-3 w-3" />
                <span>
                  {appliedPromo 
                    ? `Promo "${appliedPromo.code}" applied!`
                    : `${discountDescription} applied!`
                  }
                </span>
              </div>
            )}
          </div>

          <Separator className="my-3" />

          <div className="flex justify-between font-display font-bold">
            <span>Total</span>
            <span>{formatPrice(grandTotal)}</span>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-4 flex justify-center gap-6 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <ShieldCheck className="h-4 w-4" />
            <span>Secure Payment</span>
          </div>
          <div className="flex items-center gap-1">
            <Truck className="h-4 w-4" />
            <span>Fast Delivery</span>
          </div>
        </div>

        {/* Place Order Button */}
        <Button
          className="mt-6 w-full"
          size="lg"
          onClick={handlePlaceOrder}
          disabled={isSubmitting || isProcessing || !selectedAddress}
        >
          <CreditCard className="mr-2 h-4 w-4" />
          {isSubmitting || isProcessing ? "Processing..." : `Pay ${formatPrice(grandTotal)}`}
        </Button>
      </div>
    </MobileLayout>
  );
}
