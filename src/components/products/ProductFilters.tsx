import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Category } from "@/hooks/useProducts";

interface ProductFiltersProps {
  categories: Category[];
  isLoading?: boolean;
}

export function ProductFilters({ categories, isLoading }: ProductFiltersProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentCategory = searchParams.get("category") || "";

  const handleCategoryChange = (slug: string) => {
    const newParams = new URLSearchParams(searchParams);
    if (slug) {
      newParams.set("category", slug);
    } else {
      newParams.delete("category");
    }
    newParams.delete("page"); // Reset to page 1
    setSearchParams(newParams);
  };

  if (isLoading) {
    return (
      <div className="flex flex-wrap gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-9 w-20 animate-pulse rounded-md bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={currentCategory === "" ? "default" : "outline"}
        size="sm"
        onClick={() => handleCategoryChange("")}
        className={cn(
          "transition-colors",
          currentCategory === "" && "bg-foreground text-background hover:bg-foreground/90"
        )}
      >
        All
      </Button>
      {categories.map((category) => (
        <Button
          key={category.id}
          variant={currentCategory === category.slug ? "default" : "outline"}
          size="sm"
          onClick={() => handleCategoryChange(category.slug)}
          className={cn(
            "transition-colors",
            currentCategory === category.slug && "bg-foreground text-background hover:bg-foreground/90"
          )}
        >
          {category.name}
        </Button>
      ))}
    </div>
  );
}
