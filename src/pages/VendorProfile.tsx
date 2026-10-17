import { useEffect, useMemo, useState } from "react";
import { track } from "@/lib/analytics";
import { useParams, Link, Navigate, useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import {
  ChevronLeft, Store, Package, Star, MapPin, Share2, Search, Heart, Loader2, UserCheck, UserPlus,
} from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProductCard } from "@/components/products/ProductCard";
import { ChatWithVendorButton } from "@/components/chat/ChatWithVendorButton";
import { ChatWithUsButton } from "@/components/chat/ChatWithUsButton";
import { useShop, useShopFollow, useShopProducts, useShopReviews } from "@/hooks/useShops";
import { friendlyError, useShopSocial, useToggleShopLike } from "@/hooks/useShopFans";
import { ReviewPrompt } from "@/components/reviews/ReviewPrompt";
import { useAuth } from "@/contexts/AuthContext";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";
import { toast } from "sonner";
import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { ShopMarks } from "@/components/partners/PartnerMarks";
import { StoryRing, storyRingState } from "@/components/stories/StoryRing";
import { useVendorStories } from "@/hooks/useStories";
import { cn } from "@/lib/utils";

const DEFAULT_SHARE_IMAGE = "https://storage.googleapis.com/gpt-engineer-file-uploads/n85PtjtstLSH7FGT5eE0A6dm6zi2/social-images/social-1767791624177-Gemini_Generated_Image_duw5q6duw5q6duw5.png";

type SortOption = "newest" | "price-asc" | "price-desc";

