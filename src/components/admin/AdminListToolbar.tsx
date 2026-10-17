import { Loader2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ListChip<F extends string> {
  value: F;
  label: string;
  /** Shown next to the label when known. */
  count?: number;
}

interface AdminListToolbarProps<F extends string> {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder: string;
  chips: ListChip<F>[];
  filter: F;
  onFilterChange: (value: F) => void;
  /** Total rows matching the search and filter. */
  total?: number;
  noun: [singular: string, plural: string];
  busy?: boolean;
}

/** Search box, filter chips and result count shared by the admin lists (filtering happens in the database). */
export function AdminListToolbar<F extends string>({
  search, onSearchChange, placeholder, chips, filter, onFilterChange, total, noun, busy,
}: AdminListToolbarProps<F>) {
  return (
    <div className="mb-4 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="search"
          inputMode="search"
          placeholder={placeholder}
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 rounded-xl pl-9 pr-9"
        />
        {busy ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : search ? (
          <button type="button" onClick={() => onSearchChange("")} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground hover:bg-muted" aria-label="Clear search">
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {chips.map((chip) => (
          <button
            key={chip.value}
            type="button"
            onClick={() => onFilterChange(chip.value)}
            className={cn(
              "shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
              filter === chip.value ? "border-primary bg-primary text-primary-foreground" : "bg-card text-foreground hover:bg-muted",
            )}
          >
            {chip.label}
            {chip.count !== undefined && <span className="ml-1 opacity-70">{chip.count}</span>}
          </button>
        ))}
      </div>
      {total !== undefined && (
        <p className="text-sm text-muted-foreground">
          {total.toLocaleString()} {total === 1 ? noun[0] : noun[1]}
        </p>
      )}
    </div>
  );
}
