import { useSearchParams } from "react-router-dom";
import { formatDistanceToNowStrict } from "date-fns";
import { Heart, Share2, ShoppingBag, UserCheck, Users } from "lucide-react";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyFanSummary, useMyShopFans, type FanList, type ShopFan } from "@/hooks/useShopFans";
import { useMyShop } from "@/hooks/useMyShop";
import { cn } from "@/lib/utils";

const TABS: { value: FanList; label: string; icon: typeof Users }[] = [
  { value: "followers", label: "Followers", icon: UserCheck },
  { value: "likes", label: "Likes", icon: Heart },
];

function FanRow({ fan, kind }: { fan: ShopFan; kind: FanList }) {
  const when = formatDistanceToNowStrict(new Date(fan.since), { addSuffix: true });
  return (
    <li className="flex items-center gap-3 border-b border-border/60 px-3.5 py-3 last:border-b-0">
      <Avatar className="h-11 w-11">
        <AvatarImage src={fan.avatar_url || undefined} alt="" />
        <AvatarFallback className="font-semibold">{fan.name.charAt(0).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-medium">{fan.name}</p>
        <p className="truncate text-xs text-muted-foreground">
          {kind === "followers" ? `Followed ${when}` : `Liked your shop ${when}`}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1">
        {kind === "followers" && fan.likes && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
            <Heart className="h-3 w-3 fill-current" />Liked
          </span>
        )}
        {kind === "likes" && fan.follows && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
            <UserCheck className="h-3 w-3" />Follows
          </span>
        )}
        {fan.orders_count > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
            <ShoppingBag className="h-3 w-3" />Bought {fan.orders_count}×
          </span>
        )}
      </div>
    </li>
  );
}

/** Seller: who follows the shop and who liked it. */
export default function VendorFans() {
  const { userId } = useVendorAuth();
  const [params, setParams] = useSearchParams();
  const tab: FanList = params.get("tab") === "likes" ? "likes" : "followers";
  const { data: summary } = useMyFanSummary(!!userId);
  const { data: fans, isLoading, isError, refetch } = useMyShopFans(tab);
  const { share } = useMyShop(userId);

  const counts: Record<FanList, { total: number; week: number }> = {
    followers: { total: summary?.followers ?? 0, week: summary?.followers_week ?? 0 },
    likes: { total: summary?.likes ?? 0, week: summary?.likes_week ?? 0 },
  };

  return (
    <VendorLayout title="Followers & likes">
      <div className="mx-auto max-w-lg space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {TABS.map((t) => (
            <div key={t.value} className="rounded-2xl border bg-card p-3.5">
              <div className="flex items-center gap-2 text-muted-foreground">
                <t.icon className={cn("h-4 w-4", t.value === "likes" && "text-foreground")} />
                <span className="text-xs font-medium">{t.label}</span>
              </div>
              <p className="mt-1 text-2xl font-bold tabular-nums">{summary ? counts[t.value].total : "…"}</p>
              <p className="text-[11px] text-muted-foreground">
                {counts[t.value].week > 0 ? `+${counts[t.value].week} this week` : "No new ones this week"}
              </p>
            </div>
          ))}
        </div>

        <div role="tablist" aria-label="Show" className="grid grid-cols-2 rounded-full bg-muted p-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={tab === t.value}
              onClick={() => setParams(t.value === "followers" ? {} : { tab: t.value }, { replace: true })}
              className={cn("h-9 rounded-full text-sm font-medium transition-all", tab === t.value ? "bg-background shadow-sm" : "text-muted-foreground")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
          </div>
        ) : isError ? (
          <div className="rounded-2xl border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground">Couldn't load this list.</p>
            <Button variant="outline" size="sm" className="mt-3 rounded-full" onClick={() => refetch()}>Try again</Button>
          </div>
        ) : !fans?.length ? (
          <div className="rounded-2xl border bg-card px-6 py-8 text-center">
            {tab === "followers" ? <Users className="mx-auto h-8 w-8 text-muted-foreground/50" /> : <Heart className="mx-auto h-8 w-8 text-muted-foreground/50" />}
            <p className="mt-3 font-medium">{tab === "followers" ? "No followers yet" : "No likes yet"}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Share your shop link on WhatsApp and Instagram. People who follow you hear about every new product and story.
            </p>
            <Button className="mt-4 rounded-full" onClick={share}>
              <Share2 className="mr-2 h-4 w-4" />Share my shop
            </Button>
          </div>
        ) : (
          <ul className="overflow-hidden rounded-2xl border bg-card">
            {fans.map((fan) => <FanRow key={fan.user_id} fan={fan} kind={tab} />)}
          </ul>
        )}
      </div>
    </VendorLayout>
  );
}
