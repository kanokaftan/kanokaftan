import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useProducts } from "@/hooks/useProducts";
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel";
import { useEffect, useState, useCallback } from "react";
import Autoplay from "embla-carousel-autoplay";

import kaftanBlue from "@/assets/products/kaftan-blue.jpg";
import kaftanWhite from "@/assets/products/kaftan-white.jpg";
import kaftanGrey from "@/assets/products/kaftan-grey.jpg";

const fallbackSlides = [
  {
    image: kaftanBlue,
    tag: "New Collection",
    title: "RAMADAN/EID\nCOLLECTION",
    description: "Discover premium agbada and kaftan sets crafted for the season of celebration.",
  },
  {
    image: kaftanWhite,
    tag: "Premium Quality",
    title: "ELEGANT\nKAFTAN",
    description: "Handcrafted with the finest fabrics for a look that commands respect.",
  },
  {
    image: kaftanGrey,
    tag: "Best Sellers",
    title: "CLASSIC\nAGBADA",
    description: "Timeless designs that blend tradition with contemporary style.",
  },
];

export function MobileHero() {
  const { data } = useProducts({ featured: true, limit: 5 });
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [autoplayPlugin] = useState(() => 
    Autoplay({ delay: 4000, stopOnInteraction: false })
  );

  const slides = data?.products?.length 
    ? data.products.map((product, index) => ({
        image: product.product_images?.[0]?.url || fallbackSlides[index % fallbackSlides.length].image,
        tag: "Featured",
        title: product.name?.toUpperCase().replace(/ /g, '\n') || "FEATURED\nPRODUCT",
        description: product.description?.slice(0, 80) || `Premium ${product.category?.name || 'attire'} from ${product.vendor?.store_name || 'our vendors'}.`,
        slug: product.slug,
      }))
    : fallbackSlides.map(slide => ({ ...slide, slug: undefined }));

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

  return (
    <section className="relative mx-4 mt-4 overflow-hidden rounded-2xl">
      <Carousel 
        opts={{ loop: true }} 
        plugins={[autoplayPlugin]}
        className="w-full"
        setApi={setApi}
      >
        <CarouselContent>
          {slides.map((slide, index) => (
            <CarouselItem key={index}>
              <div className="relative aspect-[3/4] w-full">
                <img
                  src={slide.image}
                  alt={slide.title}
                  className="h-full w-full object-cover object-top"
                />
                
                {/* Overlay Gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
                
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-end p-6">
                  {/* Tag */}
                  <span className="mb-2 inline-flex w-fit rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
                    {slide.tag}
                  </span>
                  
                  {/* Title */}
                  <h1 className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl whitespace-pre-line">
                    {slide.title}
                  </h1>
                  
                  {/* Description */}
                  <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-white/85">
                    {slide.description}
                  </p>
                  
                  {/* CTA Button */}
                  <Button 
                    size="default" 
                    variant="secondary"
                    className="mt-4 w-fit rounded-full px-6 font-medium"
                    asChild
                  >
                    <Link to={slide.slug ? `/products/${slide.slug}` : "/products"}>
                      {slide.slug ? "View Product" : "Shop Now"}
                    </Link>
                  </Button>
                </div>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>
      
      {/* Carousel Indicators */}
      <div className="absolute bottom-24 left-6 flex gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollTo(index)}
            className={`h-2 rounded-full transition-all duration-300 ${
              current === index 
                ? "bg-white w-6" 
                : "bg-white/50 w-2 hover:bg-white/70"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </section>
  );
}