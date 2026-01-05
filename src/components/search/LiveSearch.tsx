import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, Loader2, TrendingUp } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useSearchProducts } from "@/hooks/useSearchProducts";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { cn } from "@/lib/utils";

function formatPrice(amount: number): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 0,
  }).format(amount);
}

interface LiveSearchProps {
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function LiveSearch({ className, placeholder = "Search products...", autoFocus }: LiveSearchProps) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { data: results = [], isLoading, isFetching } = useSearchProducts(query, isOpen);
  const { recentProducts } = useRecentlyViewed();

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Close on escape
  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setIsOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/products?search=${encodeURIComponent(query.trim())}`);
      setIsOpen(false);
      setQuery("");
    }
  };

  const handleResultClick = (slug: string) => {
    navigate(`/products/${slug}`);
    setIsOpen(false);
    setQuery("");
  };

  const showResults = isOpen && (query.length >= 2 || (query.length === 0 && recentProducts.length > 0));
  const showRecent = query.length === 0 && recentProducts.length > 0;
  const showLoading = (isLoading || isFetching) && query.length >= 2;

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            type="search"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setIsOpen(true)}
            autoFocus={autoFocus}
            className="h-10 w-full rounded-full bg-muted/50 pl-10 pr-10 text-sm border-0 focus-visible:ring-2"
          />
          {query && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
              onClick={() => setQuery("")}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </form>

      {/* Dropdown */}
      {showResults && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border bg-popover shadow-lg animate-in fade-in-0 slide-in-from-top-2">
          {/* Loading */}
          {showLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Recent searches */}
          {showRecent && !showLoading && (
            <div className="p-2">
              <p className="px-2 py-1 text-xs font-medium text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                Recently Viewed
              </p>
              {recentProducts.slice(0, 5).map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleResultClick(product.slug)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                >
                  {product.imageUrl && (
                    <img
                      src={product.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{formatPrice(product.price)}</p>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Search results */}
          {!showRecent && !showLoading && results.length > 0 && (
            <div className="p-2">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => handleResultClick(result.slug)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-muted"
                >
                  {result.imageUrl && (
                    <img
                      src={result.imageUrl}
                      alt=""
                      className="h-10 w-10 rounded-md object-cover"
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{result.name}</p>
                    <div className="flex items-center gap-2">
                      {result.category && (
                        <span className="text-xs text-muted-foreground">{result.category}</span>
                      )}
                      <span className="text-xs font-medium text-primary">{formatPrice(result.price)}</span>
                    </div>
                  </div>
                </button>
              ))}
              <button
                onClick={handleSubmit}
                className="mt-2 w-full rounded-lg bg-muted p-2 text-center text-sm text-muted-foreground hover:bg-muted/80"
              >
                View all results for "{query}"
              </button>
            </div>
          )}

          {/* No results */}
          {!showRecent && !showLoading && query.length >= 2 && results.length === 0 && (
            <div className="p-6 text-center">
              <p className="text-sm text-muted-foreground">No products found for "{query}"</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
