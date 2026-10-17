import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { TodayTrafficCard } from "@/components/admin/TodayTrafficCard";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { useAdminOverview, useRecentAdminOrders } from "@/hooks/useAdminOverview";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useChat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageCircle, Users, Package, ShoppingCart, Store, Wallet, ShieldCheck,
  ArrowRight, Clock, CheckCircle, XCircle, Plus, BadgeCheck, Truck, Megaphone, UserPlus,
  PartyPopper, Boxes, Scale, AlertTriangle, Flag, RotateCcw, ChevronRight, type LucideIcon,
} from "lucide-react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { withoutLeadingEmoji } from "@/lib/text";

const formatTime = (date: string | null) => {
  if (!date) return "";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 }).format(amount);

const formatCompactCurrency = (amount: number) => {
  if (amount >= 1_000_000) return `₦${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `₦${(amount / 1_000).toFixed(1)}K`;
  return formatCurrency(amount);
};

/** Short order reference, the same one shown to customers ("Order #8de98f3e"). */
const orderRef = (id: string) => `#${id.slice(0, 8)}`;

function shippingName(address: unknown): string | null {
  const name = (address as { full_name?: unknown } | null)?.full_name;
  return typeof name === "string" && name.trim() ? name.trim() : null;
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

const statusColor = (status: string) => {
  switch (status) {
    case "pending":
    case "pending_payment": return "bg-yellow-100 text-yellow-700";
    case "payment_confirmed":
    case "processing": return "bg-blue-100 text-blue-700";
    case "shipped":
    case "out_for_delivery": return "bg-purple-100 text-purple-700";
    case "delivered":
    case "completed": return "bg-green-100 text-green-700";
    case "cancelled": return "bg-red-100 text-red-700";
    default: return "bg-muted text-muted-foreground";
  }
};

export default function AdminDashboard() {
  const { data: overview, isLoading: statsLoading, error: overviewError } = useAdminOverview();
  const { data: analytics, isLoading: analyticsLoading } = useAdminAnalytics(30);
  const { data: orders = [], isLoading: ordersLoading } = useRecentAdminOrders();
  const { conversations, isLoading: chatsLoading } = useConversations();
  const { user } = useAuth();
  const navigate = useNavigate();
  const adminName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  // Admins see every support conversation through list_inbox.
  const supportChats = conversations.filter((c) => c.kind === "support");
  const waitingChats = supportChats.filter((c) => c.unread).length;
  const recentChats = supportChats.slice(0, 5);
  const recentOrders = orders;
  const o = overview;

  // Things waiting on the admin, most urgent first; only the ones with something to do are shown.
  const attention: { label: string; plural: string; hint: string; count: number; href: string; icon: LucideIcon; urgent?: boolean }[] = [
    { label: "refund to make", plural: "refunds to make", hint: "Paid after the buyer cancelled", count: o?.refunds_needed ?? 0, href: "/admin/notifications", icon: RotateCcw, urgent: true },
    { label: "open dispute", plural: "open disputes", hint: "Buyer reported a problem", count: o?.open_disputes ?? 0, href: "/admin/orders?filter=disputed", icon: Scale, urgent: true },
    { label: "failed payout", plural: "failed payouts", hint: "Seller wasn't paid; retry in Finance", count: o?.failed_payouts ?? 0, href: "/admin/finance", icon: Wallet, urgent: true },
    { label: "combined order to collect", plural: "combined orders to collect", hint: "All sellers packed: send one rider", count: o?.combined_ready ?? 0, href: "/admin/shipments", icon: Boxes },
    { label: "support chat waiting", plural: "support chats waiting", hint: "Unread messages", count: waitingChats, href: "/admin/messages", icon: MessageCircle },
    { label: "paid order being prepared", plural: "paid orders being prepared", hint: "Sellers are packing", count: o?.orders_to_prepare ?? 0, href: "/admin/orders?filter=to_prepare", icon: ShoppingCart },
    { label: "seller application", plural: "seller applications", hint: "Approve or decline", count: o?.seller_applications ?? 0, href: "/admin/vendors?tab=applications", icon: UserPlus },
    { label: "verification request", plural: "verification requests", hint: "Check documents", count: o?.verification_reviews ?? 0, href: "/admin/vendors?tab=verification", icon: BadgeCheck },
    { label: "ambassador application", plural: "ambassador applications", hint: "Approve or decline", count: o?.ambassador_applications ?? 0, href: "/admin/ambassadors", icon: UserPlus },
    { label: "report to review", plural: "reports to review", hint: "Reported users or stories", count: o?.open_reports ?? 0, href: "/admin/moderation", icon: Flag },
    { label: "app error", plural: "app errors", hint: "Crashes people hit", count: o?.app_errors ?? 0, href: "/admin/errors", icon: AlertTriangle },
  ].filter((item) => item.count > 0);

  const revenueChartData = (analytics?.dailyRevenue || []).slice(-14).map((d) => ({
    date: format(new Date(d.date), "MMM dd"),
    revenue: d.revenue,
  }));

  const statCards = [
    {
      label: "Chats Waiting",
      value: chatsLoading ? null : waitingChats,
      icon: MessageCircle,
      href: "/admin/messages",
      urgent: waitingChats > 0,
    },
    {
      label: "Being prepared",
      value: statsLoading ? null : o?.orders_to_prepare ?? 0,
      icon: ShoppingCart,
      href: "/admin/orders?filter=to_prepare",
      urgent: (o?.orders_to_prepare ?? 0) > 0,
    },
    {
      label: "In Transit",
      value: statsLoading ? null : o?.in_transit ?? 0,
      icon: Truck,
      href: "/admin/orders?filter=in_transit",
      urgent: false,
    },
    {
      label: "Sellers",
      value: statsLoading ? null : o?.sellers ?? 0,
      sub: o ? `${o.verified_sellers} verified` : undefined,
      icon: Store,
      href: "/admin/vendors",
      urgent: false,
    },
    {
      label: "Customers",
      value: statsLoading ? null : o?.customers ?? 0,
      icon: Users,
      href: "/admin/users",
      urgent: false,
    },
    {
      label: "Products",
      value: statsLoading ? null : o?.products ?? 0,
      sub: o ? `${o.live_products} live` : undefined,
      icon: Package,
      href: "/admin/products",
      urgent: false,
    },
  ];

  const moneyCards = [
    { label: "Revenue (paid)", value: o?.revenue ?? 0, icon: Wallet, href: "/admin/finance" },
    { label: "Held in escrow", value: o?.escrow_held ?? 0, icon: ShieldCheck, href: "/admin/finance" },
  ];

  const quickActions = [
    { label: "Add Product", href: "/admin/products/new", icon: Plus },
    { label: "Messages", href: "/admin/messages", icon: MessageCircle },
    { label: "Shipments", href: "/admin/shipments", icon: Boxes },
    { label: "Sellers", href: "/admin/vendors", icon: Store },
    { label: "Announcement", href: "/admin/announcements", icon: Megaphone },
  ];

  return (
    <AdminLayout title="Home">
      <div className="space-y-5 pb-20 md:pb-6">

        {/* Greeting + what needs attention */}
        <div className="bg-primary rounded-2xl p-4 text-primary-foreground animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <p className="text-primary-foreground/60 text-xs">{format(new Date(), "EEEE, d MMMM")}</p>
          <h2 className="font-bold text-lg">{greeting()}{adminName ? `, ${adminName}` : ""}</h2>
          <p className="mt-1 text-sm text-primary-foreground/70">
            {statsLoading
              ? "Checking what needs you…"
              : overviewError
                ? "Couldn't load today's counts. Pull to refresh."
                : attention.length === 0
                  ? "All caught up. Nothing is waiting for you."
                  : `${attention.length} thing${attention.length > 1 ? "s" : ""} need${attention.length > 1 ? "" : "s"} you today.`}
          </p>
        </div>

        {/* Needs attention: one tap to the exact list */}
        {statsLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-2xl bg-muted animate-pulse" />)}
          </div>
        ) : attention.length === 0 ? (
          <div className="flex items-center gap-2 rounded-2xl border bg-card p-4 text-sm text-muted-foreground">
            <PartyPopper className="h-4 w-4 text-primary" />
            Nothing needs you right now.
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border bg-card divide-y">
            {attention.map((item) => (
              <Link key={item.label} to={item.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 active:bg-muted">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${item.urgent ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                  <item.icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {item.count} {item.count > 1 ? item.plural : item.label}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">{item.hint}</p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </div>
        )}

        <TodayTrafficCard />

        {/* Money */}
        <div className="grid grid-cols-2 gap-3">
          {moneyCards.map((card) => (
            <Link
              key={card.label}
              to={card.href}
              className="bg-card rounded-2xl p-3.5 border border-border transition-all active:scale-95 hover:border-primary/30 hover:shadow-sm"
            >
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <card.icon className="w-3.5 h-3.5" />
                {card.label}
              </p>
              {statsLoading ? (
                <div className="mt-1.5 h-7 w-20 bg-muted rounded animate-pulse" />
              ) : (
                <p className="mt-1 text-xl md:text-2xl font-bold text-foreground">{formatCompactCurrency(card.value)}</p>
              )}
            </Link>
          ))}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {statCards.map((card, index) => (
            <Link
              key={card.label}
              to={card.href}
              className="relative flex items-center gap-3 bg-card rounded-xl px-3 py-2.5 border border-border transition-all active:scale-95 animate-in fade-in-0 slide-in-from-bottom-4 duration-500 hover:border-primary/30 hover:shadow-sm"
              style={{ animationDelay: `${index * 50}ms`, animationFillMode: "both" }}
            >
              <div className="w-8 h-8 shrink-0 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
                <card.icon className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                {card.value === null ? (
                  <div className="h-5 w-10 bg-muted rounded animate-pulse" />
                ) : (
                  <p className="text-lg font-bold leading-tight text-foreground">{card.value}</p>
                )}
                <p className="truncate text-[11px] text-muted-foreground">
                  {card.label}
                  {card.sub && <span className="text-muted-foreground/80"> · {card.sub}</span>}
                </p>
              </div>
              {card.urgent && <span className="absolute right-2.5 top-2.5 w-2 h-2 bg-amber-500 rounded-full animate-pulse" />}
            </Link>
          ))}
        </div>

        {/* Revenue trend */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Revenue (14 days)</h3>
            <Link to="/admin/reports" className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
              Reports <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {analyticsLoading ? (
            <div className="h-[140px] bg-muted rounded-xl animate-pulse" />
          ) : (
            <ResponsiveContainer width="100%" height={140}>
              <AreaChart data={revenueChartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <Tooltip formatter={(value: number) => formatCurrency(value)} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#dashRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {quickActions.map((action) => (
              <Link
                key={action.label}
                to={action.href}
                className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-3 text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <action.icon className="w-4 h-4 text-primary" />
                {action.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          {/* Recent support chats */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Support Chats</h3>
              <Link to="/admin/messages" className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                See all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {chatsLoading && [1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
              {!chatsLoading && recentChats.length === 0 && (
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <MessageCircle className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No chats yet</p>
                </div>
              )}
              {recentChats.map((chat) => (
                <Link
                  key={chat.id}
                  to={`/admin/messages/${chat.id}`}
                  className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/20 hover:bg-muted/30 transition-colors"
                >
                  <Avatar className="w-9 h-9 flex-shrink-0">
                    <AvatarImage src={chat.other_party_avatar || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                      {(chat.other_party_name || "C")[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <p className={`text-sm truncate text-foreground ${chat.unread ? "font-semibold" : "font-medium"}`}>
                        {chat.other_party_name}
                        {chat.other_party_is_vendor && <span className="ml-1 text-[10px] text-muted-foreground">(vendor)</span>}
                      </p>
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">{formatTime(chat.last_message_at)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {chat.product_name ? `${chat.product_name} · ` : ""}{withoutLeadingEmoji(chat.last_message_preview) || "No messages"}
                    </p>
                  </div>
                  {chat.unread && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Orders */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-foreground">Recent Orders</h3>
              <Link to="/admin/orders" className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
                See all <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {ordersLoading && [1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
              {!ordersLoading && recentOrders.length === 0 && (
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <ShoppingCart className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No orders yet</p>
                </div>
              )}
              {recentOrders.map((order) => {
                const sellersLabel = order.seller_count > 1 ? `${order.seller_count} sellers` : "";
                const done = order.status === "completed" || order.status === "delivered";
                return (
                  <Link
                    key={order.id}
                    to={`/admin/orders?q=${order.id.slice(0, 8)}`}
                    className="flex items-center gap-3 bg-card border border-border rounded-xl p-3 hover:border-primary/20 hover:bg-muted/30 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      done ? "bg-green-100" : order.status === "cancelled" ? "bg-red-100" : "bg-yellow-100"
                    }`}>
                      {done ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : order.status === "cancelled" ? (
                        <XCircle className="w-4 h-4 text-red-600" />
                      ) : (
                        <Clock className="w-4 h-4 text-yellow-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {order.customer?.full_name || shippingName(order.shipping_address) || order.customer?.email || "Customer"}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        <span className="font-mono">{orderRef(order.id)}</span> · {formatTime(order.created_at)}
                        {sellersLabel ? ` · ${sellersLabel}` : ""}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold text-foreground">{formatCurrency(Number(order.total))}</p>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full capitalize ${statusColor(order.status)}`}>
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>

        {/* Top Vendors */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-foreground">Top Vendors (30 days)</h3>
            <Link to="/admin/vendors" className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors">
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="bg-card border border-border rounded-2xl p-2">
            {analyticsLoading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}
              </div>
            ) : !analytics?.topVendors.length ? (
              <p className="text-sm text-muted-foreground text-center py-6">No vendor sales yet</p>
            ) : (
              analytics.topVendors.slice(0, 5).map((vendor, i) => {
                return (
                  <button
                    type="button"
                    key={vendor.id}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors text-left"
                    onClick={() => navigate(`/admin/vendors/${vendor.id}`)}
                  >
                    <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}</span>
                    <Avatar className="h-9 w-9 border">
                      <AvatarImage src={vendor.avatar || undefined} />
                      <AvatarFallback>{vendor.storeName?.charAt(0) || "V"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate text-sm">{vendor.storeName}</p>
                      </div>
                      <p className="text-xs text-muted-foreground">{vendor.orderCount} items sold</p>
                    </div>
                    <span className="font-semibold text-sm">{formatCompactCurrency(vendor.totalSales)}</span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
