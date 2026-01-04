import { Link } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// Placeholder products - will be fetched from database later
const featuredProducts = [
  {
    id: "1",
    name: "Royal Blue Agbada Set",
    slug: "royal-blue-agbada-set",
    price: 85000,
    image: "https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&q=80",
    vendor: "Kano Tailors",
  },
  {
    id: "2",
    name: "Embroidered White Kaftan",
    slug: "embroidered-white-kaftan",
    price: 45000,
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=400&q=80",
    vendor: "Heritage Clothiers",
  },
  {
    id: "3",
    name: "Gold Dashiki Shirt",
    slug: "gold-dashiki-shirt",
    price: 25000,
    image: "https://images.unsplash.com/photo-1580618432485-38f3aa97a913?w=400&q=80",
    vendor: "Afro Styles",
  },
  {
    id: "4",
    name: "Traditional Cap Set",
    slug: "traditional-cap-set",
    price: 15000,
    image: "https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?w=400&q=80",
    vendor: "Kano Caps",
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
