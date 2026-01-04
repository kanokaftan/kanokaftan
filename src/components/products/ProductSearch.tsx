import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function ProductSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchValue, setSearchValue] = useState(searchParams.get("search") || "");

  useEffect(() => {
    setSearchValue(searchParams.get("search") || "");
  }, [searchParams]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const newParams = new URLSearchParams(searchParams);
    if (searchValue.trim()) {
      newParams.set("search", searchValue.trim());
    } else {
      newParams.delete("search");
    }
    newParams.delete("page"); // Reset to page 1
    setSearchParams(newParams);
  };

  const clearSearch = () => {
    setSearchValue("");
    const newParams = new URLSearchParams(searchParams);
    newParams.delete("search");
    newParams.delete("page");
    setSearchParams(newParams);
  };

  return (
    <form onSubmit={handleSearch} className="relative w-full max-w-sm">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search products..."
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        className="pl-10 pr-10"
      />
      {searchValue && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2"
          onClick={clearSearch}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </form>
  );
}
