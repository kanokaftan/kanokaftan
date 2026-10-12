import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  BadgeCheck,
  CalendarClock,
  CheckCircle2,
  CreditCard,
  ImageIcon,
  Images,
  Loader2,
  Megaphone,
  Package,
  Settings,
  ShieldCheck,
  Store,
  XCircle,
} from "lucide-react";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import {
  placementPhase,
  usePromotableProducts,
  usePromotions,
  type FeaturedPlacement,
  type PlacementKind,
  type PlacementPhase,
} from "@/hooks/usePromotions";
import { formatNaira, usePaystackReturn } from "@/hooks/useVerification";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const DATE_FORMAT = "d MMM yyyy";
const DEFAULT_WEEKS = 1;
const MAIN_PAY_BUTTON = "main";

const PHASE_BADGES: Record<PlacementPhase, { label: string; className: string }> = {
  live: { label: "Live", className: "bg-primary hover:bg-primary/90 text-primary-foreground" },
  queued: { label: "Starts later", className: "bg-primary hover:bg-primary/90 text-primary-foreground" },
  awaiting_payment: { label: "Awaiting payment", className: "bg-primary hover:bg-primary/90 text-primary-foreground" },
  ended: { label: "Ended", className: "" },
};

const PHASE_ORDER: Record<PlacementPhase, number> = { live: 0, queued: 1, awaiting_payment: 2, ended: 3 };

function formatDate(value: string | null): string {
  return value ? format(new Date(value), DATE_FORMAT) : "";
}

