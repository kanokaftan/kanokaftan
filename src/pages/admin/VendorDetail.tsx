import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict } from "date-fns";
import {
  BadgeCheck, Building2, Calendar, ChevronLeft, ExternalLink, Mail, MapPin, MessageCircle, Package, Phone, ShoppingBag,
  Star, Store, Users, Wallet,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminChatList } from "@/components/admin/oversight/AdminChatList";
import { BadgeTierControl, TierChip } from "@/components/admin/BadgeTierControl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { badgeTierOf } from "@/hooks/useAdminVendors";
import {
  usePersonProfile, useVendorOrders, useVendorOverview, useVendorPayoutsAdmin, useVendorProductsAdmin,
} from "@/hooks/useAdminOversight";
import { payoutStatusLabels, type PayoutStatus } from "@/hooks/usePayouts";
import { cn } from "@/lib/utils";

type Tab = "overview" | "chats" | "products" | "orders" | "payouts";
const TABS: { value: Tab; label: string }[] = [
  { value: "overview", label: "Overview" },
  { value: "chats", label: "Chats" },
  { value: "products", label: "Products" },
  { value: "orders", label: "Orders" },
  { value: "payouts", label: "Payouts" },
];

const naira = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);
const count = (n: number) => new Intl.NumberFormat("en-NG").format(n);
const human = (s: string) => s.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());

