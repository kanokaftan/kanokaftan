import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import {
  BadgeCheck,
  Building2,
  CalendarClock,
  Check,
  ExternalLink,
  FileText,
  IdCard,
  Loader2,
  MapPin,
  Phone,
  RefreshCw,
  ShieldCheck,
  StickyNote,
  User,
  Wallet,
  X,
} from "lucide-react";
import { AdminPagination } from "@/components/admin/AdminPagination";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  AdminVerificationRequest,
  VerificationStatusFilter,
  useAdminVerificationRequests,
  usePendingVerificationCount,
  useReviewVerification,
  useVerificationDocumentUrl,
} from "@/hooks/useAdminVerification";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";

const PAGE_SIZE = 15;
const MAX_REJECT_NOTE_LENGTH = 500;
const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"];

const STATUS_FILTERS: { value: VerificationStatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending_review", label: "Awaiting review" },
  { value: "awaiting_payment", label: "Not paid yet" },
  { value: "rejected", label: "Rejected" },
  { value: "approved", label: "Approved" },
];

const STATUS_META: Record<string, { label: string; className: string }> = {
  pending_review: { label: "Awaiting review", className: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/15 dark:text-amber-400" },
  awaiting_payment: { label: "Not paid yet", className: "bg-muted text-muted-foreground border-border" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-800 border-red-200 dark:bg-red-500/15 dark:text-red-400" },
  approved: { label: "Approved", className: "bg-green-100 text-green-800 border-green-200 dark:bg-green-500/15 dark:text-green-400" },
};

const ID_TYPE_LABELS: Record<string, string> = {
  nin: "NIN",
  drivers_licence: "Driver's licence",
  voters_card: "Voter's card",
  passport: "International passport",
  cac: "CAC registration",
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);

const formatDateTime = (value: string | null | undefined) =>
  value ? format(new Date(value), "MMM d, yyyy · HH:mm") : "—";

function isImagePath(path: string | null | undefined) {
  const ext = path?.split(".").pop()?.toLowerCase();
  return !!ext && IMAGE_EXTENSIONS.includes(ext);
}

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("whitespace-nowrap", meta.className)}>
      {meta.label}
    </Badge>
  );
}

function DetailRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="mt-0.5 text-muted-foreground">{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="text-sm font-medium break-words">{children}</div>
      </div>
    </div>
  );
}

function IdDocument({ path, enabled }: { path: string | null; enabled: boolean }) {
  const { data: url, isLoading, error, refetch, isFetching } = useVerificationDocumentUrl(path, enabled);

  if (!path) {
    return <p className="text-sm text-muted-foreground">No ID document was uploaded.</p>;
  }

  if (isLoading) {
    return <Skeleton className="h-40 w-full rounded-lg" />;
  }

  if (error || !url) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3">
        <p className="text-sm text-destructive">
          {error instanceof Error ? error.message : "Could not load the document."}
        </p>
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={cn("h-3.5 w-3.5 mr-1", isFetching && "animate-spin")} />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {isImagePath(path) ? (
        <a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg border bg-muted">
          <img src={url} alt="ID document" className="max-h-72 w-full object-contain" />
        </a>
      ) : (
        <div className="flex items-center gap-2 rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
          <FileText className="h-4 w-4" />
          PDF document
        </div>
      )}
      <Button variant="outline" size="sm" className="w-full gap-2" asChild>
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" />
          View ID document
        </a>
      </Button>
      <p className="text-[11px] text-muted-foreground">The link expires after a few minutes.</p>
    </div>
  );
}

