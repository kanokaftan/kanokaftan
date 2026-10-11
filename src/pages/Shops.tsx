import { useEffect, useState } from "react";
import { Search, Store } from "lucide-react";
import { MobileLayout } from "@/components/layout/MobileLayout";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ShopCard } from "@/components/shop/ShopCard";
import { useShops } from "@/hooks/useShops";
import { useDocumentMeta } from "@/hooks/useDocumentMeta";

export default function Shops() {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const { data: shops, isLoading } = useShops(search, 60);

  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), 300);
    return () => clearTimeout(timer);
  }, [input]);

  useDocumentMeta({
    title: "Shops - Kano Kaftan",
    description: "Browse shops selling clothing, fabrics, shoes, caps and accessories on Kano Kaftan.",
  });

  return (
    <MobileLayout>
      <div className="px-4 py-6 pb-24 space-y-4">
        <div>
          <h1 className="font-display text-xl font-bold">Shops</h1>
          <p className="text-sm text-muted-foreground">Tailors and sellers on Kano Kaftan. Verified shops first.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Search shops" className="pl-9" />
        </div>

        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-40 rounded-xl" />
            ))}
          </div>
        ) : !shops?.length ? (
          <div className="flex flex-col items-center py-16 text-center text-muted-foreground">
            <Store className="mb-3 h-12 w-12 opacity-50" />
            <p>{search ? "No shops match your search." : "No shops yet."}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((shop) => (
              <ShopCard key={shop.id} shop={shop} />
            ))}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
