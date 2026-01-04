import { Link } from "react-router-dom";
import { Heart, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Product } from "@/hooks/useProducts";

interface ProductCardProps {
  product: Product;
}

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

export function ProductCard({ product }: ProductCardProps) {
  const primaryImage = product.product_images?.find((img) => img.is_primary);
  const imageUrl = primaryImage?.url || product.product_images?.[0]?.url;
  const hasDiscount = product.compare_at_price && product.compare_at_price > product.price;

  return (
    <Card className="group overflow-hidden border-0 shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
            No Image
          </div>
        )}
        
        {hasDiscount && (
          <Badge className="absolute left-3 top-3 bg-destructive text-destructive-foreground">
            Sale
          </Badge>
        )}

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
        {product.category && (
          <p className="text-xs text-muted-foreground">{product.category.name}</p>
        )}
        <Link
          to={`/products/${product.slug}`}
          className="mt-1 block font-medium text-foreground hover:underline line-clamp-2"
        >
          {product.name}
        </Link>
        {product.vendor?.full_name && (
          <p className="mt-1 text-xs text-muted-foreground">by {product.vendor.full_name}</p>
        )}
        <div className="mt-2 flex items-center gap-2">
          <p className="font-display text-lg font-bold text-foreground">
            {formatPrice(product.price)}
          </p>
          {hasDiscount && (
            <p className="text-sm text-muted-foreground line-through">
              {formatPrice(product.compare_at_price!)}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
