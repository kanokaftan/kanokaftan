import { Link, useSearchParams } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useCategories } from "@/hooks/useProducts";
import { Skeleton } from "@/components/ui/skeleton";

export function CategoryPills() {
  const [searchParams] = useSearchParams();
  const currentCategory = searchParams.get("category");
  const { data: categories, isLoading } = useCategories();

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto px-4 py-4 scrollbar-hide">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 flex-shrink-0 rounded-full" />
        ))}
      </div>
    );
  }

  const allCategories = [
    { id: "all", name: "All", slug: "" },
    ...(categories || []),
  ];

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-4 scrollbar-hide">
      {allCategories.map((category) => {
        const isActive = category.slug === "" 
          ? !currentCategory 
          : currentCategory === category.slug;
        
        return (
          <Link
            key={category.id}
            to={category.slug ? `/products?category=${category.slug}` : "/"}
            className={cn(
              "flex-shrink-0 rounded-full px-5 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {category.name}
          </Link>
        );
      })}
    </div>
  );
}
