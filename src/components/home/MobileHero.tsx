import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

import kaftanBlue from "@/assets/products/kaftan-blue.jpg";

export function MobileHero() {
  return (
    <section className="relative mx-4 mt-4 overflow-hidden rounded-2xl">
      {/* Background Image */}
      <div className="relative aspect-[3/4] w-full">
        <img
          src={kaftanBlue}
          alt="Featured Collection"
          className="h-full w-full object-cover object-top"
        />
        
        {/* Overlay Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        {/* Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-6">
          {/* Tag */}
          <span className="mb-2 inline-flex w-fit rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">
            New Collection
          </span>
          
          {/* Title */}
          <h1 className="font-display text-2xl font-bold leading-tight text-white sm:text-3xl">
            RAMADAN/EID<br />
            COLLECTION
          </h1>
          
          {/* Description */}
          <p className="mt-2 max-w-[280px] text-sm leading-relaxed text-white/85">
            Discover premium agbada and kaftan sets crafted for the season of celebration.
          </p>
          
          {/* CTA Button */}
          <Button 
            size="default" 
            variant="secondary"
            className="mt-4 w-fit rounded-full px-6 font-medium"
            asChild
          >
            <Link to="/products">Shop Now</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