/** A vendor's shop, at /shop/:slug (old /vendor/:vendorId links redirect here). */
export default function VendorProfile() {
  const { slug, vendorId } = useParams<{ slug?: string; vendorId?: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { data: shop, isLoading } = useShop({ slug, vendorId });
  const { data: liveStories = [] } = useVendorStories(shop?.id);
  const { data: products, isLoading: productsLoading } = useShopProducts(shop?.id);
  const { data: reviews } = useShopReviews(shop?.id);

  useEffect(() => {
    if (shop?.id) track("shop_view", { vendor_id: shop.id });
  }, [shop?.id]);
  const { isFollowing, toggleFollow, canFollow } = useShopFollow(shop?.id);
  const { data: social } = useShopSocial(shop?.id);
  const toggleLike = useToggleShopLike(shop?.id);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState<SortOption>("newest");

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    products?.forEach((p) => p.category && map.set(p.category.slug, p.category.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const visibleProducts = useMemo(() => {
    const term = search.trim().toLowerCase();
    const filtered = (products ?? []).filter(
      (p) =>
        (!term || p.name.toLowerCase().includes(term)) &&
        (category === "all" || p.category?.slug === category),
    );
    if (sort === "price-asc") return [...filtered].sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return [...filtered].sort((a, b) => b.price - a.price);
    return filtered;
  }, [products, search, category, sort]);

  const shopUrl = shop ? `${window.location.origin}/shop/${shop.store_slug}` : window.location.href;

  useDocumentMeta({
    title: shop ? `${shop.store_name} - Kano Kaftan` : "Shop - Kano Kaftan",
    description:
      shop?.store_description ||
      `Shop clothing, fabrics, shoes, caps and accessories from ${shop?.store_name ?? "our sellers"} on Kano Kaftan.`,
    image: shop?.store_banner_url || shop?.avatar_url || DEFAULT_SHARE_IMAGE,
    url: shopUrl,
  });

  // Old /vendor/:id links: move to the short link once we know it.
  if (vendorId && shop) {
    return <Navigate to={`/shop/${shop.store_slug}`} replace />;
  }

  if (isLoading) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          <Skeleton className="h-40 w-full rounded-xl mb-6" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!shop) {
    return (
      <MobileLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-6 text-center">
          <Store className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h1 className="text-lg font-bold">Shop not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This shop doesn't exist or is no longer active.</p>
          <Button asChild className="mt-4">
            <Link to="/shops">Browse shops</Link>
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const handleShare = async () => {
    const shareData = {
      title: `${shop.store_name} - Kano Kaftan`,
      text: `Check out ${shop.store_name} on Kano Kaftan! Clothing, fabrics, shoes, caps and accessories.`,
      url: shopUrl,
    };
    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shopUrl);
        toast.success("Shop link copied!", { description: shopUrl });
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        await navigator.clipboard.writeText(shopUrl);
        toast.success("Shop link copied!");
      }
    }
  };

  const handleFollow = async () => {
    if (!user) {
      toast.info("Sign in to follow shops");
      navigate(`/auth?redirect=${encodeURIComponent(`/shop/${shop.store_slug}`)}`);
      return;
    }
    try {
      const nowFollowing = await toggleFollow.mutateAsync();
      toast.success(nowFollowing ? `Following ${shop.store_name}. We'll tell you about new items.` : "Unfollowed");
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Could not update follow");
    }
  };

  const handleLike = () => {
    if (!user) {
      toast.info("Sign in to like shops");
      navigate(`/auth?redirect=${encodeURIComponent(`/shop/${shop.store_slug}`)}`);
      return;
    }
    const like = !social?.iLike;
    toggleLike.mutate(like, {
      onSuccess: () => like && toast.success(`You liked ${shop.store_name}`),
      onError: (error) => toast.error(friendlyError(error, "Could not update your like. Please try again.")),
    });
  };

  const isOwnShop = user?.id === shop.id;
  const followerCount = social?.followerCount ?? shop.follower_count;
  const likeCount = social?.likeCount ?? 0;
  const liked = social?.iLike ?? false;

  return (
    <MobileLayout hideHeader>
      {/* Banner */}
      <div className="relative h-36 bg-gradient-to-br from-primary/25 via-primary/10 to-muted md:h-52">
        {shop.store_banner_url && (
          <img src={shop.store_banner_url} alt="" className="h-full w-full object-cover" />
        )}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/shops"))}
          aria-label="Back"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur"
          onClick={handleShare}
          aria-label="Share shop"
        >
          <Share2 className="h-5 w-5" />
        </Button>
      </div>

      {/* Header */}
      <div className="px-4 pb-4">
        <div className="-mt-12 flex items-end justify-between gap-3">
          <StoryRing
            vendorId={shop.id}
            state={liveStories.length ? storyRingState(shop.is_verified ? shop.verification_tier : null, liveStories.every((s) => s.seen_by_me)) : null}
            size={liveStories.length ? 104 : 96}
            label={`View ${shop.store_name}'s story`}
            className="shadow-lg"
          >
            <Avatar className={cn("h-full w-full", !liveStories.length && "border-4 border-background")}>
              <AvatarImage src={shop.avatar_url || undefined} alt={shop.store_name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
                {shop.store_name.charAt(0)}
              </AvatarFallback>
            </Avatar>
          </StoryRing>
          {isOwnShop ? (
            <Button asChild variant="outline" size="sm">
              <Link to="/vendor/settings">Edit shop</Link>
            </Button>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <h1 className="font-display text-xl font-bold">{shop.store_name}</h1>
          {shop.is_verified && <VerifiedBadge className="h-5 w-5" tier={shop.verification_tier} />}
        </div>
        <ShopMarks vendorId={shop.id} className="mt-1.5" />
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {(shop.city || shop.state) && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {[shop.city, shop.state].filter(Boolean).join(", ")}
            </span>
          )}
          <span>Joined {formatDistanceToNow(new Date(shop.joined_at), { addSuffix: true })}</span>
        </div>
        {shop.store_description && (
          <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">{shop.store_description}</p>
        )}

        {/* Stats */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { value: shop.product_count, label: "Products" },
            { value: followerCount, label: followerCount === 1 ? "Follower" : "Followers" },
            { value: shop.items_sold, label: "Sold" },
            {
              value: shop.rating !== null ? Number(shop.rating).toFixed(1) : "–",
              label: `${shop.review_count} reviews`,
              star: shop.rating !== null,
            },
          ].map((stat) => (
            <Card key={stat.label} className="border-0 bg-muted/50">
              <CardContent className="p-2 text-center">
                <p className="flex items-center justify-center gap-1 font-bold">
                  {stat.star && <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />}
                  {stat.value}
                </p>
                <p className="text-[11px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Actions */}
        {!isOwnShop && (
          <div className="mt-4 grid grid-cols-[1fr_1fr_auto] gap-2">
            <Button
              variant={isFollowing ? "outline" : "default"}
              onClick={handleFollow}
              disabled={toggleFollow.isPending || (!!user && !canFollow)}
            >
              {toggleFollow.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : isFollowing ? (
                <UserCheck className="mr-2 h-4 w-4" />
              ) : (
                <UserPlus className="mr-2 h-4 w-4" />
              )}
              {isFollowing ? "Following" : "Follow"}
            </Button>
            <ChatWithVendorButton vendorId={shop.id} variant="outline" label="Chat" />
            <Button
              variant="outline"
              onClick={handleLike}
              disabled={!!user && !canFollow}
              aria-pressed={liked}
              aria-label={liked ? `Unlike ${shop.store_name}` : `Like ${shop.store_name}`}
              className={cn("gap-1.5 px-3 tabular-nums", liked && "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 hover:text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40")}
            >
              <Heart className={cn("h-4 w-4 transition-transform", liked && "scale-110 fill-current")} />
              {likeCount > 0 && likeCount}
            </Button>
            <ChatWithUsButton className="col-span-3" variant="secondary" label="Buy through Kano Kaftan (protected)" />
            <p className="col-span-3 text-center text-xs text-muted-foreground">
              Deals made directly with the seller are at your own risk.
            </p>
          </div>
        )}
        {!isOwnShop && <ReviewPrompt vendorId={shop.id} className="mt-3" />}
      </div>

      <Tabs defaultValue="products" className="px-4 pb-24">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="products">Products ({shop.product_count})</TabsTrigger>
          <TabsTrigger value="reviews">Reviews ({shop.review_count})</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${shop.store_name}`}
              className="pl-9"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger aria-label="Category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {categories.map(([value, name]) => (
                  <SelectItem key={value} value={value}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
              <SelectTrigger aria-label="Sort">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="price-asc">Price: low to high</SelectItem>
                <SelectItem value="price-desc">Price: high to low</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {productsLoading ? (
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="aspect-square rounded-xl" />
              ))}
            </div>
          ) : visibleProducts.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-10 text-center">
                <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
                <h3 className="font-medium mb-1">
                  {products?.length ? "No products match" : "No products yet"}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {products?.length ? "Try a different search or category." : "This shop hasn't listed anything yet."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
              {visibleProducts.map((product) => (
                <ProductCard key={product.id} product={product} hideFloatingCart />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reviews" className="space-y-3">
          {!reviews?.length ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No reviews yet.</p>
          ) : (
            reviews.map((review) => (
              <Card key={review.id}>
                <CardContent className="space-y-1 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-0.5" aria-label={`${review.rating} out of 5`}>
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          className={`h-3.5 w-3.5 ${n <= review.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/40"}`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(review.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {review.review_text && <p className="text-sm">{review.review_text}</p>}
                  <p className="text-xs text-muted-foreground">
                    {review.reviewer_name} on{" "}
                    <Link to={`/products/${review.product_slug}`} className="underline">
                      {review.product_name}
                    </Link>
                  </p>
                  {review.seller_reply && (
                    <p className="mt-2 rounded-md bg-muted p-2 text-xs">
                      <span className="font-medium">Seller reply: </span>
                      {review.seller_reply}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </MobileLayout>
  );
}
