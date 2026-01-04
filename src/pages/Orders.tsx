import { MobileLayout } from "@/components/layout/MobileLayout";
import { Package } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function Orders() {
  // TODO: Fetch actual orders from database
  const orders: any[] = [];

  return (
    <MobileLayout>
      <div className="px-4 py-6">
        <h1 className="font-display text-xl font-bold text-foreground">My Orders</h1>
        
        {orders.length === 0 ? (
          <div className="mt-12 flex flex-col items-center justify-center text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-medium text-foreground">No orders yet</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              When you place orders, they will appear here.
            </p>
            <Button className="mt-6" asChild>
              <Link to="/products">Start Shopping</Link>
            </Button>
          </div>
        ) : (
          <div className="mt-4 space-y-4">
            {/* Order cards will go here */}
          </div>
        )}
      </div>
    </MobileLayout>
  );
}
