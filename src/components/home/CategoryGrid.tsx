import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

const categories = [
  {
    name: "Agbada",
    slug: "agbada",
    description: "Grand flowing robes",
    image: "https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=600&q=80",
  },
  {
    name: "Kaftan",
    slug: "kaftan",
    description: "Elegant traditional wear",
    image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&q=80",
  },
  {
    name: "Dashiki",
    slug: "dashiki",
    description: "Colorful West African style",
    image: "https://images.unsplash.com/photo-1580618432485-38f3aa97a913?w=600&q=80",
  },
  {
    name: "Accessories",
    slug: "accessories",
    description: "Complete your look",
    image: "https://images.unsplash.com/photo-1611312449412-6cefac5dc3e4?w=600&q=80",
  },
];

export function CategoryGrid() {
  return (
    <section className="py-16 md:py-24">
      <div className="container">
        <div className="mb-12 text-center">
          <h2 className="font-display text-3xl font-bold text-primary md:text-4xl">
            Shop by Category
          </h2>
          <p className="mt-4 text-muted-foreground">
            Explore our curated collection of traditional Nigerian attire
          </p>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category, index) => (
            <Link
              key={category.slug}
              to={`/products?category=${category.slug}`}
              className={cn(
                "group relative overflow-hidden rounded-lg",
                "aspect-[3/4] bg-muted",
                "transition-transform duration-300 hover:scale-[1.02]"
              )}
            >
              <img
                src={category.image}
                alt={category.name}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-primary-foreground">
                <h3 className="font-display text-xl font-bold">{category.name}</h3>
                <p className="mt-1 text-sm text-primary-foreground/80">
                  {category.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
