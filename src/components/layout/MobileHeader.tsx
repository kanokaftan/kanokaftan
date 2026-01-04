import { Link } from "react-router-dom";
import { ShoppingCart, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useCart } from "@/hooks/useCart";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export function MobileHeader() {
  const { count: cartCount } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 items-center gap-3 px-4">
        {/* Logo */}
        <Link to="/" className="flex-shrink-0">
          <span className="font-display text-xl font-bold text-primary">
            K<sup className="text-xs">2</sup>
          </span>
        </Link>

        {/* Search Bar */}
        <form onSubmit={handleSearch} className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-full bg-muted/50 pl-9 pr-4 text-sm border-0"
            />
          </div>
        </form>

        {/* Cart */}
        <Link to="/cart" className="relative flex-shrink-0">
          <ShoppingCart className="h-6 w-6 text-foreground" />
          {cartCount > 0 && (
            <Badge className="absolute -right-2 -top-2 h-5 w-5 rounded-full p-0 text-[10px] flex items-center justify-center">
              {cartCount > 9 ? "9+" : cartCount}
            </Badge>
          )}
        </Link>
      </div>
    </header>
  );
}
