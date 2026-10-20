import { useState } from "react";
import { Check, Palette, Plus, Sparkles, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { COMMON_COLORS, LIGHT_COLORS, sortSizes, type SizeGroup } from "@/lib/productOptions";
import { nearestColorName } from "@/lib/photoColors";
import { cn } from "@/lib/utils";

const MAX_CUSTOM_LENGTH = 20;

function Chip({ selected, onClick, children, className, soft = false }: { selected: boolean; onClick: () => void; children: React.ReactNode; className?: string; soft?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        "inline-flex min-h-10 min-w-[2.75rem] items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors active:scale-95",
        selected
          ? soft ? "border-2 border-primary bg-primary/5 text-foreground" : "border-primary bg-primary text-primary-foreground"
          : "bg-background hover:bg-muted",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** Small "+ Other" field for a value that isn't in the presets. */
function AddOther({ placeholder, onAdd }: { placeholder: string; onAdd: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const add = () => {
    const clean = value.trim().slice(0, MAX_CUSTOM_LENGTH);
    if (clean) onAdd(clean);
    setValue("");
    setOpen(false);
  };
  if (!open) {
    return (
      <Chip selected={false} onClick={() => setOpen(true)} className="border-dashed text-muted-foreground">
        <Plus className="h-4 w-4" />Other
      </Chip>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } if (e.key === "Escape") setOpen(false); }}
        onBlur={add}
        placeholder={placeholder}
        className="h-10 w-28"
        maxLength={MAX_CUSTOM_LENGTH}
      />
    </div>
  );
}

function toggle(list: string[], value: string): string[] {
  return list.some((v) => v.toLowerCase() === value.toLowerCase())
    ? list.filter((v) => v.toLowerCase() !== value.toLowerCase())
    : [...list, value];
}

/** Tap sizes to select several; tabs when there are groups (Men / Women). */
export function SizePicker({ groups, value, onChange }: { groups: SizeGroup[]; value: string[]; onChange: (sizes: string[]) => void }) {
  const [tab, setTab] = useState(0);
  const group = groups[tab];
  const has = (s: string) => value.some((v) => v.toLowerCase() === s.toLowerCase());
  const presetValues = new Set(groups.flatMap((g) => g.sizes.map((s) => s.toLowerCase())));
  const extras = value.filter((v) => !presetValues.has(v.toLowerCase()));
  const allSelected = group ? group.sizes.every(has) : false;
  const set = (next: string[]) => onChange(sortSizes(next));

  return (
    <div className="space-y-2.5">
      {groups.length > 1 && (
        <div role="tablist" className="inline-flex rounded-full bg-muted p-1">
          {groups.map((g, i) => {
            const count = g.sizes.filter(has).length;
            return (
              <button
                key={g.label}
                type="button"
                role="tab"
                aria-selected={tab === i}
                onClick={() => setTab(i)}
                className={cn("rounded-full px-4 py-1.5 text-sm font-medium transition-colors", tab === i ? "bg-background shadow-sm" : "text-muted-foreground")}
              >
                {g.label}{count > 0 && <span className="ml-1 text-primary">· {count}</span>}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {group?.sizes.map((s) => (
          <Chip key={s} selected={has(s)} onClick={() => set(toggle(value, s))}>{s}</Chip>
        ))}
        {extras.map((s) => (
          <Chip key={s} selected onClick={() => set(toggle(value, s))}>{s}<X className="h-3.5 w-3.5" /></Chip>
        ))}
        <AddOther placeholder="e.g. 46" onAdd={(s) => set(has(s) ? value : [...value, s])} />
      </div>
      {group && group.sizes.length > 2 && (
        <button
          type="button"
          onClick={() => set(allSelected ? value.filter((v) => !group.sizes.some((s) => s.toLowerCase() === v.toLowerCase())) : [...value, ...group.sizes.filter((s) => !has(s))])}
          className="text-xs font-medium text-primary"
        >
          {allSelected ? "Clear these" : groups.length > 1 ? `Select all ${group.label} sizes` : "Select all"}
        </button>
      )}
    </div>
  );
}

const COLLAPSED_COLORS = 12;

/** ["Black", "Red", "Navy"] -> "Black, Red and Navy". */
function listNames(names: string[]): string {
  return names.length > 1 ? `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}` : names.join("");
}

/**
 * Tap colours to select several, with swatches. Colours found in the photos are
 * marked "from photo"; "Pick a shade" opens the phone's colour picker and uses the nearest name.
 */
export function ColorPicker({ value, onChange, detected = [] }: { value: string[]; onChange: (colors: string[]) => void; detected?: string[] }) {
  const [showAll, setShowAll] = useState(false);
  const has = (c: string) => value.some((v) => v.toLowerCase() === c.toLowerCase());
  const fromPhoto = (c: string) => detected.some((d) => d.toLowerCase() === c.toLowerCase());
  const extras = value.filter((v) => !COMMON_COLORS.some((c) => c.name.toLowerCase() === v.toLowerCase()));
  // Selected and detected colours always show, even when the list is collapsed.
  const visible = showAll
    ? COMMON_COLORS
    : COMMON_COLORS.filter((c, i) => i < COLLAPSED_COLORS || has(c.name) || fromPhoto(c.name));
  const addShade = (hex: string) => {
    const name = nearestColorName(hex);
    if (!has(name)) onChange([...value, name]);
  };

  return (
    <div className="space-y-2.5">
      {detected.length > 0 && (
        <p className="flex items-center gap-1.5 rounded-xl bg-primary/5 px-3 py-2 text-xs">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span>We spotted <span className="font-semibold">{listNames(detected)}</span> in your {detected.length > 1 ? "photos" : "photo"}. Tap to remove if it's wrong.</span>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {visible.map((c) => (
          <Chip key={c.name} soft selected={has(c.name)} onClick={() => onChange(toggle(value, c.name))} className="pl-2">
            <span className="relative h-5 w-5 shrink-0 rounded-full border border-black/15" style={{ background: c.swatch }}>
              {has(c.name) && <Check className={cn("absolute inset-0 m-auto h-3.5 w-3.5", LIGHT_COLORS.has(c.name) ? "text-black" : "text-white")} />}
            </span>
            {c.name}
            {fromPhoto(c.name) && <Sparkles className="h-3.5 w-3.5 text-primary" aria-label="found in photo" />}
          </Chip>
        ))}
        {extras.map((c) => (
          <Chip key={c} selected onClick={() => onChange(toggle(value, c))}>{c}<X className="h-3.5 w-3.5" /></Chip>
        ))}
        <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-dashed px-3 text-sm font-medium text-muted-foreground hover:bg-muted">
          <Palette className="h-4 w-4" />Pick a shade
          <input type="color" className="sr-only" onChange={(e) => addShade(e.target.value)} aria-label="Pick a colour" />
        </label>
        <AddOther placeholder="e.g. Ash" onAdd={(c) => onChange(has(c) ? value : [...value, c])} />
      </div>
      {COMMON_COLORS.length > COLLAPSED_COLORS && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="text-xs font-medium text-primary">
          {showAll ? "Fewer colours" : "More colours"}
        </button>
      )}
    </div>
  );
}
