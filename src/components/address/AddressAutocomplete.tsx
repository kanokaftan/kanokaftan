import { forwardRef, useEffect, useId, useRef, useState } from "react";
import { Loader2, MapPin, PenLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { NIGERIAN_STATES } from "@/lib/nigeria";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface AddressSuggestion {
  label: string;
  street: string;
  city: string;
  /** Matched to our state list when possible ("" if unknown). */
  state: string;
  latitude: number;
  longitude: number;
}

/** Wait this long after the last key press before searching (saves requests while typing). */
const SEARCH_DELAY_MS = 350;
const MIN_QUERY_LENGTH = 3;

/** Answers already fetched this session, so going back and forth is instant. */
const cache = new Map<string, AddressSuggestion[]>();

function toKnownState(state: string): string {
  return (NIGERIAN_STATES as readonly string[]).find((s) => s.toLowerCase() === state.toLowerCase()) ?? "";
}

async function fetchSuggestions(query: string, state?: string): Promise<AddressSuggestion[]> {
  const key = `${state ?? ""}|${query.toLowerCase()}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const { data, error } = await supabase.functions.invoke("geocode-address", { body: { action: "suggest", query, state } });
  if (error) throw error;
  const list = ((data?.suggestions ?? []) as AddressSuggestion[]).map((s) => ({ ...s, state: toKnownState(s.state) }));
  cache.set(key, list);
  return list;
}

interface AddressAutocompleteProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "onSelect"> {
  value: string;
  onChange: (value: string) => void;
  /** Called when a suggestion is picked: fill city/state (and keep coordinates) from it. */
  onSelectSuggestion: (suggestion: AddressSuggestion) => void;
  /** Narrows suggestions to a state once one is chosen. */
  stateHint?: string;
}

/**
 * Street address box with suggestions as you type (like a map app). If your
 * address isn't listed, just keep typing: what you type is saved as it is.
 */
export const AddressAutocomplete = forwardRef<HTMLInputElement, AddressAutocompleteProps>(function AddressAutocomplete(
  { value, onChange, onSelectSuggestion, stateHint, className, onBlur, onFocus, ...inputProps },
  ref,
) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [active, setActive] = useState(-1);
  const justPicked = useRef(false);
  const blurTimer = useRef<number>();

  useEffect(() => {
    const query = value.trim();
    if (justPicked.current) {
      justPicked.current = false;
      return;
    }
    if (query.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      fetchSuggestions(query, stateHint || undefined)
        .then((list) => {
          if (cancelled) return;
          setSuggestions(list);
          setActive(-1);
        })
        .catch((error) => {
          // Not fatal: the person can still type their address.
          console.warn("[AddressAutocomplete] suggestions failed", error);
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => !cancelled && setLoading(false));
    }, SEARCH_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [value, stateHint]);

  const pick = (suggestion: AddressSuggestion) => {
    justPicked.current = true;
    onChange(suggestion.street);
    onSelectSuggestion(suggestion);
    setOpen(false);
    setSuggestions([]);
  };

  const showList = open && value.trim().length >= MIN_QUERY_LENGTH && (loading || suggestions.length > 0 || value.trim().length > 0);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showList || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && active >= 0) {
      e.preventDefault();
      pick(suggestions[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={ref}
        {...inputProps}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        className={cn("pl-9 pr-9", className)}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={(e) => {
          window.clearTimeout(blurTimer.current);
          setOpen(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          // Let a tap on a suggestion register before closing.
          blurTimer.current = window.setTimeout(() => setOpen(false), 150);
          onBlur?.(e);
        }}
        onKeyDown={onKeyDown}
      />
      {loading && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}

      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-2xl border bg-popover py-1 shadow-xl animate-in fade-in-0 slide-in-from-top-1 duration-150"
          data-no-pull-refresh
        >
          {suggestions.map((s, i) => (
            <li key={`${s.label}-${i}`} id={`${listId}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(s)}
                className={cn("flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-muted active:bg-muted", i === active && "bg-muted")}
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{s.street}</span>
                  <span className="block truncate text-xs text-muted-foreground">{[s.city, s.state].filter(Boolean).join(", ")}</span>
                </span>
              </button>
            </li>
          ))}
          {loading && suggestions.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Searching…</li>}
          {/* Always offer to keep exactly what was typed */}
          <li role="option" aria-selected={false}>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setOpen(false)}
              className="flex w-full items-start gap-2.5 border-t px-3 py-2.5 text-left hover:bg-muted active:bg-muted"
            >
              <PenLine className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block truncate text-sm">Use "{value.trim()}"</span>
                <span className="block text-xs text-muted-foreground">Not listed? Keep what you typed and fill in the rest below</span>
              </span>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
});
