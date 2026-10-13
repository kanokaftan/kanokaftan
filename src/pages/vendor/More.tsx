import { Link, useNavigate } from "react-router-dom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import {
  BadgeCheck, Bell, ChevronRight, CircleFadingPlus, ExternalLink, Headset, Heart, LogOut, Megaphone, Settings, Share2, ShoppingBag, Star, Wallet,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useMyShop } from "@/hooks/useMyShop";
import { useMyFanSummary } from "@/hooks/useShopFans";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { forgetThisDevice } from "@/lib/push";
import { useStartSupportConversation } from "@/hooks/useChat";
import { cn } from "@/lib/utils";

interface Row {
  icon: LucideIcon;
  label: string;
  hint?: string;
  to?: string;
  onClick?: () => void;
  tone?: "danger";
  external?: boolean;
}

/** iOS-style grouped list: rounded group, thin separators that start after the icon. */
function Group({ title, rows }: { title?: string; rows: Row[] }) {
  return (
    <section>
      {title && <h2 className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h2>}
      <ul className="overflow-hidden rounded-2xl border bg-card">
        {rows.map((row) => {
          const content = (
            <>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", row.tone === "danger" ? "bg-red-100 text-red-600 dark:bg-red-950" : "bg-muted")}>
                <row.icon className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <span className="flex min-w-0 flex-1 items-center gap-2 border-b border-border/60 py-3 pr-3 group-last/row:border-b-0">
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-[15px]", row.tone === "danger" && "text-red-600")}>{row.label}</span>
                  {row.hint && <span className="block truncate text-xs text-muted-foreground">{row.hint}</span>}
                </span>
                {row.external ? <ExternalLink className="h-4 w-4 text-muted-foreground" /> : row.tone !== "danger" && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </span>
            </>
          );
          const className = "flex w-full items-center gap-3 pl-3 text-left transition-colors active:bg-muted/70 hover:bg-muted/40";
          return (
            <li key={row.label} className="group/row">
              {row.to ? (
                <Link to={row.to} className={className}>{content}</Link>
              ) : (
                <button type="button" onClick={row.onClick} className={className}>{content}</button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Everything that isn't in the tab bar, one tap away. */
export default function VendorMore() {
  const navigate = useNavigate();
  const { userId } = useVendorAuth();
  const startSupport = useStartSupportConversation();

  const { shop, name, shopUrl, isLoading, share: shareShop } = useMyShop(userId);
  const { data: fans } = useMyFanSummary(!!userId);

  const chatWithUs = async () => {
    try {
      const id = await startSupport.mutateAsync(undefined);
      navigate(`/vendor/messages/${id}`);
    } catch (error) {
      console.error("[VendorMore] support chat failed", error);
      toast.error("Could not open the chat. Please try again.");
    }
  };

  const logOut = async () => {
    try {
      await forgetThisDevice();
      await supabase.auth.signOut({ scope: "local" });
      navigate("/vendor/login");
    } catch (error) {
      console.error("[VendorMore] sign out failed", error);
      toast.error("Could not sign out. Please try again.");
    }
  };

  return (
    <VendorLayout title="More">
      <div className="mx-auto max-w-lg space-y-6">
        {/* Shop card */}
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
          {isLoading ? (
            <Skeleton className="h-14 w-full rounded-xl" />
          ) : (
            <>
              <Avatar className="h-14 w-14 border">
                <AvatarImage src={shop?.avatar_url || undefined} />
                <AvatarFallback className="text-lg">{name.charAt(0).toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-semibold">{name}</p>
                <p className="truncate text-xs text-muted-foreground">{shopUrl ? shopUrl.replace("https://", "") : "Set your shop name in Settings"}</p>
              </div>
              <button type="button" onClick={shareShop} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground active:scale-95" aria-label="Share my shop">
                <Share2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <Group
          title="Your customers"
          rows={[
            {
              icon: Heart,
              label: "Followers & likes",
              hint: fans ? `${fans.followers} follower${fans.followers === 1 ? "" : "s"} · ${fans.likes} like${fans.likes === 1 ? "" : "s"}` : "See who follows and likes your shop",
              to: "/vendor/fans",
            },
            {
              icon: Star,
              label: "Reviews",
              hint: fans?.awaiting_reply ? `${fans.awaiting_reply} waiting for your reply` : fans?.reviews ? `${fans.reviews} review${fans.reviews === 1 ? "" : "s"}${fans.rating != null ? ` · ${fans.rating.toFixed(1)} stars` : ""}` : "Read and reply to reviews",
              to: "/vendor/reviews",
            },
          ]}
        />

        <Group
          title="Money"
          rows={[{ icon: Wallet, label: "How you earn", hint: "Your 3 ways to sell and what Kano Kaftan keeps", to: "/vendor/earnings" }]}
        />

        <Group
          title="Grow your sales"
          rows={[
            { icon: Megaphone, label: "Promote on homepage", hint: "Feature products or your shop", to: "/vendor/promote" },
            { icon: CircleFadingPlus, label: "Stories", hint: "Post photos that last 24 hours", to: "/vendor/stories" },
            { icon: BadgeCheck, label: "Verification", hint: shop?.is_verified ? "Your shop is verified" : "Get the verified badge", to: "/vendor/verification" },
          ]}
        />

        <Group
          title="Your shop"
          rows={[
            ...(shop?.store_slug ? [{ icon: ExternalLink, label: "View my shop", hint: "See it like a customer", to: `/shop/${shop.store_slug}` }] : []),
            { icon: Share2, label: "Share my shop link", hint: "WhatsApp, Instagram, anywhere", onClick: shareShop },
            { icon: Settings, label: "Shop settings", hint: "Name, logo, address, bank account", to: "/vendor/settings" },
            { icon: Bell, label: "Notifications", to: "/vendor/notifications" },
          ]}
        />

        <section>
          <h2 className="mb-1.5 px-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Appearance</h2>
          <div className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3">
            <span className="text-[15px]">Theme</span>
            <ThemeToggle />
          </div>
        </section>

        <Group
          title="Help"
          rows={[{ icon: Headset, label: "Chat with Kano Kaftan", hint: "Questions about orders, payouts or your shop", onClick: chatWithUs }]}
        />

        <Group
          rows={[
            { icon: ShoppingBag, label: "Switch to shopping", to: "/" },
            { icon: LogOut, label: "Log out", onClick: logOut, tone: "danger" },
          ]}
        />
      </div>
    </VendorLayout>
  );
}