function ReviewDialog({
  request,
  open,
  onOpenChange,
}: {
  request: AdminVerificationRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const review = useReviewVerification();
  const [rejecting, setRejecting] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setRejecting(false);
      setNote("");
    }
  }, [open, request?.id]);

  if (!request) return null;

  const vendor = request.vendor;
  const storeName = vendor?.store_name || request.business_name;
  const canReview = request.status === "pending_review";

  const submit = async (approve: boolean) => {
    try {
      await review.mutateAsync({ requestId: request.id, approve, note: approve ? undefined : note });
      toast.success(approve
        ? `${storeName} is now ${request.tier === "gold" ? "gold" : "verified"}`
        : "Sent back to the seller with your note");
      onOpenChange(false);
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not save the review");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12 border">
              <AvatarImage src={vendor?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">{storeName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 text-left">
              <DialogTitle className="flex items-center gap-1.5 truncate">
                {storeName}
                {vendor?.is_verified && <VerifiedBadge tier={vendor.verification_tier} />}
                {request.tier === "gold" && <GoldChip />}
              </DialogTitle>
              <DialogDescription className="truncate">{vendor?.email || "No email on file"}</DialogDescription>
            </div>
          </div>
          <div className="pt-2">
            <StatusBadge status={request.status} />
          </div>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <DetailRow icon={<Building2 className="h-4 w-4" />} label="Business name">{request.business_name}</DetailRow>
            <DetailRow icon={<Phone className="h-4 w-4" />} label="Contact phone">
              <a href={`tel:${request.contact_phone}`} className="text-primary">{request.contact_phone}</a>
            </DetailRow>
            <DetailRow icon={<MapPin className="h-4 w-4" />} label="Business address">{request.business_address}</DetailRow>
            <DetailRow icon={<IdCard className="h-4 w-4" />} label={ID_TYPE_LABELS[request.id_type] ?? request.id_type}>
              <span className="font-mono">{request.id_number}</span>
            </DetailRow>
            <DetailRow icon={<Wallet className="h-4 w-4" />} label="Amount paid">
              {request.paid_at ? (Number(request.amount) === 0 ? "Free" : formatCurrency(Number(request.amount))) : "Not paid"}
            </DetailRow>
            <DetailRow icon={<CalendarClock className="h-4 w-4" />} label="Paid at">{formatDateTime(request.paid_at)}</DetailRow>
            {vendor?.full_name && (
              <DetailRow icon={<User className="h-4 w-4" />} label="Account holder">{vendor.full_name}</DetailRow>
            )}
            <DetailRow icon={<CalendarClock className="h-4 w-4" />} label="Submitted">{formatDateTime(request.created_at)}</DetailRow>
          </div>

          {request.notes && (
            <DetailRow icon={<StickyNote className="h-4 w-4" />} label="Seller's note">
              <span className="font-normal whitespace-pre-line">{request.notes}</span>
            </DetailRow>
          )}

          {request.admin_note && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="text-xs font-medium text-destructive mb-1">Reason given to seller</p>
              <p className="whitespace-pre-line">{request.admin_note}</p>
            </div>
          )}

          {request.reviewed_at && (
            <p className="text-xs text-muted-foreground">Reviewed {formatDateTime(request.reviewed_at)}</p>
          )}

          <Separator />

          <div className="space-y-2">
            <p className="text-sm font-semibold flex items-center gap-2">
              <IdCard className="h-4 w-4 text-primary" />
              ID document
            </p>
            <IdDocument path={request.id_document_path} enabled={open} />
          </div>

          {canReview && rejecting && (
            <div className="space-y-2">
              <Label htmlFor="reject-note">What should the seller fix?</Label>
              <Textarea
                id="reject-note"
                value={note}
                onChange={(e) => setNote(e.target.value.slice(0, MAX_REJECT_NOTE_LENGTH))}
                placeholder="e.g. The ID photo is blurry. Please upload a clear photo of the front of your NIN slip."
                rows={3}
                autoFocus
              />
              <p className="text-[11px] text-muted-foreground text-right">
                {note.length}/{MAX_REJECT_NOTE_LENGTH} · The seller sees this and can resubmit without paying again.
              </p>
            </div>
          )}
        </div>

        {canReview && (
          <DialogFooter className="gap-2 sm:gap-2">
            {rejecting ? (
              <>
                <Button variant="ghost" onClick={() => setRejecting(false)} disabled={review.isPending}>
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => submit(false)}
                  disabled={review.isPending || !note.trim()}
                  className="gap-1"
                >
                  {review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                  Send back to seller
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setRejecting(true)} disabled={review.isPending} className="gap-1">
                  <X className="h-4 w-4" />
                  Reject
                </Button>
                <Button onClick={() => submit(true)} disabled={review.isPending} className="gap-1">
                  {review.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Approve
                </Button>
              </>
            )}
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

function GoldChip() {
  return (
    <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
      Gold upgrade
    </span>
  );
}

function RequestCard({ request, onOpen }: { request: AdminVerificationRequest; onOpen: () => void }) {
  const storeName = request.vendor?.store_name || request.business_name;
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className={cn(
        "cursor-pointer transition-shadow hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        request.status === "pending_review" && "border-amber-300 dark:border-amber-500/40",
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-11 w-11 border">
            <AvatarImage src={request.vendor?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/10 text-primary">{storeName.charAt(0)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 font-semibold">
                  <span className="truncate">{storeName}</span>
                  {request.tier === "gold" && <GoldChip />}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {request.business_name}
                  {request.vendor?.email ? ` · ${request.vendor.email}` : ""}
                </p>
              </div>
              <StatusBadge status={request.status} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <IdCard className="h-3.5 w-3.5" />
                {ID_TYPE_LABELS[request.id_type] ?? request.id_type}
              </span>
              <span className="flex items-center gap-1">
                <Wallet className="h-3.5 w-3.5" />
                {request.paid_at
                  ? Number(request.amount) === 0 ? "Free" : formatCurrency(Number(request.amount))
                  : "Not paid"}
              </span>
              <span className="flex items-center gap-1">
                <CalendarClock className="h-3.5 w-3.5" />
                {format(new Date(request.paid_at || request.created_at), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function VerificationRequests() {
  const [status, setStatus] = useState<VerificationStatusFilter>("all");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: requests = [], isLoading, error, refetch } = useAdminVerificationRequests(status);
  const { data: pendingCount = 0 } = usePendingVerificationCount();

  useEffect(() => { setPage(1); }, [status]);

  const totalPages = Math.ceil(requests.length / PAGE_SIZE);
  const paginated = requests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  // Look up by id so the dialog shows fresh data after a review.
  const selected = requests.find((r) => r.id === selectedId) ?? null;

  return (
    <div className="space-y-4 pb-20 md:pb-6">
      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
        <CardContent className="flex items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-amber-500/20 p-2">
              <ShieldCheck className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{pendingCount}</p>
              <p className="text-xs text-muted-foreground">Awaiting review</p>
            </div>
          </div>
          {pendingCount > 0 && status !== "pending_review" && (
            <Button size="sm" variant="outline" onClick={() => setStatus("pending_review")}>
              Show them
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.value}
            type="button"
            onClick={() => setStatus(filter.value)}
            className={cn(
              "flex-shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
              status === filter.value
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
          >
            {filter.label}
            {filter.value === "pending_review" && pendingCount > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 text-[10px] font-semibold text-white">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-destructive">Could not load verification requests.</p>
            <Button size="sm" variant="outline" onClick={() => refetch()}>Try again</Button>
          </CardContent>
        </Card>
      ) : requests.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          {status === "pending_review" ? "Nothing to review right now." : "No verification requests yet."}
        </p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {paginated.map((request) => (
            <RequestCard key={request.id} request={request} onOpen={() => setSelectedId(request.id)} />
          ))}
        </div>
      )}

      <AdminPagination
        page={page}
        totalPages={totalPages}
        totalItems={requests.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />

      <ReviewDialog
        request={selected}
        open={!!selected}
        onOpenChange={(open) => !open && setSelectedId(null)}
      />
    </div>
  );
}
