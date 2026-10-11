import { useEffect, useRef, useState } from "react";
import { FadeInImage } from "@/components/ui/fade-in-image";
import useEmblaCarousel from "embla-carousel-react";
import { cn } from "@/lib/utils";

/** More dots than this would crowd a small card. */
const MAX_DOTS = 5;
const AUTOPLAY_INTERVAL_MS = 2500;
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

export interface CarouselImage {
  url: string;
  is_primary?: boolean | null;
  display_order?: number | null;
}

/** Main photo first, then the order the seller chose, without duplicates or blanks. */
function orderProductImages(images: CarouselImage[] | null | undefined): string[] {
  const sorted = (images ?? [])
    .filter((img) => !!img?.url)
    .sort((a, b) => Number(!!b.is_primary) - Number(!!a.is_primary) || (a.display_order ?? 0) - (b.display_order ?? 0));
  return [...new Set(sorted.map((img) => img.url))];
}

interface ProductImageCarouselProps {
  images: CarouselImage[] | null | undefined;
  alt: string;
  /** Shown when the product has no photos. */
  fallbackUrl?: string;
  className?: string;
  imageClassName?: string;
  /** Slide through the photos by itself while on screen. */
  autoplay?: boolean;
  /**
   * Let shoppers swipe between photos (default). Turn off for cards inside a row
   * that already scrolls sideways, where a swipe must move the row.
   */
  swipeable?: boolean;
}

/**
 * Product photos in a card: swipe sideways to see each one, dots show where you are.
 * A tap (not a swipe) still opens the product, because Embla cancels the click after a drag.
 */
export function ProductImageCarousel({
  images, alt, fallbackUrl, className, imageClassName, autoplay = false, swipeable = true,
}: ProductImageCarouselProps) {
  const urls = orderProductImages(images);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: autoplay,
    align: "start",
    containScroll: "trimSnaps",
    watchDrag: swipeable,
  });
  const [selected, setSelected] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const touchedRef = useRef(false);

  // Autoplay only while the card is on screen, and never for people who asked for less motion.
  useEffect(() => {
    if (!autoplay || !emblaApi || urls.length < 2 || !rootRef.current) return;
    if (window.matchMedia?.(REDUCED_MOTION_QUERY).matches) return;
    let timer: number | undefined;
    let starter: number | undefined;
    const stop = () => {
      window.clearTimeout(starter);
      window.clearInterval(timer);
    };
    // Cards start at different moments so a grid doesn't flip all at once.
    const start = () => {
      stop();
      starter = window.setTimeout(() => {
        timer = window.setInterval(() => emblaApi.scrollNext(), AUTOPLAY_INTERVAL_MS);
      }, Math.random() * AUTOPLAY_INTERVAL_MS);
    };
    // Once someone swipes a card, it stays where they left it.
    const onTouch = () => {
      touchedRef.current = true;
      stop();
    };
    const root = rootRef.current;
    emblaApi.on("pointerDown", onTouch);
    root.addEventListener("touchstart", onTouch, { passive: true });
    root.addEventListener("pointerdown", onTouch);
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting && !touchedRef.current) start();
      else stop();
    });
    observer.observe(rootRef.current);
    return () => {
      stop();
      observer.disconnect();
      emblaApi.off("pointerDown", onTouch);
      root.removeEventListener("touchstart", onTouch);
      root.removeEventListener("pointerdown", onTouch);
    };
  }, [autoplay, emblaApi, urls.length]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setSelected(emblaApi.selectedScrollSnap());
    onSelect();
    emblaApi.on("select", onSelect).on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect).off("reInit", onSelect);
    };
  }, [emblaApi]);

  if (urls.length === 0) {
    return fallbackUrl ? (
      <FadeInImage src={fallbackUrl} alt={alt} loading="lazy" className={cn("h-full w-full object-cover", imageClassName, className)} />
    ) : (
      <div className={cn("flex h-full w-full items-center justify-center bg-muted", className)} aria-label={alt} role="img">
        <span className="font-display text-3xl font-bold text-muted-foreground/25">
          K<sup className="text-sm">2</sup>
        </span>
      </div>
    );
  }

  if (urls.length === 1) {
    return <FadeInImage src={urls[0]} alt={alt} loading="lazy" className={cn("h-full w-full object-cover", imageClassName, className)} />;
  }

  const firstDot = Math.min(Math.max(selected - Math.floor(MAX_DOTS / 2), 0), Math.max(urls.length - MAX_DOTS, 0));
  const visibleDots = urls.slice(firstDot, firstDot + MAX_DOTS);

  return (
    <div ref={rootRef} className={cn("relative h-full w-full", className)}>
      <div ref={emblaRef} className="h-full w-full overflow-hidden">
        <div className="flex h-full touch-pan-y">
          {urls.map((url, index) => (
            <div key={url} className="h-full min-w-0 flex-[0_0_100%]">
              <FadeInImage
                src={url}
                alt={index === 0 ? alt : `${alt} (${index + 1} of ${urls.length})`}
                loading="lazy"
                draggable={false}
                className={cn("h-full w-full select-none object-cover", imageClassName)}
              />
            </div>
          ))}
        </div>
      </div>
      <div
        className="pointer-events-none absolute bottom-1.5 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full bg-black/30 px-1.5 py-1"
        aria-label={`Photo ${selected + 1} of ${urls.length}`}
      >
        {visibleDots.map((url, i) => (
          <span
            key={url}
            className={cn(
              "h-1.5 rounded-full bg-white transition-all",
              firstDot + i === selected ? "w-3.5" : "w-1.5 opacity-60",
            )}
          />
        ))}
      </div>
    </div>
  );
}
