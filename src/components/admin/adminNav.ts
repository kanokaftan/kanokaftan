import {
  Activity, AlertTriangle, BarChart, Boxes, DollarSign, Flag, Gem, LayoutDashboard, Megaphone,
  MessageCircle, Package, Settings, ShoppingCart, Store, Tag, Truck, UserPlus, Users,
  type LucideIcon,
} from "lucide-react";
import type { AdminOverview } from "@/hooks/useAdminOverview";

export interface AdminNavItem {
  title: string;
  url: string;
  icon: LucideIcon;
  /** Short hint shown in quick search. */
  hint: string;
  /** Extra words quick search should match. */
  keywords?: string;
  /** Number of things waiting on this page (red badge). */
  count?: (o: AdminOverview) => number;
}

export interface AdminNavGroup {
  title: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavGroup[] = [
  {
    title: "Today",
    items: [
      { title: "Home", url: "/admin/dashboard", icon: LayoutDashboard, hint: "What needs you now", keywords: "dashboard overview" },
      { title: "Messages", url: "/admin/messages", icon: MessageCircle, hint: "Support chats", keywords: "chat inbox support" },
    ],
  },
  {
    title: "Sales",
    items: [
      { title: "Orders", url: "/admin/orders", icon: ShoppingCart, hint: "Every order, filters, disputes", keywords: "payments refunds disputes",
        count: (o) => o.orders_to_prepare + o.open_disputes },
      { title: "Shipments", url: "/admin/shipments", icon: Boxes, hint: "Combined orders from several sellers", keywords: "combined pickup rider multi seller",
        count: (o) => o.combined_ready },
      { title: "Logistics", url: "/admin/logistics", icon: Truck, hint: "Delivery companies and fees", keywords: "delivery riders companies" },
      { title: "Finance", url: "/admin/finance", icon: DollarSign, hint: "Escrow, payouts, commissions", keywords: "money payout escrow paystack",
        count: (o) => o.failed_payouts },
    ],
  },
  {
    title: "Marketplace",
    items: [
      { title: "Sellers", url: "/admin/vendors", icon: Store, hint: "Shops, applications, verification", keywords: "vendors shops verify",
        count: (o) => o.seller_applications + o.verification_reviews },
      { title: "Products", url: "/admin/products", icon: Package, hint: "All listings", keywords: "items listings stock" },
      { title: "Categories", url: "/admin/categories", icon: Tag, hint: "Product categories" },
      { title: "Customers", url: "/admin/users", icon: Users, hint: "Everyone who signed up", keywords: "users buyers accounts" },
    ],
  },
  {
    title: "Growth",
    items: [
      { title: "Ambassadors", url: "/admin/ambassadors", icon: UserPlus, hint: "Referrals and applications", keywords: "referral invite",
        count: (o) => o.ambassador_applications },
      { title: "Partners", url: "/admin/partners", icon: Gem, hint: "Founding partners and choices", keywords: "marmara choice commission" },
      { title: "Announcements", url: "/admin/announcements", icon: Megaphone, hint: "Messages to everyone", keywords: "broadcast notify" },
      { title: "Analytics", url: "/admin/analytics", icon: Activity, hint: "Traffic and visitors", keywords: "visitors traffic" },
      { title: "Reports", url: "/admin/reports", icon: BarChart, hint: "Sales reports", keywords: "revenue export" },
    ],
  },
  {
    title: "Safety",
    items: [
      { title: "Moderation", url: "/admin/moderation", icon: Flag, hint: "Reported users and stories", keywords: "reports block",
        count: (o) => o.open_reports },
      { title: "App errors", url: "/admin/errors", icon: AlertTriangle, hint: "Crashes people hit", keywords: "bugs crash",
        count: (o) => o.app_errors },
      { title: "Settings", url: "/admin/settings", icon: Settings, hint: "Fees, commission, payouts", keywords: "config commission" },
    ],
  },
];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = ADMIN_NAV.flatMap((g) => g.items);

/** Phone tab bar: the four places admins go most, plus "More". */
export const ADMIN_TAB_URLS = ["/admin/dashboard", "/admin/orders", "/admin/messages", "/admin/vendors"];

export function isActivePath(pathname: string, url: string): boolean {
  return pathname === url || pathname.startsWith(`${url}/`);
}
