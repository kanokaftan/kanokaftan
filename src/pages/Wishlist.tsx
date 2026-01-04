import { MobileLayout } from "@/components/layout/MobileLayout";
import { Heart } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Wishlist() {
  // TODO: Fetch actual wishlist from database
  const wishlistItems: any[] = [];

  return (
    <MobileLayout>
      <div className="px-4 py-6">
        <h1 className="font-display text-xl font-bold text-foreground">Favorites</h1>
        
        {wishlistItems.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <Heart className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium text-foreground">No favorites yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tap the heart icon on products to save them here.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/products">Browse Products</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            {/* Wishlist items will go here */}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