function VerificationRequiredCard() {
  const { t } = useTranslation();
  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
      <CardContent className="p-6 text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("vendorFees.verificationRequired", "Verification required")}</h2>
          <p className="text-sm text-muted-foreground">
            Only verified sellers can feature products and shop logos on the homepage. Get verified first, then come back here.
          </p>
        </div>
        <Button asChild size="lg" className="w-full sm:w-auto gap-2">
          <Link to="/vendor/verification">
            <BadgeCheck className="h-4 w-4" />
            {t("vendorFees.getVerified", "Get verified")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function OptionCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  description,
  price,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: typeof Images;
  title: string;
  description: string;
  price: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "w-full text-left rounded-xl border-2 p-4 transition-colors bg-background",
        selected ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-2 rounded-lg flex-shrink-0", selected ? "bg-primary text-primary-foreground" : "bg-muted")}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{title}</p>
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
          <p className="text-sm font-medium mt-2">{price}</p>
        </div>
        {selected && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
      </div>
    </button>
  );
}

function PlacementRow({
  placement,
  storeName,
  onPay,
  isPaying,
  payDisabled,
}: {
  placement: FeaturedPlacement;
  storeName: string | null;
  onPay: (id: string) => void;
  isPaying: boolean;
  payDisabled: boolean;
}) {
  const { t } = useTranslation();
  const phase = placementPhase(placement);
  const badge = PHASE_BADGES[phase];
  const title = placement.kind === "shop" ? storeName || "My shop" : placement.product?.name || "Product";

  let detail: string;
  switch (phase) {
    case "live":
      detail = t("vendorFees.endsOn", "Ends {{date}}", { date: formatDate(placement.ends_at) });
      break;
    case "queued":
      detail = t("vendorFees.startsOn", "Starts {{date}}, ends {{end}}", {
        date: formatDate(placement.starts_at),
        end: formatDate(placement.ends_at),
      });
      break;
    case "awaiting_payment":
      detail = t("vendorFees.notPaidYet", "Not paid yet");
      break;
    default:
      detail = placement.ends_at
        ? t("vendorFees.endedOn", "Ended {{date}}", { date: formatDate(placement.ends_at) })
        : t("vendorFees.ended", "Ended");
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-background">
      <div className="h-12 w-12 rounded-md bg-muted overflow-hidden flex-shrink-0 flex items-center justify-center">
        {placement.kind === "product" && placement.product?.image_url ? (
          <img src={placement.product.image_url} alt="" className="h-full w-full object-cover" />
        ) : placement.kind === "shop" ? (
          <Store className="h-5 w-5 text-muted-foreground" />
        ) : (
          <Package className="h-5 w-5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className="font-medium text-sm truncate max-w-full">{title}</p>
          <Badge variant={phase === "ended" ? "secondary" : "default"} className={cn("text-[10px] px-1.5", badge.className)}>
            {t(`vendorFees.phase_${phase}`, badge.label)}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {placement.kind === "shop" ? "Logo strip" : "Homepage carousel"} · {placement.weeks}{" "}
          {placement.weeks === 1 ? "week" : "weeks"} · {formatNaira(placement.amount)}
        </p>
        <p className="text-xs mt-0.5">{detail}</p>
      </div>
      {phase === "awaiting_payment" && (
        <Button size="sm" onClick={() => onPay(placement.id)} disabled={payDisabled} className="flex-shrink-0 gap-1.5">
          {isPaying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
          {t("vendorFees.payNow", "Pay now")}
        </Button>
      )}
    </div>
  );
}

export default function VendorPromote() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { userId } = useVendorAuth();
  const [searchParams] = useSearchParams();
  const { placements, settings, profile, isVerified, isLoading, error, request, pay, refresh } = usePromotions(userId);
  const { data: products, isLoading: productsLoading } = usePromotableProducts(isVerified ? userId : null);

  const successMessage = useMemo(
    () => ({
      title: t("vendorFees.promotionLive", "Promotion confirmed"),
      description: t("vendorFees.promotionLiveDesc", "Your homepage placement is booked. Thank you!"),
    }),
    [t]
  );
  const { isConfirming } = usePaystackReturn(refresh, successMessage);

  const preselectedProduct = searchParams.get("product");
  const [kind, setKind] = useState<PlacementKind>("product");
  const [productId, setProductId] = useState<string>("");
  const [weeks, setWeeks] = useState(DEFAULT_WEEKS);
  // Which button started the checkout: the main Pay button or a "Pay now" row.
  const [payingFrom, setPayingFrom] = useState<string | null>(null);

  // Preselect ?product=<id> once the product list is in (only if it is promotable).
  useEffect(() => {
    if (!products?.length || productId) return;
    const match = preselectedProduct && products.find((p) => p.id === preselectedProduct);
    setProductId(match ? match.id : products[0].id);
  }, [products, preselectedProduct, productId]);

  useEffect(() => {
    if (!pay.isPending) setPayingFrom(null);
  }, [pay.isPending]);

  const maxWeeks = settings?.featured_max_weeks ?? DEFAULT_WEEKS;
  const weeklyFee = kind === "product" ? settings?.featured_product_weekly_fee ?? 0 : settings?.featured_shop_weekly_fee ?? 0;
  const total = weeklyFee * weeks;
  const selectedProduct = products?.find((p) => p.id === productId) ?? null;
  const hasLogo = !!profile?.avatar_url;
  const canBuy = kind === "product" ? !!selectedProduct : hasLogo;
  const isBusy = request.isPending || pay.isPending || isConfirming;

  const sortedPlacements = useMemo(
    () =>
      [...placements].sort((a, b) => {
        const byPhase = PHASE_ORDER[placementPhase(a)] - PHASE_ORDER[placementPhase(b)];
        return byPhase !== 0 ? byPhase : b.created_at.localeCompare(a.created_at);
      }),
    [placements]
  );

  const showError = (title: string, err: unknown) =>
    toast({
      title,
      description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      variant: "destructive",
    });

  const handlePay = async (placementId: string, source: string = placementId) => {
    setPayingFrom(source);
    try {
      await pay.mutateAsync(placementId);
    } catch (err) {
      showError(t("vendorFees.paymentFailed", "Could not start payment"), err);
    }
  };

  const handleBuy = async () => {
    if (!canBuy) return;
    let placement;
    try {
      placement = await request.mutateAsync({ kind, weeks, productId: kind === "product" ? productId : null });
    } catch (err) {
      showError(t("vendorFees.promoteFailed", "Could not book this promotion"), err);
      return;
    }

    if (placement.status === "active") {
      toast(successMessage);
      return;
    }
    await handlePay(placement.id, MAIN_PAY_BUTTON);
  };

  // Clamp weeks if an admin lowered the maximum.
  useEffect(() => {
    if (weeks > maxWeeks) setWeeks(maxWeeks);
  }, [weeks, maxWeeks]);

  const renderPurchase = () => {
    if (!settings) return null;
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            {t("vendorFees.promoteTitle", "Feature on the homepage")}
          </CardTitle>
          <CardDescription>Get seen by every shopper who opens Kano Kaftan.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <OptionCard
              selected={kind === "product"}
              onSelect={() => setKind("product")}
              icon={Images}
              title={t("vendorFees.carouselOption", "Homepage carousel: feature a product")}
              description="Your product photo appears in the big image carousel at the top of the homepage."
              price={t("vendorFees.perWeek", "{{amount}} / week", { amount: formatNaira(settings.featured_product_weekly_fee) })}
            />
            <OptionCard
              selected={kind === "shop"}
              onSelect={() => setKind("shop")}
              icon={Store}
              title={t("vendorFees.logoOption", "Logo strip: feature my shop")}
              description="Your shop logo appears in the strip of featured shops on the homepage."
              price={t("vendorFees.perWeek", "{{amount}} / week", { amount: formatNaira(settings.featured_shop_weekly_fee) })}
            />
          </div>

          {kind === "product" ? (
            <div className="space-y-2">
              <Label htmlFor="promote_product">{t("vendorFees.chooseProduct", "Choose a product")}</Label>
              {productsLoading ? (
                <Skeleton className="h-10 w-full" />
              ) : !products?.length ? (
                <Alert>
                  <ImageIcon className="h-4 w-4" />
                  <AlertTitle>{t("vendorFees.noPromotableProducts", "No products to feature yet")}</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>The carousel shows a product photo, so publish a product with at least one photo first.</p>
                    <Button asChild size="sm" variant="outline">
                      <Link to="/vendor/products">{t("vendorFees.goToProducts", "Go to products")}</Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : (
                <>
                  <Select value={productId} onValueChange={setProductId}>
                    <SelectTrigger id="promote_product">
                      <SelectValue placeholder={t("vendorFees.chooseProduct", "Choose a product")} />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedProduct && (
                    <div className="flex items-center gap-3 rounded-lg border p-2">
                      <img
                        src={selectedProduct.image_url}
                        alt={selectedProduct.name}
                        className="h-20 w-20 rounded-md object-cover flex-shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{selectedProduct.name}</p>
                        {selectedProduct.featured && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {selectedProduct.featured_until
                              ? t("vendorFees.featuredUntilExtend", "Featured until {{date}}. New weeks are added after that.", {
                                  date: formatDate(selectedProduct.featured_until),
                                })
                              : t("vendorFees.featured", "Featured")}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t("vendorFees.yourLogo", "Your shop logo")}</Label>
              {hasLogo ? (
                <div className="flex items-center gap-3 rounded-lg border p-2">
                  <img
                    src={profile!.avatar_url!}
                    alt={profile?.store_name ?? "Shop logo"}
                    className="h-16 w-16 rounded-full object-cover border flex-shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">{profile?.store_name || "My shop"}</p>
                    {profile?.shop_featured_until && new Date(profile.shop_featured_until).getTime() > Date.now() && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {t("vendorFees.featuredUntilExtend", "Featured until {{date}}. New weeks are added after that.", {
                          date: formatDate(profile.shop_featured_until),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <Alert>
                  <ImageIcon className="h-4 w-4" />
                  <AlertTitle>{t("vendorFees.addLogoTitle", "Add a shop logo first")}</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>The logo strip shows your shop logo. Upload one in Settings, then come back.</p>
                    <Button asChild size="sm" variant="outline" className="gap-1.5">
                      <Link to="/vendor/settings">
                        <Settings className="h-3.5 w-3.5" />
                        {t("vendorFees.openSettings", "Open Settings")}
                      </Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="promote_weeks">{t("vendorFees.howLong", "How long?")}</Label>
            <Select value={String(weeks)} onValueChange={(value) => setWeeks(Number(value))}>
              <SelectTrigger id="promote_weeks">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: maxWeeks }, (_, i) => i + 1).map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n === 1 ? t("vendorFees.oneWeek", "1 week") : t("vendorFees.nWeeks", "{{n}} weeks", { n })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="rounded-lg bg-muted/60 p-4 flex items-center justify-between gap-3">
            <div className="text-sm text-muted-foreground">
              {formatNaira(weeklyFee)} × {weeks} {weeks === 1 ? "week" : "weeks"}
            </div>
            <div className="text-xl font-bold">{formatNaira(total)}</div>
          </div>

          <Button size="lg" className="w-full gap-2" onClick={handleBuy} disabled={!canBuy || isBusy}>
            {request.isPending || (pay.isPending && payingFrom === MAIN_PAY_BUTTON) ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CreditCard className="h-4 w-4" />
            )}
            {total > 0
              ? t("vendorFees.payAmount", "Pay {{amount}}", { amount: formatNaira(total) })
              : t("vendorFees.startPromotion", "Start promotion")}
          </Button>
          {total > 0 && (
            <p className="text-xs text-muted-foreground text-center">
              You'll pay securely with Paystack. Your placement starts as soon as payment is confirmed.
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderPlacements = () => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <CalendarClock className="h-5 w-5 text-muted-foreground" />
          {t("vendorFees.myPromotions", "My promotions")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sortedPlacements.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            {t("vendorFees.noPromotions", "You haven't promoted anything yet.")}
          </p>
        ) : (
          <div className="space-y-2">
            {sortedPlacements.map((placement) => (
              <PlacementRow
                key={placement.id}
                placement={placement}
                storeName={profile?.store_name ?? null}
                onPay={handlePay}
                isPaying={pay.isPending && payingFrom === placement.id}
                payDisabled={isBusy}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <VendorLayout title={t("vendorFees.promoteNav", "Promote")}>
      <div className="max-w-2xl mx-auto space-y-4">
        {isConfirming && (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>{t("vendorFees.confirmingPayment", "Confirming your payment...")}</AlertTitle>
            <AlertDescription>This takes a few seconds.</AlertDescription>
          </Alert>
        )}

        {error ? (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>{t("vendorFees.loadPromotionsFailed", "Could not load promotions")}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error instanceof Error ? error.message : "Please try again."}</p>
              <Button size="sm" variant="outline" onClick={refresh}>
                {t("vendorFees.retry", "Try again")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-96 w-full rounded-xl" />
            <Skeleton className="h-40 w-full rounded-xl" />
          </div>
        ) : !isVerified ? (
          <>
            <VerificationRequiredCard />
            {sortedPlacements.length > 0 && renderPlacements()}
          </>
        ) : (
          <>
            {renderPurchase()}
            {renderPlacements()}
          </>
        )}
      </div>
    </VendorLayout>
  );
}

