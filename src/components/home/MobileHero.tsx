import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Megaphone, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/useProducts";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { useEffect, useState, useCallback } from "react";
import Autoplay from "embla-carousel-autoplay";

import { VerifiedBadge } from "@/components/shop/VerifiedBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Shown only when there are no featured products: the brand, never stock photos. */
const BRAND_SLIDE = {
  image: null,
  tag: "Kano Kaftan",
  title: "AUTHENTIC\nKANO TAILORING",
  description: "Agbada, kaftan and dashiki from master tailors in Kano.",
};

const HERO_PRODUCT_LIMIT = 5;

interface HeroSlide {
  image: string | null;
  tag: string;
  title: string;
  description: string;
  slug?: string;
  shopName?: string | null;
  shopVerified?: boolean;
  shopTier?: string | null;
  sponsored?: boolean;
}

export function MobileHero() {
  const { t } = useTranslation();
  const { data, isLoading } = useProducts({ featured: true, limit: HERO_PRODUCT_LIMIT });
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [autoplayPlugin] = useState(() => 
    Autoplay({ delay: 4000, stopOnInteraction: false })
  );

  const slides: HeroSlide[] = data?.products?.length
    ? data.products.map((product, index) => ({
        image:
          product.product_images?.find((img) => img.is_primary)?.url ||
          product.product_images?.[0]?.url ||
          null,
        tag: t("home.sponsored", "Sponsored"),
        title: product.name?.toUpperCase().replace(/ /g, '\n') || "FEATURED\nPRODUCT",
        description: product.description?.slice(0, 80) || `Premium ${product.category?.name || 'attire'} from ${product.vendor?.store_name || 'our vendors'}.`,
        slug: product.slug,
        shopName: product.vendor?.store_name,
        shopVerified: product.vendor?.is_verified,
        shopTier: product.vendor?.verification_tier,
        sponsored: true,
      }))
    : [BRAND_SLIDE];

  const onSelect = useCallback(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
  }, [api]);

  useEffect(() => {
    if (!api) return;
    
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api, onSelect]);

  const scrollTo = useCallback((index: number) => {
    api?.scrollTo(index);
  }, [api]);

  // While loading: a shimmering placeholder the same size as the banner (no old photos).
  if (isLoading) {
    return (
      <section className="relative mx-4 mt-3 overflow-hidden rounded-xl" aria-busy="true" aria-label="Loading featured products">
        <Skeleton className="aspect-[4/5] w-full rounded-xl bg-foreground/[0.07] sm:aspect-[16/9]" />
        <div className="absolute inset-x-4 bottom-4 space-y-2">
          <Skeleton className="h-4 w-20 rounded-md bg-background/60" />
          <Skeleton className="h-6 w-3/5 rounded-md bg-background/60" />
          <Skeleton className="h-8 w-28 rounded-full bg-background/60" />
        </div>
      </section>
    );
  }

  return (
    <section className="relative mx-4 mt-3 overflow-hidden rounded-xl animate-in fade-in-0 duration-500">
      <Carousel 
        opts={{ loop: true }} 
        plugins={[autoplayPlugin]}
        className="w-full"
        setApi={setApi}
      >
        <CarouselContent>
          {slides.map((slide, index) => (
            <CarouselItem key={index}>
              <div className="relative aspect-[4/5] sm:aspect-[16/9] w-full">
                {slide.image ? (
                  <HeroImage src={slide.image} alt={slide.title.replace(/\n/g, " ")} eager={index === 0} />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-neutral-900 via-neutral-800 to-[#5C4300]" />
                )}
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-4 sm:p-6">
                  {/* Tag */}
                  <span className="mb-1.5 inline-flex w-fit items-center gap-1 rounded-md bg-primary px-2.5 py-0.5 text-[10px] font-semibold text-primary-foreground">
                    {slide.sponsored && <Megaphone className="h-3 w-3" aria-hidden="true" />}
                    {slide.tag}
                  </span>
                  
                  {/* Title */}
                  <h1 className="font-display text-xl font-bold leading-tight text-white sm:text-2xl whitespace-pre-line">
                    {slide.title}
                  </h1>
                  
                  {/* Shop name (product slides only) */}
                  {slide.shopName && (
                    <p className="mt-1 flex items-center gap-1 text-xs font-medium text-white/90">
                      <Store className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      <span className="truncate">{slide.shopName}</span>
                      {slide.shopVerified && (
                        <VerifiedBadge className="h-3.5 w-3.5" tier={slide.shopTier} label={slide.shopTier === "gold" ? t("home.topShop", "Top seller") : t("home.verifiedShop", "Verified shop")} />
                      )}
                    </p>
                  )}

                  {/* Description - hidden on mobile for compactness */}
                  <p className="mt-1.5 max-w-[240px] text-xs leading-relaxed text-white/85 line-clamp-2 hidden sm:block">
                    {slide.description}
                  </p>
                  
                  {/* CTA Button */}
                  <Button 
                    size="sm" 
                    variant="secondary"
                    className="mt-3 w-fit rounded-full px-5 text-xs font-medium"
                    asChild
                  >
                    <Link to={slide.slug ? `/products/${slide.slug}` : "/products"}>
                      {slide.slug ? t("home.viewProduct", "View Product") : t("home.shopNow", "Shop Now")}
                    </Link>
                  </Button>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
    </section>
  );
}
/** A banner photo that fades in once it has loaded (grey shimmer until then). */
function HeroImage({ src, alt, eager }: { src: string; alt: string; eager: boolean }) {
  const [loaded, setLoaded] = useState(false);
  // Photos already in the browser cache (e.g. reopening the app) show at once, without the fade.
  const markIfCached = useCallback((img: HTMLImageElement | null) => {
    if (img?.complete && img.naturalWidth > 0) setLoaded(true);
  }, []);
  return (
    <>
      {!loaded && <Skeleton className="absolute inset-0 rounded-none bg-foreground/[0.07]" />}
      <img
        ref={markIfCached}
        src={src}
        alt={alt}
        loading={eager ? "eager" : "lazy"}
        // The first banner is the most important picture on the page: fetch it before anything else.
        {...{ fetchpriority: eager ? "high" : "auto" }}
        decoding="async"
        onLoad={() => setLoaded(true)}
        onError={() => setLoaded(true)}
        className={cn("h-full w-full object-cover object-top transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
      />
    </>
  );
}
