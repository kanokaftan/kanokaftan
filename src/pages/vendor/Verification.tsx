import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { format } from "date-fns";
import {
  BadgeCheck,
  Clock,
  Crown,
  CreditCard,
  FileText,
  Home,
  Loader2,
  Megaphone,
  Pencil,
  ShieldCheck,
  TrendingUp,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import {
  ALLOWED_ID_DOCUMENT_TYPES,
  ID_TYPE_LABELS,
  MAX_ID_DOCUMENT_BYTES,
  formatNaira,
  usePaystackReturn,
  useVerification,
  type IdType,
  type VerificationRequest,
  type VendorFeeSettings,
  type VerificationTierName,
} from "@/hooks/useVerification";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";

const FIELD_LIMITS = {
  businessName: { min: 2, max: 120 },
  contactPhone: { min: 7, max: 20 },
  businessAddress: { min: 5, max: 300 },
  idNumber: { min: 4, max: 40 },
  notes: { max: 1000 },
} as const;

const DATE_FORMAT = "d MMM yyyy";

interface FormState {
  businessName: string;
  contactPhone: string;
  businessAddress: string;
  idType: IdType | "";
  idNumber: string;
  notes: string;
}

const EMPTY_FORM: FormState = {
  businessName: "",
  contactPhone: "",
  businessAddress: "",
  idType: "",
  idNumber: "",
  notes: "",
};

function formFromRequest(request: VerificationRequest | null, storeName: string | null): FormState {
  if (!request) return { ...EMPTY_FORM, businessName: storeName ?? "" };
  return {
    businessName: request.business_name,
    contactPhone: request.contact_phone,
    businessAddress: request.business_address,
    idType: request.id_type,
    idNumber: request.id_number,
    notes: request.notes ?? "",
  };
}

function validateForm(form: FormState, needsDocument: boolean, idDocument: File | null): string | null {
  const length = (value: string) => value.trim().length;
  if (length(form.businessName) < FIELD_LIMITS.businessName.min || length(form.businessName) > FIELD_LIMITS.businessName.max) {
    return "Enter your business name (2–120 characters)";
  }
  if (length(form.contactPhone) < FIELD_LIMITS.contactPhone.min || length(form.contactPhone) > FIELD_LIMITS.contactPhone.max) {
    return "Enter a valid phone number";
  }
  if (length(form.businessAddress) < FIELD_LIMITS.businessAddress.min || length(form.businessAddress) > FIELD_LIMITS.businessAddress.max) {
    return "Enter your business address (at least 5 characters)";
  }
  if (!form.idType) return "Choose the type of ID you are uploading";
  if (length(form.idNumber) < FIELD_LIMITS.idNumber.min || length(form.idNumber) > FIELD_LIMITS.idNumber.max) {
    return "Enter your ID number (4–40 characters)";
  }
  if (needsDocument && !idDocument) return "Upload a photo or PDF of your ID";
  if (form.notes.length > FIELD_LIMITS.notes.max) return "Your note is too long (1000 characters max)";
  return null;
}

function tierFee(settings: VendorFeeSettings, tier: VerificationTierName): number {
  return tier === "gold" ? settings.gold_verification_fee : settings.verification_fee;
}

function feeLabel(settings: VendorFeeSettings, tier: VerificationTierName = "blue"): string {
  const fee = tierFee(settings, tier);
  if (fee === 0) return "Free";
  if (settings.verification_period_days == null) return `${formatNaira(fee)} one-time`;
  return `${formatNaira(fee)} every ${settings.verification_period_days} days`;
}

function BenefitsCard({ settings }: { settings: VendorFeeSettings }) {
  const { t } = useTranslation();
  const benefits = [
    { icon: BadgeCheck, text: t("vendorFees.benefitBadge", "Verified badge on your shop and all your products") },
    { icon: TrendingUp, text: t("vendorFees.benefitRank", "Your shop is listed first on the Sellers page") },
    { icon: Home, text: t("vendorFees.benefitHomepage", "You can feature your products and logo on the homepage") },
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <ShieldCheck className="h-5 w-5 text-primary" />
          {t("vendorFees.getVerifiedTitle", "Get your shop verified")}
        </CardTitle>
        <CardDescription>
          Buyers trust verified sellers more. We check your details and ID, then switch on your badge.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2.5">
          {benefits.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm">
              <Icon className="h-4 w-4 mt-0.5 text-primary flex-shrink-0" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between rounded-lg bg-background/80 border px-4 py-3">
          <span className="text-sm text-muted-foreground">{t("vendorFees.fee", "Fee")}</span>
          <span className="font-semibold">{feeLabel(settings)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function VerifiedCard({ verifiedUntil, tier = "blue" }: { verifiedUntil: string | null; tier?: VerificationTierName }) {
  const { t } = useTranslation();
  const gold = tier === "gold";
  return (
    <Card className={gold
      ? "border-amber-500/40 bg-gradient-to-br from-amber-400/15 to-amber-500/5"
      : "border-green-500/30 bg-gradient-to-br from-green-500/10 to-green-500/5"}>
      <CardContent className="p-6 text-center space-y-4">
        <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${gold ? "bg-amber-500/15" : "bg-green-500/15"}`}>
          <VerifiedBadge className="h-9 w-9" tier={tier} />
        </div>
        <div className="space-y-1">
          <h2 className="text-xl font-semibold">
            {gold ? t("vendorFees.goldTitle", "Your shop is gold") : t("vendorFees.verifiedTitle", "Your shop is verified")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {gold
              ? "Your gold badge shows on your shop and products, and your shop and products are listed before everyone else."
              : "Your badge shows on your shop and products, and you rank first on the Sellers page."}
          </p>
          {verifiedUntil && (
            <p className="text-sm font-medium">
              {t("vendorFees.validUntil", "Valid until {{date}}", { date: format(new Date(verifiedUntil), DATE_FORMAT) })}
            </p>
          )}
        </div>
        <Button asChild className="w-full sm:w-auto gap-2">
          <Link to="/vendor/promote">
            <Megaphone className="h-4 w-4" />
            {t("vendorFees.promoteCta", "Promote on the homepage")}
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function GoldOfferCard({ settings, onStart }: { settings: VendorFeeSettings; onStart?: () => void }) {
  const { t } = useTranslation();
  const benefits = [
    { icon: Crown, text: t("vendorFees.goldBenefitBadge", "Golden tick on your shop and all your products") },
    { icon: TrendingUp, text: t("vendorFees.goldBenefitRank", "Your shop and products are listed before all other sellers") },
    { icon: ShieldCheck, text: t("vendorFees.goldBenefitTrust", "Buyers see you as a top-tier seller") },
  ];
  return (
    <Card className="border-amber-500/40 bg-gradient-to-br from-amber-400/15 to-amber-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <VerifiedBadge className="h-5 w-5" tier="gold" />
          {t("vendorFees.goldOfferTitle", "Upgrade to Gold")}
        </CardTitle>
        <CardDescription>For top-tier sellers. Pay the fee and our team reviews your shop.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-2.5">
          {benefits.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-3 text-sm">
              <Icon className="h-4 w-4 mt-0.5 text-[#9A7400] flex-shrink-0" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between rounded-lg bg-background/80 border px-4 py-3">
          <span className="text-sm text-muted-foreground">{t("vendorFees.fee", "Fee")}</span>
          <span className="font-semibold">{feeLabel(settings, "gold")}</span>
        </div>
        {onStart && (
          <Button size="lg" className="w-full gap-2 bg-[#9A7400] text-white hover:bg-[#7F5F00]" onClick={onStart}>
            <Crown className="h-4 w-4" />
            {t("vendorFees.goldStart", "Upgrade to Gold")}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function RequestSummary({ request }: { request: VerificationRequest }) {
  const rows = [
    ["Business name", request.business_name],
    ["Phone", request.contact_phone],
    ["Address", request.business_address],
    ["ID", `${ID_TYPE_LABELS[request.id_type] ?? request.id_type} · ${request.id_number}`],
  ];
  return (
    <dl className="grid gap-2 text-sm rounded-lg border bg-muted/40 p-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex flex-col sm:flex-row sm:gap-2">
          <dt className="text-muted-foreground sm:w-32 flex-shrink-0">{label}</dt>
          <dd className="font-medium break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export default function VendorVerification() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { userId } = useVendorAuth();
  const { request, profile, settings, isVerified, isGold, isLoading, error, submit, pay, refresh } = useVerification(userId);

  const successMessage = useMemo(
    () => ({
      title: t("vendorFees.paymentReceived", "Payment received"),
      description: t("vendorFees.underReviewToast", "Your details are now with our team for review."),
    }),
    [t]
  );
  const { isConfirming } = usePaystackReturn(refresh, successMessage);

  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [idDocument, setIdDocument] = useState<File | null>(null);
  const [editing, setEditing] = useState(false);
  const [upgrading, setUpgrading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefilledFor = useRef<string | null>(null);

  // Prefill once per request (or once with the store name when there is none).
  useEffect(() => {
    if (isLoading) return;
    const key = request?.id ?? "new";
    if (prefilledFor.current === key) return;
    prefilledFor.current = key;
    setForm(formFromRequest(request, profile?.store_name ?? null));
  }, [isLoading, request, profile?.store_name]);

  const status = request?.status;
  // An approved request whose badge has since expired means starting over.
  const hasOpenRequest = !!request && status !== "approved";
  const alreadyPaid = hasOpenRequest && !!request?.paid_at;
  // A verified (blue) seller can only apply for the next level: gold.
  const applyingTier: VerificationTierName = isVerified ? "gold" : "blue";
  const fee = settings ? tierFee(settings, applyingTier) : 0;
  const needsPayment = !alreadyPaid && fee > 0;
  // A gold upgrade reuses the ID already on record from the approved verification.
  const needsDocument = !request?.id_document_path || (!hasOpenRequest && !isVerified);
  const isSubmitting = submit.isPending || pay.isPending;

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!file) return;
    if (!ALLOWED_ID_DOCUMENT_TYPES.includes(file.type)) {
      toast({ title: "Unsupported file", description: "Upload a JPG, PNG, WEBP photo or a PDF.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_ID_DOCUMENT_BYTES) {
      toast({ title: "File too large", description: "Your ID file must be 5 MB or smaller.", variant: "destructive" });
      return;
    }
    setIdDocument(file);
  };

  const showError = (title: string, err: unknown) => {
    toast({
      title,
      description: err instanceof Error ? err.message : "Something went wrong. Please try again.",
      variant: "destructive",
    });
  };

  const handlePay = async () => {
    try {
      await pay.mutateAsync();
    } catch (err) {
      showError(t("vendorFees.paymentFailed", "Could not start payment"), err);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const problem = validateForm(form, needsDocument, idDocument);
    if (problem) {
      toast({ title: t("vendorFees.checkDetails", "Check your details"), description: problem, variant: "destructive" });
      return;
    }

    let result;
    try {
      result = await submit.mutateAsync({
        businessName: form.businessName,
        contactPhone: form.contactPhone,
        businessAddress: form.businessAddress,
        idType: form.idType as IdType,
        idNumber: form.idNumber,
        idDocument,
        existingDocumentPath: request?.id_document_path ?? null,
        notes: form.notes,
        tier: applyingTier,
      });
    } catch (err) {
      showError(t("vendorFees.submitFailed", "Could not submit your details"), err);
      return;
    }

    setIdDocument(null);
    setEditing(false);
    setUpgrading(false);
    if (result.needs_payment) {
      await handlePay();
    } else {
      toast({
        title: t("vendorFees.submitted", "Details submitted"),
        description: t("vendorFees.underReviewToast", "Your details are now with our team for review."),
      });
    }
  };

  const submitLabel = needsPayment
    ? t("vendorFees.payAndSubmit", "Pay {{amount}} & submit", { amount: formatNaira(fee) })
    : status === "rejected"
      ? t("vendorFees.resubmit", "Resubmit for review")
      : t("vendorFees.submitForReview", "Submit for review");

  const renderForm = () => (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t("vendorFees.yourDetails", "Your business details")}</CardTitle>
        <CardDescription>Only our review team can see your ID.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="business_name">{t("vendorFees.businessName", "Business name")}</Label>
            <Input
              id="business_name"
              value={form.businessName}
              maxLength={FIELD_LIMITS.businessName.max}
              onChange={(e) => updateField("businessName", e.target.value)}
              autoComplete="organization"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="contact_phone">{t("vendorFees.phone", "Phone number")}</Label>
            <Input
              id="contact_phone"
              type="tel"
              inputMode="tel"
              value={form.contactPhone}
              maxLength={FIELD_LIMITS.contactPhone.max}
              onChange={(e) => updateField("contactPhone", e.target.value)}
              placeholder="0803 000 0000"
              autoComplete="tel"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="business_address">{t("vendorFees.address", "Business address")}</Label>
            <Textarea
              id="business_address"
              value={form.businessAddress}
              maxLength={FIELD_LIMITS.businessAddress.max}
              onChange={(e) => updateField("businessAddress", e.target.value)}
              rows={2}
              autoComplete="street-address"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="id_type">{t("vendorFees.idType", "ID type")}</Label>
              <Select value={form.idType} onValueChange={(value) => updateField("idType", value as IdType)}>
                <SelectTrigger id="id_type">
                  <SelectValue placeholder={t("vendorFees.chooseId", "Choose ID")} />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ID_TYPE_LABELS) as IdType[]).map((type) => (
                    <SelectItem key={type} value={type}>
                      {ID_TYPE_LABELS[type]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="id_number">{t("vendorFees.idNumber", "ID number")}</Label>
              <Input
                id="id_number"
                value={form.idNumber}
                maxLength={FIELD_LIMITS.idNumber.max}
                onChange={(e) => updateField("idNumber", e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t("vendorFees.idDocument", "Photo or PDF of your ID")}</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept={ALLOWED_ID_DOCUMENT_TYPES.join(",")}
              className="hidden"
              onChange={handleFileChange}
            />
            {idDocument ? (
              <div className="flex items-center gap-3 rounded-lg border p-3">
                <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{idDocument.name}</p>
                  <p className="text-xs text-muted-foreground">{(idDocument.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
                <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIdDocument(null)}>
                  <X className="h-4 w-4" />
                  <span className="sr-only">Remove file</span>
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="w-full h-auto py-4 border-dashed flex-col gap-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="h-5 w-5" />
                <span>{t("vendorFees.uploadId", "Upload ID")}</span>
                <span className="text-xs font-normal text-muted-foreground">JPG, PNG, WEBP or PDF · max 5 MB</span>
              </Button>
            )}
            {!needsDocument && !idDocument && (
              <p className="text-xs text-muted-foreground">
                We already have your ID file. Upload a new one only if you need to replace it.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">
              {t("vendorFees.note", "Note")}{" "}
              <span className="text-muted-foreground font-normal">({t("vendorFees.optional", "optional")})</span>
            </Label>
            <Textarea
              id="notes"
              value={form.notes}
              maxLength={FIELD_LIMITS.notes.max}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={2}
              placeholder="Anything our team should know"
            />
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-2 pt-2">
            {(editing || upgrading) && (
              <Button type="button" variant="outline" onClick={() => { setEditing(false); setUpgrading(false); }} disabled={isSubmitting}>
                {t("common.cancel", "Cancel")}
              </Button>
            )}
            <Button type="submit" size="lg" className="w-full sm:w-auto gap-2" disabled={isSubmitting || isConfirming}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : needsPayment ? <CreditCard className="h-4 w-4" /> : null}
              {isSubmitting ? t("vendorFees.processing", "Please wait...") : submitLabel}
            </Button>
          </div>
          {needsPayment && (
            <p className="text-xs text-muted-foreground">You'll pay securely with Paystack, then come back here.</p>
          )}
        </form>
      </CardContent>
    </Card>
  );

  const renderStatus = () => {
    if (!settings) return null;
    if (isGold) return <VerifiedCard verifiedUntil={profile?.verified_until ?? null} tier="gold" />;
    if (isVerified && !hasOpenRequest && !upgrading) {
      return (
        <div className="space-y-4">
          <VerifiedCard verifiedUntil={profile?.verified_until ?? null} />
          <GoldOfferCard settings={settings} onStart={() => setUpgrading(true)} />
        </div>
      );
    }
    // From here on a verified seller is going through the gold upgrade.
    const offerCard = isVerified ? <GoldOfferCard settings={settings} /> : <BenefitsCard settings={settings} />;

    if (status === "pending_review" && request) {
      return (
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-500/15 flex items-center justify-center flex-shrink-0">
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold">
                    {isVerified ? t("vendorFees.goldUnderReview", "Gold upgrade under review") : t("vendorFees.underReview", "Under review")}
                  </h2>
                  <Badge variant="secondary">{t("vendorFees.paid", "Paid")}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Our team is checking your details. We'll notify you as soon as they are reviewed, usually within 1–2 working days.
                </p>
              </div>
            </div>
            <RequestSummary request={request} />
          </CardContent>
        </Card>
      );
    }

    if (status === "awaiting_payment" && request && !editing) {
      return (
        <div className="space-y-4">
          {offerCard}
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <CreditCard className="h-5 w-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h2 className="font-semibold">{t("vendorFees.awaitingPayment", "Awaiting payment")}</h2>
                  <p className="text-sm text-muted-foreground">
                    Your details are saved. Pay the {isVerified ? "gold" : "verification"} fee to send them for review.
                  </p>
                </div>
              </div>
              <RequestSummary request={request} />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button size="lg" className="gap-2" onClick={handlePay} disabled={pay.isPending || isConfirming}>
                  {pay.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  {pay.isPending
                    ? t("vendorFees.processing", "Please wait...")
                    : t("vendorFees.payAmount", "Pay {{amount}}", { amount: formatNaira(fee) })}
                </Button>
                <Button size="lg" variant="outline" className="gap-2" onClick={() => setEditing(true)} disabled={pay.isPending}>
                  <Pencil className="h-4 w-4" />
                  {t("vendorFees.editDetails", "Edit details")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {status === "rejected" && request ? (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertTitle>{t("vendorFees.needsChanges", "Your details need changes")}</AlertTitle>
            <AlertDescription className="space-y-1">
              <p>{request.admin_note || "Please check your details and try again."}</p>
              <p className="text-xs opacity-90">Fix the details below and resubmit. You don't need to pay again.</p>
            </AlertDescription>
          </Alert>
        ) : (
          offerCard
        )}
        {status === "approved" && !isVerified && (
          <Alert>
            <Clock className="h-4 w-4" />
            <AlertTitle>{t("vendorFees.verificationExpired", "Your verification has expired")}</AlertTitle>
            <AlertDescription>Renew it to get your badge back.</AlertDescription>
          </Alert>
        )}
        {renderForm()}
      </div>
    );
  };

  return (
    <VendorLayout title={t("vendorFees.verificationTitle", "Verification")}>
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
            <AlertTitle>{t("vendorFees.loadFailed", "Could not load verification")}</AlertTitle>
            <AlertDescription className="space-y-2">
              <p>{error instanceof Error ? error.message : "Please try again."}</p>
              <Button size="sm" variant="outline" onClick={refresh}>
                {t("vendorFees.retry", "Try again")}
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading || !settings ? (
          <div className="space-y-4">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        ) : (
          renderStatus()
        )}
      </div>
    </VendorLayout>
  );
}
