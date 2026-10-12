import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNowStrict } from "date-fns";
import { toast } from "sonner";
import { BadgeCheck, Loader2, Megaphone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useActivePromotions, useMonetisationSettings } from "@/hooks/useAdminVerification";

const MIN_PERIOD_DAYS = 1;
const MAX_PERIOD_DAYS = 3660;
const DEFAULT_PERIOD_DAYS = 365;
const MIN_FEATURED_WEEKS = 1;
const MAX_FEATURED_WEEKS = 52;

type PeriodMode = "one_time" | "renew";

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);

const formatFee = (amount: number) => (amount === 0 ? "Free" : formatCurrency(amount));

function isValidFee(value: string) {
  if (value.trim() === "") return false;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0;
}

function isIntInRange(value: string, min: number, max: number) {
  const n = Number(value);
  return value.trim() !== "" && Number.isInteger(n) && n >= min && n <= max;
}

function FeeInput({ id, label, value, onChange, hint }: {
  id: string; label: string; value: string; onChange: (v: string) => void; hint?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₦</span>
        <Input id={id} type="number" inputMode="decimal" min={0} step="100" value={value} onChange={(e) => onChange(e.target.value)} className="pl-7" />
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

/** Admin control for verification and homepage promotion prices (platform_settings row 1). */
export function MonetisationSettingsCard() {
  const { settings, isLoading, error, updateSettings } = useMonetisationSettings();
  const [verificationFee, setVerificationFee] = useState("");
  const [goldFee, setGoldFee] = useState("");
  const [periodMode, setPeriodMode] = useState<PeriodMode>("one_time");
  const [periodDays, setPeriodDays] = useState(String(DEFAULT_PERIOD_DAYS));
  const [productFee, setProductFee] = useState("");
  const [shopFee, setShopFee] = useState("");
  const [maxWeeks, setMaxWeeks] = useState("");

  useEffect(() => {
    if (!settings) return;
    setVerificationFee(String(settings.verification_fee));
    setGoldFee(String(settings.gold_verification_fee));
    setPeriodMode(settings.verification_period_days == null ? "one_time" : "renew");
    setPeriodDays(String(settings.verification_period_days ?? DEFAULT_PERIOD_DAYS));
    setProductFee(String(settings.featured_product_weekly_fee));
    setShopFee(String(settings.featured_shop_weekly_fee));
    setMaxWeeks(String(settings.featured_max_weeks));
  }, [settings]);

  const periodValid = periodMode === "one_time" || isIntInRange(periodDays, MIN_PERIOD_DAYS, MAX_PERIOD_DAYS);
  const valid =
    isValidFee(verificationFee) && isValidFee(goldFee) && isValidFee(productFee) && isValidFee(shopFee) &&
    isIntInRange(maxWeeks, MIN_FEATURED_WEEKS, MAX_FEATURED_WEEKS) && periodValid;

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        verification_fee: Number(verificationFee),
        gold_verification_fee: Number(goldFee),
        verification_period_days: periodMode === "one_time" ? null : Number(periodDays),
        featured_product_weekly_fee: Number(productFee),
        featured_shop_weekly_fee: Number(shopFee),
        featured_max_weeks: Number(maxWeeks),
      });
      toast.success("Fees saved. New prices apply to new requests.");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Could not save fees");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <BadgeCheck className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Verification & promotion fees</CardTitle>
        </div>
        <CardDescription>
          What sellers pay for the verified badge and for homepage spots. Set any fee to 0 to make it free:
          requests then go straight to review (verification) or start immediately (promotions).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">Could not load the current fees. Refresh the page to try again.</p>
        ) : (
          <>
            {settings && (
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="secondary">Verification: {formatFee(settings.verification_fee)}
                  {settings.verification_period_days == null ? " one-time" : ` / ${settings.verification_period_days} days`}
                </Badge>
                <Badge variant="secondary">Gold: {formatFee(settings.gold_verification_fee)}</Badge>
                <Badge variant="secondary">Product: {formatFee(settings.featured_product_weekly_fee)}/wk</Badge>
                <Badge variant="secondary">Shop logo: {formatFee(settings.featured_shop_weekly_fee)}/wk</Badge>
                <Badge variant="secondary">Max {settings.featured_max_weeks} wk</Badge>
              </div>
            )}

            <div className="space-y-3">
              <p className="text-sm font-semibold">Verified badge</p>
              <div className="grid grid-cols-2 gap-4">
                <FeeInput id="verification-fee" label="Fee" value={verificationFee} onChange={setVerificationFee} />
                <div className="space-y-2">
                  <Label>Validity</Label>
                  <Select value={periodMode} onValueChange={(v) => setPeriodMode(v as PeriodMode)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="one_time">One-time</SelectItem>
                      <SelectItem value="renew">Renew every N days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {periodMode === "renew" && (
                <div className="space-y-2">
                  <Label htmlFor="verification-days">Badge lasts (days)</Label>
                  <Input
                    id="verification-days"
                    type="number"
                    min={MIN_PERIOD_DAYS}
                    max={MAX_PERIOD_DAYS}
                    value={periodDays}
                    onChange={(e) => setPeriodDays(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">
                    After this many days the badge turns off and the seller pays again. Applies to sellers approved from now on.
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">Gold badge (top-tier sellers)</p>
              <FeeInput
                id="gold-fee"
                label="Upgrade fee"
                value={goldFee}
                onChange={setGoldFee}
                hint="Only verified (blue) sellers can upgrade. Same validity as the verified badge."
              />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold">Homepage promotions (verified sellers only)</p>
              <div className="grid grid-cols-2 gap-4">
                <FeeInput id="product-fee" label="Product, per week" value={productFee} onChange={setProductFee} hint="Top image carousel" />
                <FeeInput id="shop-fee" label="Shop logo, per week" value={shopFee} onChange={setShopFee} hint="Sliding logo strip" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-weeks">Longest booking (weeks)</Label>
                <Input
                  id="max-weeks"
                  type="number"
                  min={MIN_FEATURED_WEEKS}
                  max={MAX_FEATURED_WEEKS}
                  value={maxWeeks}
                  onChange={(e) => setMaxWeeks(e.target.value)}
                />
              </div>
            </div>

            <Button onClick={handleSave} disabled={!valid || updateSettings.isPending} className="gap-1">
              {updateSettings.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Read-only list of paid placements currently on the homepage. */
export function ActivePromotionsCard() {
  const { data: promotions = [], isLoading, error, refetch } = useActivePromotions();

  return (
    <Card className="md:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-3">
          <Megaphone className="h-5 w-5 text-muted-foreground" />
          <CardTitle className="text-lg">Active promotions</CardTitle>
          {promotions.length > 0 && <Badge variant="secondary">{promotions.length}</Badge>}
        </div>
        <CardDescription>Products and shop logos sellers have paid to show on the homepage right now.</CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-destructive">Could not load promotions.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : promotions.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">No promotions running.</p>
        ) : (
          <div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Shop</TableHead>
                  <TableHead>Promoting</TableHead>
                  <TableHead>Ends</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {promotions.map((promo) => {
                  const storeName = promo.vendor?.store_name || "Unknown shop";
                  return (
                    <TableRow key={promo.id}>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-[140px]">
                          <Avatar className="h-7 w-7 border">
                            <AvatarImage src={promo.vendor?.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">{storeName.charAt(0)}</AvatarFallback>
                          </Avatar>
                          {promo.vendor?.store_slug ? (
                            <Link to={`/shop/${promo.vendor.store_slug}`} className="font-medium hover:underline truncate">
                              {storeName}
                            </Link>
                          ) : (
                            <span className="font-medium truncate">{storeName}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {promo.kind === "shop" ? (
                          <Badge variant="outline" className="gap-1 whitespace-nowrap">
                            <Megaphone className="h-3 w-3" />
                            Shop logo
                          </Badge>
                        ) : promo.product ? (
                          <Link to={`/products/${promo.product.slug}`} className="hover:underline line-clamp-1 min-w-[120px]">
                            {promo.product.name}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">Removed product</span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-sm">
                        {promo.ends_at ? (
                          <>
                            {format(new Date(promo.ends_at), "MMM d, yyyy")}
                            <span className="block text-[11px] text-muted-foreground">
                              in {formatDistanceToNowStrict(new Date(promo.ends_at))}
                            </span>
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap font-medium">
                        {formatFee(Number(promo.amount))}
                        <span className="block text-[11px] font-normal text-muted-foreground">
                          {promo.weeks} wk
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
