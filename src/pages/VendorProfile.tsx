import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Store, BadgeCheck, Package, Star, MapPin, Share2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ProductCard } from "@/components/products/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Product } from "@/hooks/useProducts";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export default function VendorProfile() {
  const { vendorId } = useParams<{ vendorId: string }>();
  
  const { data: vendor, isLoading: vendorLoading } = useQuery({
    queryKey: ["vendor-profile", vendorId],
    queryFn: async () => {
      if (!vendorId) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", vendorId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!vendorId,
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ["vendor-products", vendorId],
    queryFn: async () => {
      if (!vendorId) return [];
      const { data, error } = await supabase
        .from("products")
        .select(`
          *,
          product_images (id, url, is_primary, alt_text),
          category:categories (id, name, slug),
          vendor:profiles!products_vendor_id_fkey(id, full_name, avatar_url, is_verified, store_name)
        `)
        .eq("vendor_id", vendorId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      
      if (error) throw error;
      return data as Product[] || [];
    },
    enabled: !!vendorId,
  });

  const { data: stats } = useQuery({
    queryKey: ["vendor-stats", vendorId],
    queryFn: async () => {
      if (!vendorId) return { totalProducts: 0, totalOrders: 0, rating: 4.5 };
      
      // Get product count
      const { count: productCount } = await supabase
        .from("products")
        .select("*", { count: "exact", head: true })
        .eq("vendor_id", vendorId)
        .eq("is_active", true);
      
      // Get order items count (approximation of orders)
      const { count: orderCount } = await supabase
        .from("order_items")
        .select("*", { count: "exact", head: true })
        .eq("vendor_id", vendorId);
      
      // Get average rating
      const { data: reviews } = await supabase
        .from("reviews")
        .select("rating")
        .in("product_id", products?.map(p => p.id) || []);
      
      const avgRating = reviews?.length 
        ? reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length 
        : 4.5;
      
      return {
        totalProducts: productCount || 0,
        totalOrders: orderCount || 0,
        rating: avgRating,
      };
    },
    enabled: !!vendorId && !!products,
  });

  if (vendorLoading) {
    return (
      <MobileLayout>
        <div className="px-4 py-6">
          <Skeleton className="h-32 w-full rounded-xl mb-6" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </div>
      </MobileLayout>
    );
  }

  if (!vendor) {
    return (
      <MobileLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 py-6">
          <Store className="h-16 w-16 text-muted-foreground/50 mb-4" />
          <h1 className="text-lg font-bold">Store Not Found</h1>
          <p className="mt-2 text-sm text-muted-foreground">This store doesn't exist or is no longer active.</p>
          <Button asChild className="mt-4">
            <Link to="/products">Browse Products</Link>
          </Button>
        </div>
      </MobileLayout>
    );
  }

  const storeAddress = vendor.store_address as { city?: string; state?: string } | null;

  const handleShareShop = async () => {
    const shopUrl = `${window.location.origin}/vendor/${vendorId}`;
    const storeName = vendor.store_name || vendor.full_name || "Store";
    const shareData = {
      title: storeName,
      text: `Check out ${storeName} on Kano Kaftan!`,
      url: shopUrl,
    };

    try {
      if (navigator.share && navigator.canShare(shareData)) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(shopUrl);
        toast.success("Vendor shop link copied! 🎉", {
          description: "Share it with friends",
        });
      }
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        await navigator.clipboard.writeText(shopUrl);
        toast.success("Vendor shop link copied! 🎉");
      }
    }
  };

  return (
    <MobileLayout hideHeader>
      {/* Hero Section */}
      <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-background px-4 pt-4 pb-6">
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 top-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur"
          asChild
        >
          <Link to="/products">
            <ChevronLeft className="h-5 w-5" />
          </Link>
        </Button>

        {/* Share Shop Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur"
          onClick={handleShareShop}
        >
          <Share2 className="h-5 w-5" />
        </Button>

        <div className="pt-12 flex flex-col items-center text-center">
          <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
            <AvatarImage src={vendor.avatar_url || undefined} alt={vendor.store_name || "Store"} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl font-bold">
              {vendor.store_name?.charAt(0) || vendor.full_name?.charAt(0) || "S"}
            </AvatarFallback>
          </Avatar>
          
          <div className="mt-4 flex items-center gap-2">
            <h1 className="font-display text-xl font-bold">
              {vendor.store_name || vendor.full_name || "Store"}
            </h1>
            {vendor.is_verified && (
              <BadgeCheck className="h-5 w-5 text-primary" />
            )}
          </div>

          {storeAddress && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
              <MapPin className="h-3 w-3" />
              <span>{storeAddress.city}, {storeAddress.state}</span>
            </div>
          )}

          {vendor.store_description && (
            <p className="mt-3 text-sm text-muted-foreground max-w-[280px]">
              {vendor.store_description}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mt-6">
          <Card className="bg-background/60 backdrop-blur border-0">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold">{stats?.totalProducts || 0}</p>
              <p className="text-xs text-muted-foreground">Products</p>
            </CardContent>
          </Card>
          <Card className="bg-background/60 backdrop-blur border-0">
            <CardContent className="p-3 text-center">
              <p className="text-lg font-bold">{stats?.totalOrders || 0}</p>
              <p className="text-xs text-muted-foreground">Sales</p>
            </CardContent>
          </Card>
          <Card className="bg-background/60 backdrop-blur border-0">
            <CardContent className="p-3 text-center flex flex-col items-center">
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                <span className="font-bold">{stats?.rating?.toFixed(1) || "4.5"}</span>
              </div>
              <p className="text-xs text-muted-foreground">Rating</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Products Section */}
      <div className="px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-lg font-bold">Products</h2>
          <Badge variant="secondary">{products?.length || 0} items</Badge>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : products?.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-10 text-center">
              <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="font-medium mb-1">No products yet</h3>
              <p className="text-sm text-muted-foreground">
                This vendor hasn't added any products
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {products?.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}