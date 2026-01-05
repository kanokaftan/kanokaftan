import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Clock, Flame, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { useFlashSales, type FlashSale } from "@/hooks/useFlashSales";
import { cn } from "@/lib/utils";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

function useCountdown(endTime: string) {
  const [timeLeft, setTimeLeft] = useState({ hours: 0, minutes: 0, seconds: 0, expired: false });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = new Date(endTime).getTime() - Date.now();
      
      if (difference <= 0) {
        return { hours: 0, minutes: 0, seconds: 0, expired: true };
      }

      return {
        hours: Math.floor(difference / (1000 * 60 * 60)),
        minutes: Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((difference % (1000 * 60)) / 1000),
        expired: false,
      };
    };

    setTimeLeft(calculateTimeLeft());
    
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [endTime]);

  return timeLeft;
}

function CountdownTimer({ endTime }: { endTime: string }) {
  const { hours, minutes, seconds, expired } = useCountdown(endTime);

  if (expired) {
    return <span className="text-destructive font-medium">Expired</span>;
  }

  return (
    <div className="flex items-center gap-1 font-mono text-sm">
      <div className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
        {String(hours).padStart(2, '0')}
      </div>
      <span className="text-muted-foreground">:</span>
      <div className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
        {String(minutes).padStart(2, '0')}
      </div>
      <span className="text-muted-foreground">:</span>
      <div className="bg-primary/10 text-primary px-1.5 py-0.5 rounded">
        {String(seconds).padStart(2, '0')}
      </div>
    </div>
  );
}

function FlashSaleCard({ sale }: { sale: FlashSale }) {
  if (!sale.product) return null;

  const primaryImage = sale.product.product_images?.find(img => img.is_primary);
  const imageUrl = primaryImage?.url || sale.product.product_images?.[0]?.url;
  const discount = Math.round(((sale.original_price - sale.sale_price) / sale.original_price) * 100);
  const soldPercentage = sale.max_quantity 
    ? Math.min(100, (sale.sold_quantity / sale.max_quantity) * 100)
    : 0;
  const isAlmostGone = sale.max_quantity && sale.sold_quantity >= sale.max_quantity * 0.8;

  return (
    <Link to={`/products/${sale.product.slug}`} className="block w-[200px] flex-shrink-0">
      <Card className="overflow-hidden border-0 shadow-sm transition-all hover:shadow-lg hover:scale-[1.02] group">
        <div className="relative aspect-square overflow-hidden bg-muted">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={sale.product.name}
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
              No Image
            </div>
          )}
          
          {/* Discount Badge */}
          <Badge className="absolute left-2 top-2 bg-destructive animate-pulse">
            <Flame className="h-3 w-3 mr-1" />
            {discount}% OFF
          </Badge>

          {/* Almost Gone Badge */}
          {isAlmostGone && (
            <Badge variant="secondary" className="absolute right-2 top-2">
              Almost Gone!
            </Badge>
          )}
        </div>

        <CardContent className="p-3">
          <p className="text-sm font-medium line-clamp-2">{sale.product.name}</p>
          
          {/* Prices */}
          <div className="flex items-center gap-2 mt-2">
            <span className="text-lg font-bold text-destructive">
              {formatPrice(sale.sale_price)}
            </span>
            <span className="text-xs text-muted-foreground line-through">
              {formatPrice(sale.original_price)}
            </span>
          </div>

          {/* Progress Bar */}
          {sale.max_quantity && (
            <div className="mt-2">
              <Progress value={soldPercentage} className="h-1.5" />
              <p className="text-[10px] text-muted-foreground mt-1">
                {sale.sold_quantity}/{sale.max_quantity} sold
              </p>
            </div>
          )}

          {/* Countdown */}
          <div className="mt-2 flex items-center gap-1">
            <Clock className="h-3 w-3 text-muted-foreground" />
            <CountdownTimer endTime={sale.ends_at} />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

export function FlashSalesSection() {
  const { data: flashSales = [], isLoading } = useFlashSales();

  if (isLoading) {
    return (
      <section className="py-6 bg-gradient-to-r from-destructive/5 to-orange-500/5">
        <div className="container">
          <div className="flex items-center gap-2 mb-4">
            <Skeleton className="h-6 w-32" />
          </div>
          <div className="flex gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="w-[200px] h-[280px] rounded-lg" />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (flashSales.length === 0) return null;

  return (
    <section className="py-6 bg-gradient-to-r from-destructive/5 to-orange-500/5">
      <div className="container">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flame className="h-5 w-5 text-destructive animate-pulse" />
            <h2 className="text-lg font-bold">Flash Deals</h2>
            <Badge variant="destructive" className="animate-pulse">
              Limited Time!
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View All <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-4 pb-4">
            {flashSales.map((sale) => (
              <FlashSaleCard key={sale.id} sale={sale} />
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </section>
  );
}
