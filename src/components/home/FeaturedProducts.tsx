import { Link } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

import kaftanBlue from "@/assets/products/kaftan-blue.jpg";
import kaftanWhite from "@/assets/products/kaftan-white.jpg";
import kaftanGrey from "@/assets/products/kaftan-grey.jpg";

// Placeholder products - will be fetched from database later
const featuredProducts = [
  {
    id: "1",
    name: "Sky Blue Embroidered Kaftan",
    slug: "sky-blue-embroidered-kaftan",
    price: 65000,
    image: kaftanBlue,
    vendor: "Kano Tailors",
  },
  {
    id: "2",
    name: "Premium White Senator",
    slug: "premium-white-senator",
    price: 55000,
    image: kaftanWhite,
    vendor: "L&K Fashion",
  },
  {
    id: "3",
    name: "Grey Patterned Kaftan",
    slug: "grey-patterned-kaftan",
    price: 48000,
    image: kaftanGrey,
    vendor: "Heritage Clothiers",
  },
  {
    id: "4",
    name: "Sky Blue Embroidered Kaftan",
    slug: "sky-blue-embroidered-kaftan-2",
    price: 62000,
    image: kaftanBlue,
    vendor: "Afro Styles",
  },
];

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function FeaturedProducts() {
  return (
    <section className="bg-muted/50 py-16 md:py-24">
      <div className="container">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <h2 className="font-display text-3xl font-bold text-primary md:text-4xl">
              Featured Products
            </h2>
            <p className="mt-4 text-muted-foreground">
              Handpicked selections from our best vendors
            </p>
          </div>
          <Button variant="link" asChild className="hidden sm:flex">
            <Link to="/products">View All Products →</Link>
          </Button>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featuredProducts.map((product) => (
            <Card key={product.id} className="group overflow-hidden border-0 shadow-sm">
              <div className="relative aspect-[3/4] overflow-hidden bg-muted">
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute right-3 top-3 flex flex-col gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                  <Button size="icon" variant="secondary" className="h-9 w-9">
                    <Heart className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="secondary" className="h-9 w-9">
                    <ShoppingCart className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground">{product.vendor}</p>
                <Link 
                  to={`/products/${product.slug}`}
                  className="mt-1 block font-medium text-primary hover:underline"
                >
                  {product.name}
                </Link>
                <p className="mt-2 font-display text-lg font-bold text-primary">
                  {formatPrice(product.price)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="mt-8 text-center sm:hidden">
          <Button variant="outline" asChild>
            <Link to="/products">View All Products</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
