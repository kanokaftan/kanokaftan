import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageCircle, Users, Package, ShoppingCart,
  TrendingUp, ArrowRight, Clock, CheckCircle, XCircle
} from "lucide-react";

interface Stats {
  totalUsers: number;
  totalProducts: number;
  openChats: number;
  totalOrders: number;
  pendingOrders: number;
  recentChats: {
    id: string;
    customer_name: string;
    last_message: string;
    created_at: string;
    status: string;
  }[];
  recentOrders: {
    id: string;
    customer_name: string;
    status: string;
    total: number | null;
    created_at: string;
  }[];
}

const formatTime = (date: string) => {
  const d = new Date(date);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
};

const statusColor = (status: string) => {
  switch (status) {
    case "pending": return "bg-yellow-100 text-yellow-700";
    case "processing": return "bg-blue-100 text-blue-700";
    case "completed": return "bg-green-100 text-green-700";
    case "cancelled": return "bg-red-100 text-red-700";
    case "open": return "bg-green-100 text-green-700";
    case "closed": return "bg-gray-100 text-gray-500";
    default: return "bg-gray-100 text-gray-600";
  }
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalProducts: 0,
    openChats: 0,
    totalOrders: 0,
    pendingOrders: 0,
    recentChats: [],
    recentOrders: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [users, products, chats, orders] = await Promise.all([
        supabase.from("profiles").select("id", { count: "exact" }),
        supabase.from("products").select("id", { count: "exact" }).eq("is_active", true),
        supabase.from("chats").select("id", { count: "exact" }).eq("status", "open"),
        supabase.from("orders").select("id", { count: "exact" }),
      ]);

      // Recent chats with last message
      const { data: recentChatsData } = await supabase
        .from("chats")
        .select(`*, profiles(full_name, email)`)
        .order("updated_at", { ascending: false })
        .limit(5);

      const recentChats = await Promise.all(
        (recentChatsData || []).map(async (chat) => {
          const { data: msgs } = await supabase
            .from("messages")
            .select("content")
            .eq("chat_id", chat.id)
            .order("created_at", { ascending: false })
            .limit(1);
          return {
            id: chat.id,
            customer_name: chat.profiles?.full_name || chat.profiles?.email || "Customer",
            last_message: msgs?.[0]?.content || "No messages",
            created_at: chat.updated_at || chat.created_at,
            status: chat.status,
          };
        })
      );

      // Recent orders
      const { data: recentOrdersData } = await supabase
        .from("orders")
        .select(`*, profiles(full_name, email)`)
        .order("created_at", { ascending: false })
        .limit(5);

      const recentOrders = (recentOrdersData || []).map((order) => ({
        id: order.id,
        customer_name: order.profiles?.full_name || order.profiles?.email || "Customer",
        status: order.status,
        total: order.total,
        created_at: order.created_at,
      }));

      const { count: pendingCount } = await supabase
        .from("orders")
        .select("id", { count: "exact" })
        .eq("status", "pending");

      setStats({
        totalUsers: users.count || 0,
        totalProducts: products.count || 0,
        openChats: chats.count || 0,
        totalOrders: orders.count || 0,
        pendingOrders: pendingCount || 0,
        recentChats,
        recentOrders,
      });
    } catch (error) {
      console.error("Error loading stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      label: "Open Chats",
      value: stats.openChats,
      icon: MessageCircle,
      color: "bg-blue-50 text-blue-600",
      href: "/admin/chats",
      urgent: stats.openChats > 0,
    },
    {
      label: "Total Users",
      value: stats.totalUsers,
      icon: Users,
      color: "bg-purple-50 text-purple-600",
      href: "/admin/users",
      urgent: false,
    },
    {
      label: "Products",
      value: stats.totalProducts,
      icon: Package,
      color: "bg-amber-50 text-amber-600",
      href: "/admin/products",
      urgent: false,
    },
    {
      label: "Pending Orders",
      value: stats.pendingOrders,
      icon: ShoppingCart,
      color: "bg-green-50 text-green-600",
      href: "/admin/orders",
      urgent: stats.pendingOrders > 0,
    },
  ];

  return (
    <AdminLayout title="Dashboard">
      <div className="space-y-5">

        {/* Greeting */}
        <div className="bg-gray-900 rounded-2xl p-4 text-white">
          <p className="text-gray-400 text-xs mb-1">Welcome back 👋</p>
          <h2 className="font-bold text-lg">Kano Kaftan</h2>
          <p className="text-gray-400 text-sm mt-1">
            {stats.openChats > 0
              ? `You have ${stats.openChats} open chat${stats.openChats > 1 ? "s" : ""} waiting`
              : "Everything looks good today"}
          </p>
          {stats.openChats > 0 && (
            <Link
              to="/admin/chats"
              className="inline-flex items-center gap-1.5 mt-3 bg-white text-gray-900 text-xs font-semibold px-3 py-1.5 rounded-full"
            >
              <MessageCircle className="w-3.5 h-3.5" />
              Reply Now
              <ArrowRight className="w-3 h-3" />
            </Link>
          )}
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((card) => (
            <Link
              key={card.label}
              to={card.href}
              className={`bg-white rounded-2xl p-4 border transition-all active:scale-95 ${
                card.urgent ? "border-gray-900 shadow-sm" : "border-gray-100"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${card.color}`}>
                  <card.icon className="w-4.5 h-4.5" />
                </div>
                {card.urgent && (
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                )}
              </div>
              {loading ? (
                <div className="h-7 w-12 bg-gray-100 rounded animate-pulse" />
              ) : (
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              )}
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </Link>
          ))}
        </div>

        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-3">Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/admin/products"
              className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Package className="w-4 h-4 text-amber-500" />
              Add Product
            </Link>
            <Link
              to="/admin/chats"
              className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <MessageCircle className="w-4 h-4 text-blue-500" />
              View Chats
            </Link>
            <Link
              to="/admin/orders"
              className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <ShoppingCart className="w-4 h-4 text-green-500" />
              View Orders
            </Link>
            <Link
              to="/admin/users"
              className="flex items-center gap-2 bg-white border border-gray-100 rounded-xl px-3 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Users className="w-4 h-4 text-purple-500" />
              View Users
            </Link>
          </div>
        </div>

        {/* Recent Chats */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Chats</h3>
            <Link to="/admin/chats" className="text-xs text-gray-500 flex items-center gap-1">
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {loading && (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
                ))}
              </div>
            )}
            {!loading && stats.recentChats.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                <MessageCircle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No chats yet</p>
              </div>
            )}
            {stats.recentChats.map((chat) => (
              <Link
                key={chat.id}
                to="/admin/chats"
                state={{ chatId: chat.id }}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3 hover:border-gray-200 transition-colors"
              >
                <div className="w-9 h-9 rounded-full bg-gray-900 text-white flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {chat.customer_name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{chat.customer_name}</p>
                    <span className="text-[10px] text-gray-400 flex-shrink-0 ml-2">{formatTime(chat.created_at)}</span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{chat.last_message}</p>
                </div>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${statusColor(chat.status)}`}>
                  {chat.status}
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-900">Recent Orders</h3>
            <Link to="/admin/orders" className="text-xs text-gray-500 flex items-center gap-1">
              See all <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {!loading && stats.recentOrders.length === 0 && (
              <div className="bg-white border border-gray-100 rounded-xl p-4 text-center">
                <ShoppingCart className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400">No orders yet</p>
              </div>
            )}
            {stats.recentOrders.map((order) => (
              <div
                key={order.id}
                className="flex items-center gap-3 bg-white border border-gray-100 rounded-xl p-3"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  order.status === "completed" ? "bg-green-100" :
                  order.status === "cancelled" ? "bg-red-100" : "bg-yellow-100"
                }`}>
                  {order.status === "completed" ? (
                    <CheckCircle className="w-4 h-4 text-green-600" />
                  ) : order.status === "cancelled" ? (
                    <XCircle className="w-4 h-4 text-red-600" />
                  ) : (
                    <Clock className="w-4 h-4 text-yellow-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{order.customer_name}</p>
                  <p className="text-xs text-gray-400">{formatTime(order.created_at)}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  {order.total && (
                    <p className="text-sm font-semibold text-gray-900">
                      ₦{order.total.toLocaleString()}
                    </p>
                  )}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${statusColor(order.status)}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </AdminLayout>
  );
}