function Stat({ icon: Icon, label, value, sub }: { icon: typeof Package; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function InfoRow({ icon: Icon, children }: { icon: typeof Mail; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 border-b border-border/60 py-2.5 text-sm last:border-b-0">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1 break-words">{children}</div>
    </div>
  );
}

function OverviewTab({ vendorId }: { vendorId: string }) {
  const queryClient = useQueryClient();
  const { data: profile } = usePersonProfile(vendorId);
  const { data: o, isLoading, error } = useVendorOverview(vendorId);
  if (isLoading || !profile) return <Skeleton className="h-64 rounded-2xl" />;
  if (error || !o) return <p className="text-sm text-destructive">{(error as Error)?.message ?? "Could not load"}</p>;
  const address = profile.store_address;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat icon={Wallet} label="Sales (paid)" value={naira(o.gross_sales)} sub={`${count(o.items_sold)} items · ${count(o.paid_orders)} orders`} />
        <Stat icon={Building2} label="Paid out" value={naira(o.paid_out)} sub={`${naira(o.payout_pending)} still to pay`} />
        <Stat icon={Package} label="Products" value={count(o.active_products)} sub={`${o.products} total · ${o.out_of_stock} sold out`} />
        <Stat icon={MessageCircle} label="Chats" value={count(o.chats)} sub={`with ${count(o.chat_customers)} ${o.chat_customers === 1 ? "customer" : "customers"}`} />
        <Stat icon={Users} label="Visitors (30 days)" value={count(o.visitors_30d)} sub={`${count(o.views_30d)} shop & product views`} />
        <Stat icon={Star} label="Rating" value={o.rating ? `${o.rating}/5` : "–"} sub={`${count(o.reviews)} reviews`} />
        <Stat icon={Users} label="Followers" value={count(o.followers)} />
        <Stat icon={Wallet} label="Commission earned" value={naira(o.commission_earned)} />
      </div>

      <Card>
        <CardContent className="p-4">
          <p className="mb-1 text-sm font-semibold">Contact & shop</p>
          <InfoRow icon={Mail}><a href={`mailto:${profile.email}`} className="hover:underline">{profile.email}</a></InfoRow>
          <InfoRow icon={Phone}>
            {profile.phone || o.application?.phone ? (
              <a href={`tel:${profile.phone || o.application?.phone}`} className="hover:underline">{profile.phone || o.application?.phone}</a>
            ) : "No phone number"}
          </InfoRow>
          <InfoRow icon={MapPin}>
            {[address?.street, address?.city || o.application?.city, address?.state || o.application?.state].filter(Boolean).join(", ") || "No address yet"}
          </InfoRow>
          <InfoRow icon={Calendar}>
            Joined {format(new Date(profile.created_at), "d MMMM yyyy")}
            {o.application?.reviewed_at && ` · approved ${format(new Date(o.application.reviewed_at), "d MMM yyyy")}`}
          </InfoRow>
          {o.last_order_at && (
            <InfoRow icon={ShoppingBag}>Last order {formatDistanceToNowStrict(new Date(o.last_order_at), { addSuffix: true })}</InfoRow>
          )}
          {(profile.store_description || o.application?.description) && (
            <InfoRow icon={Store}><span className="text-muted-foreground">{profile.store_description || o.application?.description}</span></InfoRow>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="mb-1 text-sm font-semibold">Payout bank account</p>
          {o.payout_account ? (
            <InfoRow icon={Building2}>
              <span className="font-medium">{o.payout_account.account_name}</span>
              <span className="block text-muted-foreground">{o.payout_account.bank_name} · ****{o.payout_account.account_number_last4}</span>
            </InfoRow>
          ) : (
            <p className="text-sm text-amber-700 dark:text-amber-400">No bank account added yet, so payouts are waiting.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-2 p-4">
          <p className="text-sm font-semibold">Verification badge</p>
          <p className="text-xs text-muted-foreground">Changes apply right away and the seller is notified. Gold shops are listed first.</p>
          <BadgeTierControl
            vendorId={vendorId}
            tier={badgeTierOf(profile)}
            className="flex w-full"
            onChanged={() => queryClient.invalidateQueries({ queryKey: ["admin-person", vendorId] })}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function ProductsTab({ vendorId }: { vendorId: string }) {
  const { data: products = [], isLoading, error } = useVendorProductsAdmin(vendorId);
  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!products.length) return <p className="py-10 text-center text-sm text-muted-foreground">No products yet</p>;
  return (
    <ul className="divide-y">
      {products.map((p) => {
        const images = (p.product_images ?? []) as { url: string; is_primary: boolean }[];
        const image = images.find((i) => i.is_primary)?.url ?? images[0]?.url;
        return (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
              {image && <img src={image} alt="" className="h-full w-full object-cover" loading="lazy" />}
            </div>
            <div className="min-w-0 flex-1">
              <Link to={`/products/${p.slug}`} className="block truncate text-sm font-medium hover:underline">{p.name}</Link>
              <p className="text-xs text-muted-foreground">{naira(Number(p.price))} · {p.stock_quantity} in stock</p>
            </div>
            {!p.is_active ? <Badge variant="outline">Hidden</Badge> : p.stock_quantity <= 0 ? <Badge variant="secondary">Sold out</Badge> : null}
            <Button asChild size="sm" variant="ghost" className="h-8 px-2 text-xs">
              <Link to={`/admin/products/${p.id}/edit`}>Edit</Link>
            </Button>
          </li>
        );
      })}
    </ul>
  );
}

function OrdersTab({ vendorId }: { vendorId: string }) {
  const { data: orders = [], isLoading, error } = useVendorOrders(vendorId);
  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!orders.length) return <p className="py-10 text-center text-sm text-muted-foreground">No orders yet</p>;
  return (
    <ul className="divide-y">
      {orders.map((o) => (
        <li key={o.order_id}>
          <Link to={`/admin/orders?search=${o.order_id.slice(0, 8)}`} className="flex items-center gap-3 py-2.5 hover:bg-muted/40">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">#{o.order_id.slice(0, 8)} · {o.customer_name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(o.created_at), "d MMM yyyy, HH:mm")} · {o.items} item{o.items === 1 ? "" : "s"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm font-semibold tabular-nums">{naira(o.total)}</p>
              <p className={cn("text-[11px]", o.payment_status === "paid" ? "text-green-700 dark:text-green-400" : "text-muted-foreground")}>
                {human(o.payment_status)} · {human(o.status)}
              </p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PayoutsTab({ vendorId }: { vendorId: string }) {
  const { data: payouts = [], isLoading, error } = useVendorPayoutsAdmin(vendorId);
  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;
  if (error) return <p className="text-sm text-destructive">{(error as Error).message}</p>;
  if (!payouts.length) return <p className="py-10 text-center text-sm text-muted-foreground">No payouts yet</p>;
  return (
    <ul className="divide-y">
      {payouts.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-2.5">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Order #{p.order_id.slice(0, 8)} · part {p.tranche} of 2</p>
            <p className="truncate text-xs text-muted-foreground">
              {p.paid_at ? `Paid ${format(new Date(p.paid_at), "d MMM yyyy")}` : format(new Date(p.created_at), "d MMM yyyy")}
              {p.failure_reason ? ` · ${p.failure_reason}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold tabular-nums">{naira(Number(p.amount))}</p>
            <p className="text-[11px] text-muted-foreground">{payoutStatusLabels[p.status as PayoutStatus] ?? p.status}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Everything about one seller: numbers, contact, bank, badge, chats with customers, products, orders and payouts. */
export default function AdminVendorDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get("tab") as Tab | null;
  const tab: Tab = TABS.some((t) => t.value === tabParam) ? tabParam! : "overview";
  const { data: profile, isLoading } = usePersonProfile(id);
  const name = profile?.store_name || profile?.full_name || "Seller";

  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === "overview") next.delete("tab");
    else next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  return (
    <AdminLayout title="Seller">
      <div className="mx-auto max-w-3xl space-y-4 pb-20 md:pb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="-ml-2 h-9 w-9 shrink-0 rounded-full" onClick={() => navigate("/admin/vendors")} aria-label="Back to sellers">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          {isLoading ? (
            <Skeleton className="h-12 flex-1 rounded-xl" />
          ) : !profile ? (
            <p className="text-sm text-muted-foreground">Seller not found</p>
          ) : (
            <>
              <Avatar className="h-12 w-12 border">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback>{name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <h2 className="line-clamp-2 text-lg font-bold leading-tight">{name}</h2>
                  <TierChip tier={badgeTierOf(profile)} />
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {profile.full_name}{profile.is_verified && <BadgeCheck className="ml-1 inline h-3 w-3 text-[#1D9BF0]" aria-label="verified" />}
                </p>
              </div>
              {profile.store_slug && (
                <Button asChild size="sm" variant="outline" className="h-9 w-9 shrink-0 rounded-full p-0 sm:w-auto sm:px-3">
                  <Link to={`/shop/${profile.store_slug}`} aria-label="Open shop">
                    <ExternalLink className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Shop</span>
                  </Link>
                </Button>
              )}
            </>
          )}
        </div>

        {id && (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="w-full justify-start overflow-x-auto rounded-full">
              {TABS.map((t) => (
                <TabsTrigger key={t.value} value={t.value} className="rounded-full px-3 text-xs sm:text-sm">{t.label}</TabsTrigger>
              ))}
            </TabsList>
            <TabsContent value="overview" className="mt-4"><OverviewTab vendorId={id} /></TabsContent>
            <TabsContent value="chats" className="mt-4">
              <p className="mb-2 text-xs text-muted-foreground">This seller's chats with customers. Tap one to read it (read only).</p>
              <AdminChatList vendorId={id} />
            </TabsContent>
            <TabsContent value="products" className="mt-4"><ProductsTab vendorId={id} /></TabsContent>
            <TabsContent value="orders" className="mt-4"><OrdersTab vendorId={id} /></TabsContent>
            <TabsContent value="payouts" className="mt-4"><PayoutsTab vendorId={id} /></TabsContent>
          </Tabs>
        )}
      </div>
    </AdminLayout>
  );
}
