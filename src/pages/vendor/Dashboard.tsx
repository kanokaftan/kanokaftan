import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { formatDistanceToNowStrict } from "date-fns";
import {
  AlertTriangle, BadgeCheck, ChevronRight, CircleFadingPlus, Clock, Heart, Megaphone, MessageCircle, MessageSquareReply, Package, PackageX, Plus,
  Share2, Star, Truck, UserCheck, Wallet, type LucideIcon,
} from "lucide-react";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { PayoutsCard } from "@/components/vendor/PayoutsCard";
import { ShopSetupChecklist } from "@/components/vendor/ShopSetupChecklist";
import { ShopStatsCard } from "@/components/vendor/ShopStatsCard";
import { useEarningRates } from "@/components/vendor/HowYouEarn";
import { Skeleton } from "@/components/ui/skeleton";
import { useVendorProducts } from "@/hooks/useVendorProducts";
import { useVendorOrders } from "@/hooks/useVendorOrders";
import { useConversations } from "@/hooks/useChat";
import { useMyShop } from "@/hooks/useMyShop";
import { useMyFanSummary, type FanSummary } from "@/hooks/useShopFans";
import { formatNaira, useVerification } from "@/hooks/useVerification";
import { cn } from "@/lib/utils";

/** Fewer pieces than this left counts as "low stock". */
const LOW_STOCK = 5;
/** Paid orders the seller still has to pack and send. */
const TO_SHIP = new Set(["payment_confirmed", "processing"]);
const RECENT_ORDERS = 3;

