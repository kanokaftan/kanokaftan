import { Link } from "react-router-dom";
import { Clock, ChevronRight } from "lucide-react";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

interface RecentlyViewedProps {
  excludeProductId?: string;
}

export function RecentlyViewed({ excludeProductId }: RecentlyViewedProps) {
  const { recentProducts, clearAll } = useRecentlyViewed();
  
  const filteredProducts = recentProducts.filter(p => p.id !== excludeProductId);
  
  if (filteredProducts.length === 0) return null;

  return (
    <section className="py-8">
      <div className="container">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-muted-foreground" />
            <h2 className="text-lg font-semibold">Recently Viewed</h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAll}
            className="text-muted-foreground text-xs"
          >
            Clear All
          </Button>
        </div>

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {filteredProducts.map((product) => (
              <Link
                key={product.id}
                to={`/products/${product.slug}`}
                className="w-[140px] flex-shrink-0 group"
              >
                <Card className="overflow-hidden border-0 shadow-sm transition-shadow hover:shadow-md">
                  <div className="aspect-square overflow-hidden bg-muted">
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-muted-foreground text-xs">
                        No Image
                      </div>
                    )}
                  </div>
                  <CardContent className="p-3">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-sm font-bold text-primary mt-1">{formatPrice(product.price)}</p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </section>
  );
}
