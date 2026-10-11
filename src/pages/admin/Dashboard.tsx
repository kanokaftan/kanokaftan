import { useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { VendorDetailModal } from "@/components/admin/VendorDetailModal";
import { TodayTrafficCard } from "@/components/admin/TodayTrafficCard";
import { useAdminStats } from "@/hooks/useAdminStats";
import { useAdminAnalytics } from "@/hooks/useAdminAnalytics";
import { useAdminOrders } from "@/hooks/useAdminOrders";
import { useAdminVendors } from "@/hooks/useAdminVendors";
import { usePendingApplicationCount } from "@/hooks/useVendorApplication";
import { usePendingVerificationCount } from "@/hooks/useAdminVerification";
import { useAuth } from "@/contexts/AuthContext";
import { useConversations } from "@/hooks/useChat";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageCircle, Users, Package, ShoppingCart, Store, Wallet, ShieldCheck,
  ArrowRight, Clock, CheckCircle, XCircle, Plus, BadgeCheck, Truck, Megaphone, UserPlus,
  PartyPopper,
} from "lucide-react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";

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
  const { data: stats, isLoading: statsLoading } = useAdminStats();
  const { data: analytics, isLoading: analyticsLoading } = useAdminAnalytics(30);
  const { orders, isLoading: ordersLoading } = useAdminOrders();
  const { vendors } = useAdminVendors();
  const { conversations, isLoading: chatsLoading } = useConversations();
  const { user } = useAuth();
  const pendingApplications = usePendingApplicationCount();
  const { data: pendingVerifications = 0 } = usePendingVerificationCount();
  const [selectedVendorId, setSelectedVendorId] = useState<string | null>(null);
  const selectedVendor = vendors.find((v) => v.id === selectedVendorId) ?? null;
  const adminName = (user?.user_metadata?.full_name as string | undefined)?.split(" ")[0];

  // Admins see every support conversation through list_inbox.
  const supportChats = conversations.filter((c) => c.kind === "support");
  const waitingChats = supportChats.filter((c) => c.unread).length;
  const recentChats = supportChats.slice(0, 5);
  const recentOrders = orders.slice(0, 5);

  // Things waiting on the admin, most urgent first; only the ones with something to do are shown.
  const attention = [
    { label: "support chat", count: waitingChats, href: "/admin/messages", icon: MessageCircle },
    { label: "paid order to fulfil", count: stats?.pendingFulfillment ?? 0, href: "/admin/orders", icon: ShoppingCart },
    { label: "seller application", count: pendingApplications, href: "/admin/vendors?tab=applications", icon: UserPlus },
    { label: "verification request", count: pendingVerifications, href: "/admin/vendors?tab=verification", icon: BadgeCheck },
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
      label: "To Fulfil",
      value: statsLoading ? null : stats?.pendingFulfillment ?? 0,
      icon: ShoppingCart,
      href: "/admin/orders",
      urgent: (stats?.pendingFulfillment ?? 0) > 0,
    },
    {
      label: "In Transit",
      value: statsLoading ? null : stats?.inTransit ?? 0,
      icon: Truck,
      href: "/admin/orders",
      urgent: false,
    },
    {
      label: "Vendors",
      value: statsLoading ? null : stats?.totalVendors ?? 0,
      sub: stats ? `${stats.verifiedVendors} verified` : undefined,
      icon: Store,
      href: "/admin/vendors",
      urgent: false,
    },
    {
      label: "Users",
      value: statsLoading ? null : stats?.totalUsers ?? 0,
      icon: Users,
      href: "/admin/users",
      urgent: false,
    },
    {
      label: "Products",
      value: statsLoading ? null : stats?.totalProducts ?? 0,
      icon: Package,
      href: "/admin/products",
      urgent: false,
    },
  ];

  const moneyCards = [
    { label: "Revenue (paid)", value: stats?.totalRevenue ?? 0, icon: Wallet, href: "/admin/finance" },
    { label: "Held in escrow", value: stats?.escrowHeld ?? 0, icon: ShieldCheck, href: "/admin/finance" },
  ];

  const quickActions = [
    { label: "Add Product", href: "/admin/products/new", icon: Plus },
    { label: "Messages", href: "/admin/messages", icon: MessageCircle },
    { label: "View Orders", href: "/admin/orders", icon: ShoppingCart },
    { label: "Vendors", href: "/admin/vendors", icon: Store },
    { label: "Announcement", href: "/admin/announcements", icon: Megaphone },
  ];

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-5 pb-20 md:pb-6">

        {/* Greeting + what needs attention */}
        <div className="bg-primary rounded-2xl p-4 text-primary-foreground animate-in fade-in-0 slide-in-from-bottom-4 duration-500">
          <p className="text-primary-foreground/60 text-xs">{format(new Date(), "EEEE, d MMMM")}</p>
          <h2 className="font-bold text-lg">{greeting()}{adminName ? `, ${adminName}` : ""}</h2>
          {attention.length === 0 ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-primary-foreground/70">
              <PartyPopper className="h-4 w-4" />
              All caught up. Nothing is waiting for you.
            </p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {attention.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary-foreground px-3 py-1.5 text-xs font-semibold text-primary transition-opacity hover:opacity-90"
                >
                  <item.icon className="h-3.5 w-3.5" />
                  {item.count} {item.label}{item.count > 1 ? "s" : ""}
                  <ArrowRight className="h-3 w-3" />
                </Link>
              ))}
            </div>
          )}
        </div>

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
                      {chat.product_name ? `${chat.product_name} · ` : ""}{chat.last_message_preview || "No messages"}
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
                const vendorNames = [...new Set(order.order_items.map((i) => i.vendor?.store_name).filter(Boolean))].join(", ");
                const done = order.status === "completed" || order.status === "delivered";
                return (
                  <Link
                    key={order.id}
                    to="/admin/orders"
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
                        {vendorNames ? ` · ${vendorNames}` : ""}
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
                const fullVendor = vendors.find((v) => v.id === vendor.id);
                return (
                  <button
                    type="button"
                    key={vendor.id}
                    className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-muted/50 transition-colors text-left"
                    onClick={() => fullVendor && setSelectedVendorId(fullVendor.id)}
                  >
                    <span className="text-xs font-medium text-muted-foreground w-4">{i + 1}</span>
                    <Avatar className="h-9 w-9 border">
                      <AvatarImage src={vendor.avatar || undefined} />
                      <AvatarFallback>{vendor.storeName?.charAt(0) || "V"}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="font-medium truncate text-sm">{vendor.storeName}</p>
                        {fullVendor?.is_verified && <VerifiedBadge className="h-3.5 w-3.5" tier={fullVendor.verification_tier} />}
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

      <VendorDetailModal
        vendor={selectedVendor}
        open={!!selectedVendor}
        onOpenChange={(open) => !open && setSelectedVendorId(null)}
        canChangeBadge
      />
    </AdminLayout>
  );
}
