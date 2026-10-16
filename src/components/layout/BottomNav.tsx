import { Home, LayoutGrid, MessageCircle, Store, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useConversations } from "@/hooks/useChat";
import { BubbleTabBar, type TabItem } from "@/components/layout/BubbleTabBar";

/** Pages reached from the profile (orders and favourites live there now), so the Profile tab stays lit on them. */
const PROFILE_PAGES = ["/profile", "/orders", "/wishlist", "/account", "/settings"];

const onPage = (pathname: string, base: string) => pathname === base || pathname.startsWith(`${base}/`);

/** The shopper's tab bar. */
export function useShopperTabs(): TabItem[] {
  const { t } = useTranslation();
  const { unreadCount } = useConversations();
  return [
    { icon: Home, label: t("nav.home"), href: "/" },
    { icon: LayoutGrid, label: t("nav.products"), href: "/products" },
    { icon: Store, label: t("nav.shops"), href: "/shops", match: (p) => onPage(p, "/shops") || onPage(p, "/shop") },
    { icon: MessageCircle, label: t("nav.chat"), href: "/messages", badge: unreadCount },
    { icon: User, label: t("nav.profile"), href: "/profile", match: (p) => PROFILE_PAGES.some((base) => onPage(p, base)) },
  ];
}

export function BottomNav() {
  return <BubbleTabBar items={useShopperTabs()} />;
}
