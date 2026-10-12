import { useEffect, useState } from "react";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Eye, EyeOff, Loader2, Store, ShieldCheck, Megaphone, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { HowYouEarn } from "@/components/vendor/HowYouEarn";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import {
  normalizePhone,
  useMyVendorApplication,
  useSubmitVendorApplication,
  validateShopDetails,
  type ShopDetails,
  type VendorApplication,
} from "@/hooks/useVendorApplication";
import { toast } from "sonner";

function formatNaira(amount: number): string {
  return new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);
}

const EMPTY_SHOP: ShopDetails = { shop_name: "", phone: "", city: "", state: "Kano", description: "" };

/**
 * Seller application. Separate from customer sign-up: sellers register here with
 * email + password and their shop details, then wait for Kano Kaftan to approve
 * them. Signed-in customers can apply from here too.
 */
export default function SellerApply() {
  const navigate = useNavigate();
  const { user, isLoading: authLoading, isVendor, rolesLoading } = useAuth();
  const { data: application, isLoading: appLoading } = useMyVendorApplication(user?.id);
  const [submittedPhone, setSubmittedPhone] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (user && !rolesLoading && isVendor) navigate("/vendor/dashboard", { replace: true });
  }, [user, rolesLoading, isVendor, navigate]);

  const loading = authLoading || (!!user && (rolesLoading || appLoading));

  let body: React.ReactNode;
  if (loading) {
    body = <Skeleton className="h-96 w-full rounded-xl" />;
  } else if (submittedPhone) {
    body = <ApplicationReceived phone={submittedPhone} signedIn={!!user} />;
  } else if (application && !editing && application.status !== "approved") {
    body = <ApplicationStatus application={application} onEdit={() => setEditing(true)} />;
  } else {
    body = (
      <ApplicationForm
        signedIn={!!user}
        initial={application ?? undefined}
        onSubmitted={(phone) => {
          setEditing(false);
          setSubmittedPhone(phone);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <BrandLogo alt="" className="h-9 w-9" />
            <span className="font-display text-lg font-bold text-primary">Kano Kaftan</span>
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Sellers</span>
          </Link>
          {!user && (
            <Link to="/vendor/login" className="text-sm font-medium text-primary hover:underline">
              Seller sign in
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-2xl space-y-6 px-4 py-6 pb-16">{body}</main>
    </div>
  );
}

function HowSellingWorks() {
  const { data: settings } = useQuery({
    queryKey: ["platform-settings", "seller-apply"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_settings")
        .select("verification_fee")
        .eq("id", 1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">How selling on Kano Kaftan works</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex gap-3">
          <Store className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <p><strong>Free to apply.</strong> We review every shop. Once approved you get your own shop page and seller dashboard.</p>
        </div>
        <div>
          <p className="mb-2 font-semibold">Three ways to earn</p>
          <HowYouEarn />
          <p className="mt-2 text-xs text-muted-foreground">
            Customers pay delivery separately; it never comes out of your price. Orders through Kano Kaftan pay you half when
            the customer pays and the rest after delivery, straight to your bank account.
          </p>
        </div>
        <div className="flex gap-3">
          <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <p>
            <strong>Verified badge (optional).</strong>
            {settings?.verification_fee ? ` For a one-time ${formatNaira(settings.verification_fee)}, ` : " "}
            we check your ID and business so buyers trust you more.
          </p>
        </div>
        <div className="flex gap-3">
          <Megaphone className="mt-0.5 h-5 w-5 flex-shrink-0 text-primary" />
          <p><strong>Homepage promotion.</strong> Verified shops can feature products or their logo on the homepage.</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicationForm({
  signedIn,
  initial,
  onSubmitted,
}: {
  signedIn: boolean;
  initial?: VendorApplication;
  onSubmitted: (phone: string) => void;
}) {
  const submitApplication = useSubmitVendorApplication();
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [account, setAccount] = useState({ full_name: initial?.full_name ?? "", email: "", password: "" });
  const [shop, setShop] = useState<ShopDetails>(
    initial
      ? { shop_name: initial.shop_name, phone: initial.phone, city: initial.city, state: initial.state, description: initial.description }
      : EMPTY_SHOP,
  );

  const setShopField = (field: keyof ShopDetails) => (value: string) => setShop((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signedIn) {
      if (account.full_name.trim().length < 2) return toast.error("Enter your full name");
      if (!/^\S+@\S+\.\S+$/.test(account.email.trim())) return toast.error("Enter a valid email address");
      if (account.password.length < 8) return toast.error("Choose a password of at least 8 characters");
    }
    const problem = validateShopDetails(shop);
    if (problem) return toast.error(problem);
    if (!agreed) return toast.error("Please accept the seller terms to continue");

    const phone = normalizePhone(shop.phone);
    setBusy(true);
    try {
      if (signedIn) {
        await submitApplication.mutateAsync({ ...shop, phone, full_name: account.full_name });
      } else {
        // The application rides along with the sign-up, so it is saved even
        // before the seller confirms their email.
        const { error } = await supabase.auth.signUp({
          email: account.email.trim(),
          password: account.password,
          options: {
            emailRedirectTo: `${window.location.origin}/vendor/login`,
            data: {
              full_name: account.full_name.trim(),
              phone,
              vendor_application: {
                shop_name: shop.shop_name.trim(),
                phone,
                city: shop.city.trim(),
                state: shop.state,
                description: shop.description.trim(),
              },
            },
          },
        });
        if (error) {
          if (/already registered/i.test(error.message)) {
            throw new Error("This email already has an account. Sign in first, then apply from this page.");
          }
          throw error;
        }
      }
      onSubmitted(phone);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Could not send your application";
      console.error("Seller application failed:", error);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div>
        <h1 className="font-display text-2xl font-bold text-primary">Sell on Kano Kaftan</h1>
        <p className="mt-1 text-muted-foreground">
          {initial?.status === "rejected" ? "Update your application and send it again." : "Apply to open your shop. It takes about 2 minutes."}
        </p>
      </div>

      {!initial && <HowSellingWorks />}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        {!signedIn && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Your seller account</CardTitle>
              <CardDescription>You'll use this email and password to sign in to your seller dashboard.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="full_name">Full name *</Label>
                <Input id="full_name" autoComplete="name" value={account.full_name}
                  onChange={(e) => setAccount((a) => ({ ...a, full_name: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={account.email}
                  onChange={(e) => setAccount((a) => ({ ...a, email: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} autoComplete="new-password"
                    placeholder="At least 8 characters" value={account.password}
                    onChange={(e) => setAccount((a) => ({ ...a, password: e.target.value }))} />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowPassword((s) => !s)} aria-label={showPassword ? "Hide password" : "Show password"}>
                    {showPassword ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your shop</CardTitle>
            <CardDescription>You can change these later in your shop settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="shop_name">Shop name *</Label>
              <Input id="shop_name" placeholder="e.g. Alhaji Musa Tailoring" maxLength={60} value={shop.shop_name}
                onChange={(e) => setShopField("shop_name")(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone / WhatsApp *</Label>
              <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="0803 123 4567" value={shop.phone}
                onChange={(e) => setShopField("phone")(e.target.value)} />
              <p className="text-xs text-muted-foreground">We'll contact you on this number when your shop is ready.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="city">Town / city *</Label>
                <Input id="city" placeholder="e.g. Kano" value={shop.city} onChange={(e) => setShopField("city")(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State *</Label>
                <Select value={shop.state} onValueChange={setShopField("state")}>
                  <SelectTrigger id="state"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NIGERIAN_STATES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">What do you sell? *</Label>
              <Textarea id="description" rows={4} maxLength={600}
                placeholder="e.g. Hand-embroidered babban riga and kaftans, made to measure in Kano since 2010."
                value={shop.description} onChange={(e) => setShopField("description")(e.target.value)} />
            </div>
            <div className="flex items-start gap-3 rounded-lg border p-3">
              <Checkbox id="agree" checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              <Label htmlFor="agree" className="text-sm font-normal leading-snug">
                I will only sell items I have, describe them honestly and ship on time. I agree to the{" "}
                <Link to="/terms" target="_blank" className="text-primary underline">Terms of Service</Link>, including the seller rules.
              </Label>
            </div>
          </CardContent>
        </Card>

        <Button type="submit" className="w-full" size="lg" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initial?.status === "rejected" ? "Send updated application" : "Send application"}
        </Button>

        {!signedIn && (
          <p className="text-center text-sm text-muted-foreground">
            Already a seller? <Link to="/vendor/login" className="font-medium text-primary hover:underline">Sign in</Link>
            {" · "}
            Just shopping? <Link to="/auth?mode=register" className="font-medium text-primary hover:underline">Create a customer account</Link>
          </p>
        )}
      </form>
    </>
  );
}

function ApplicationReceived({ phone, signedIn }: { phone: string; signedIn: boolean }) {
  return (
    <Card className="border-primary/30">
      <CardContent className="flex flex-col items-center py-10 text-center">
        <CheckCircle2 className="mb-4 h-14 w-14 text-green-600" />
        <h1 className="font-display text-2xl font-bold">Application received</h1>
        <p className="mt-2 max-w-md text-muted-foreground">
          Thank you! Our team will review your shop and contact you on <strong className="text-foreground">{phone}</strong>{" "}
          (call or WhatsApp) once your shop is ready, usually within 1–2 working days.
        </p>
        {!signedIn && (
          <p className="mt-3 max-w-md text-sm text-muted-foreground">
            If we sent you a confirmation email, please click the link in it so you can sign in later.
          </p>
        )}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <Button asChild variant="outline"><Link to="/">Back to the shop</Link></Button>
          <Button asChild variant="ghost"><Link to="/help">Questions? Contact us</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ApplicationStatus({ application, onEdit }: { application: VendorApplication; onEdit: () => void }) {
  const rejected = application.status === "rejected";
  return (
    <Card className={rejected ? "border-destructive/40" : "border-primary/30"}>
      <CardContent className="flex flex-col items-center py-10 text-center">
        {rejected ? (
          <AlertCircle className="mb-4 h-14 w-14 text-destructive" />
        ) : (
          <Clock className="mb-4 h-14 w-14 text-primary" />
        )}
        <h1 className="font-display text-2xl font-bold">{rejected ? "Your application needs changes" : "Your application is being reviewed"}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Shop: <strong className="text-foreground">{application.shop_name}</strong></p>
        {rejected ? (
          <>
            {application.admin_note && (
              <p className="mt-4 max-w-md rounded-lg bg-destructive/10 p-3 text-sm text-foreground">{application.admin_note}</p>
            )}
            <Button className="mt-6" onClick={onEdit}>Update my application</Button>
          </>
        ) : (
          <p className="mt-3 max-w-md text-muted-foreground">
            We'll contact you on <strong className="text-foreground">{application.phone}</strong> once your shop is ready. After
            that, sign in here to open your seller dashboard.
          </p>
        )}
        <Button asChild variant="ghost" className="mt-4"><Link to="/">Back to the shop</Link></Button>
      </CardContent>
    </Card>
  );
}