const naira = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount);

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const STATUS_LABELS: Record<string, string> = {
  payment_confirmed: "To pack",
  processing: "Packing",
  ready_for_pickup: "Ready for pickup",
  shipped: "Shipped",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

interface Task {
  icon: LucideIcon;
  label: string;
  count: number;
  to: string;
  tone: "red" | "amber" | "blue";
}

const TONES: Record<Task["tone"], string> = {
  red: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  amber: "bg-muted text-foreground",
  blue: "bg-muted text-foreground",
};

function QuickAction({ icon: Icon, label, to, onClick }: { icon: LucideIcon; label: string; to?: string; onClick?: () => void }) {
  const body = (
    <>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm transition-transform group-active:scale-90">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="text-center text-[11px] font-medium leading-tight">{label}</span>
    </>
  );
  const className = "group flex flex-col items-center gap-1.5";
  return to ? <Link to={to} className={className}>{body}</Link> : <button type="button" onClick={onClick} className={className}>{body}</button>;
}

/** Verification or promotion offer, depending on where the seller is. */
function GrowCard({ vendorId }: { vendorId: string | null }) {
  const { request, settings, isVerified, isLoading } = useVerification(vendorId);
  if (isLoading || !settings) return null;
  const underReview = request?.status === "pending_review";
  const to = isVerified ? "/vendor/promote" : "/vendor/verification";
  const Icon = isVerified ? Megaphone : underReview ? Clock : BadgeCheck;
  const title = isVerified ? "Promote your products" : underReview ? "Verification under review" : "Get the verified badge";
  const hint = isVerified
    ? `Feature a product on the homepage from ${formatNaira(settings.featured_product_weekly_fee)}/week`
    : underReview
      ? "We'll notify you once our team has checked your details"
      : "Buyers trust verified shops more, and they're listed higher";
  return (
    <Link to={to} className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 active:bg-muted/60">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/** Followers, likes and rating at a glance; each opens the full list. */
function FansRow({ summary }: { summary: FanSummary | undefined }) {
  const tiles = [
    { icon: UserCheck, label: "Followers", value: summary?.followers, week: summary?.followers_week, to: "/vendor/fans", tint: "text-foreground" },
    { icon: Heart, label: "Likes", value: summary?.likes, week: summary?.likes_week, to: "/vendor/fans?tab=likes", tint: "text-foreground" },
    {
      icon: Star,
      label: summary?.reviews ? `${summary.reviews} review${summary.reviews === 1 ? "" : "s"}` : "Reviews",
      value: summary?.rating != null ? summary.rating.toFixed(1) : summary ? "–" : undefined,
      week: 0,
      to: "/vendor/reviews",
      tint: "text-foreground",
    },
  ];
  return (
    <section className="grid grid-cols-3 gap-2">
      {tiles.map((t) => (
        <Link key={t.to} to={t.to} className="rounded-2xl border bg-card px-3 py-2.5 active:bg-muted/60">
          <t.icon className={cn("h-4 w-4", t.tint, t.icon === Heart || t.icon === Star ? "fill-current" : "")} aria-hidden="true" />
          <p className="mt-1 text-lg font-semibold tabular-nums">{t.value ?? "…"}</p>
          <p className="truncate text-[11px] text-muted-foreground">
            {t.label}{t.week ? <span className="font-medium text-foreground"> +{t.week}</span> : null}
          </p>
        </Link>
      ))}
    </section>
  );
}

/** One-line reminder of how sellers earn, opening the full explanation. */
function EarnCard() {
  const { t } = useTranslation();
  const { data: rates } = useEarningRates();
  return (
    <Link to="/vendor/earnings" className="flex items-center gap-3 rounded-2xl border bg-card p-3.5 active:bg-muted/60">
      <Wallet className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{t("seller.earn.pageTitle")}</span>
        <span className="block text-xs text-muted-foreground">
          {t("seller.earn.summary", { app: 100 - (rates?.checkout ?? 0), chat: 100 - (rates?.chat ?? 10) })}
        </span>
      </span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

/** Seller home: what needs doing now, one-tap actions, then how the shop is doing. */
export default function VendorDashboard() {
  const { userId } = useVendorAuth();
  const { data: products, isLoading: productsLoading } = useVendorProducts(userId);
  const { orders, isLoading: ordersLoading } = useVendorOrders(userId);
  const { conversations } = useConversations();
  const { name, share } = useMyShop(userId);
  const { data: fans } = useMyFanSummary(!!userId);
  const awaitingReply = fans?.awaiting_reply ?? 0;

  const sales = (orders ?? []).reduce(
    (sum, order) => sum + order.order_items.reduce((s, item) => s + item.quantity * item.unit_price, 0),
    0,
  );
  const toShip = (orders ?? []).filter((o) => TO_SHIP.has(o.status)).length;
  const unreadChats = conversations.filter((c) => c.unread && (c.role === "vendor" || c.role === "support_user")).length;
  const soldOut = (products ?? []).filter((p) => p.stock_quantity === 0).length;
  const lowStock = (products ?? []).filter((p) => p.stock_quantity > 0 && p.stock_quantity < LOW_STOCK).length;
  const activeProducts = (products ?? []).filter((p) => p.is_active).length;

  const tasks: Task[] = [
    { icon: Truck, label: toShip === 1 ? "order to pack and send" : "orders to pack and send", count: toShip, to: "/vendor/orders", tone: "red" },
    { icon: MessageCircle, label: unreadChats === 1 ? "unread chat" : "unread chats", count: unreadChats, to: "/vendor/messages", tone: "blue" },
    { icon: MessageSquareReply, label: awaitingReply === 1 ? "review waiting for your reply" : "reviews waiting for your reply", count: awaitingReply, to: "/vendor/reviews", tone: "blue" },
    { icon: PackageX, label: soldOut === 1 ? "product sold out" : "products sold out", count: soldOut, to: "/vendor/products?filter=soldout", tone: "amber" },
    { icon: AlertTriangle, label: "running low on stock", count: lowStock, to: "/vendor/products?filter=low", tone: "amber" },
  ].filter((t) => t.count > 0) as Task[];
  const loading = productsLoading || ordersLoading;

  return (
    <VendorLayout title="Home">
      <div className="mx-auto max-w-3xl space-y-5">
        {/* Hello + headline numbers */}
        <section className="rounded-3xl bg-primary p-4 text-primary-foreground">
          <p className="text-xs text-primary-foreground/60">{greeting()}</p>
          <h2 className="truncate text-xl font-bold">{name}</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { label: "Sales", value: loading ? "…" : naira(sales) },
              { label: "Orders", value: loading ? "…" : String(orders?.length ?? 0) },
              { label: "Products", value: loading ? "…" : `${activeProducts}` },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl bg-primary-foreground/10 px-2.5 py-2">
                <p className="truncate text-base font-semibold tabular-nums">{s.value}</p>
                <p className="text-[11px] text-primary-foreground/60">{s.label}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Quick actions */}
        <section className="grid grid-cols-4 gap-2">
          <QuickAction icon={Plus} label="Add product" to="/vendor/products/new" />
          <QuickAction icon={CircleFadingPlus} label="Post story" to="/vendor/stories" />
          <QuickAction icon={Megaphone} label="Promote" to="/vendor/promote" />
          <QuickAction icon={Share2} label="Share shop" onClick={share} />
        </section>

        <FansRow summary={fans} />

        {/* What needs doing */}
        <section>
          <h3 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Needs your attention</h3>
          {loading ? (
            <Skeleton className="h-16 rounded-2xl" />
          ) : tasks.length === 0 ? (
            <p className="rounded-2xl border bg-card px-4 py-3.5 text-sm text-muted-foreground">You're all caught up. Nothing is waiting for you.</p>
          ) : (
            <ul className="overflow-hidden rounded-2xl border bg-card">
              {tasks.map((task) => (
                <li key={task.to} className="border-b border-border/60 last:border-b-0">
                  <Link to={task.to} className="flex items-center gap-3 px-3.5 py-3 active:bg-muted/60">
                    <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", TONES[task.tone])}>
                      <task.icon className="h-[18px] w-[18px]" aria-hidden="true" />
                    </span>
                    <span className="flex-1 text-[15px]"><span className="font-semibold tabular-nums">{task.count}</span> {task.label}</span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <ShopSetupChecklist vendorId={userId} />

        {/* Recent orders */}
        <section>
          <div className="mb-1.5 flex items-center justify-between px-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Recent orders</h3>
            <Link to="/vendor/orders" className="text-xs font-medium text-primary">See all</Link>
          </div>
          {ordersLoading ? (
            <Skeleton className="h-28 rounded-2xl" />
          ) : !orders?.length ? (
            <div className="rounded-2xl border bg-card px-4 py-5 text-center text-sm text-muted-foreground">
              <Package className="mx-auto mb-2 h-6 w-6 opacity-50" />
              No orders yet. Share your shop link to bring in buyers.
            </div>
          ) : (
            <ul className="overflow-hidden rounded-2xl border bg-card">
              {orders.slice(0, RECENT_ORDERS).map((order) => {
                const items = order.order_items.reduce((n, i) => n + i.quantity, 0);
                const amount = order.order_items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
                const waiting = TO_SHIP.has(order.status);
                return (
                  <li key={order.id} className="border-b border-border/60 last:border-b-0">
                    <Link to="/vendor/orders" className="flex items-center gap-3 px-3.5 py-3 active:bg-muted/60">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[15px] font-medium">
                          {order.shipping_address?.full_name || order.customer?.full_name || "Customer"}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {items} item{items === 1 ? "" : "s"} · {formatDistanceToNowStrict(new Date(order.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-semibold tabular-nums">{naira(amount)}</p>
                        <p className={cn("text-[11px]", waiting ? "font-semibold text-red-600" : "text-muted-foreground")}>
                          {STATUS_LABELS[order.status] ?? order.status}
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <ShopStatsCard />

        <EarnCard />

        {userId && <PayoutsCard vendorId={userId} />}

        <GrowCard vendorId={userId} />
      </div>
    </VendorLayout>
  );
}
