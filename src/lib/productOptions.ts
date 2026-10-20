/**
 * Ready-made size and colour choices for the seller's product form, so sellers
 * tap instead of typing. Which ones show depends on the category.
 */

export interface SizeGroup {
  /** Tab label, e.g. "Men". */
  label: string;
  sizes: string[];
}

export interface CategoryOptions {
  /** Size groups to offer (empty = this kind of product has no sizes). */
  sizeGroups: SizeGroup[];
  /** Whether colours make sense for this kind of product. */
  colors: boolean;
  /** What "size" means here, e.g. "Bottle size". */
  sizeLabel: string;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => String(from + i));

const CLOTHING_LETTERS = ["XS", "S", "M", "L", "XL", "XXL", "XXXL"];

const BY_CATEGORY: Record<string, CategoryOptions> = {
  shoes: {
    sizeLabel: "Sizes",
    colors: true,
    sizeGroups: [
      { label: "Men", sizes: range(40, 45) },
      { label: "Women", sizes: range(35, 42) },
    ],
  },
  caps: { sizeLabel: "Sizes", colors: true, sizeGroups: [{ label: "Cap sizes", sizes: range(20, 24) }] },
  kaftan: {
    sizeLabel: "Sizes",
    colors: true,
    sizeGroups: [
      { label: "Letters", sizes: CLOTHING_LETTERS },
      { label: "Numbers", sizes: ["50", "52", "54", "56", "58", "60", "62"] },
    ],
  },
  boutique: { sizeLabel: "Sizes", colors: true, sizeGroups: [{ label: "Sizes", sizes: CLOTHING_LETTERS }] },
  perfume: { sizeLabel: "Bottle size", colors: false, sizeGroups: [{ label: "Bottle size", sizes: ["10ml", "30ml", "50ml", "100ml", "200ml"] }] },
  bags: { sizeLabel: "Sizes", colors: true, sizeGroups: [] },
  accessories: { sizeLabel: "Sizes", colors: true, sizeGroups: [] },
  fabrics: { sizeLabel: "Sizes", colors: true, sizeGroups: [] },
  textiles: { sizeLabel: "Sizes", colors: true, sizeGroups: [] },
};

const FALLBACK: CategoryOptions = { sizeLabel: "Sizes", colors: true, sizeGroups: [] };

/** Size/colour choices for a category slug (unknown categories get none, but can still add their own). */
export function categoryOptions(slug: string | null | undefined): CategoryOptions {
  return (slug && BY_CATEGORY[slug.toLowerCase()]) || FALLBACK;
}

export const COMMON_COLORS: { name: string; swatch: string }[] = [
  { name: "Black", swatch: "#111111" },
  { name: "White", swatch: "#FFFFFF" },
  { name: "Cream", swatch: "#F3E9D2" },
  { name: "Brown", swatch: "#7B4A2A" },
  { name: "Navy", swatch: "#1F2A4D" },
  { name: "Blue", swatch: "#2F6FD6" },
  { name: "Sky blue", swatch: "#8EC5F0" },
  { name: "Green", swatch: "#2F7D4A" },
  { name: "Red", swatch: "#C62E2E" },
  { name: "Wine", swatch: "#6E1E2B" },
  { name: "Gold", swatch: "#C9A13E" },
  { name: "Grey", swatch: "#8A8A8A" },
];

/** "Kaftan 👕" -> "Kaftan": category names carry emoji in the database. */
export function cleanCategoryName(name: string): string {
  return name.replace(/[\p{Extended_Pictographic}️‍]/gu, "").replace(/\s+/g, " ").trim();
}

/** Older products typed sizes by hand ("54 56 58", "Size 21"); split and tidy them for the chip picker. */
export function tidyLegacyOptions(values: string[] | null | undefined): string[] {
  const out: string[] = [];
  for (const raw of values ?? []) {
    const parts = /^\s*\d+(\.\d+)?(\s+\d+(\.\d+)?)+\s*$/.test(raw) ? raw.trim().split(/\s+/) : [raw];
    for (const part of parts) {
      const clean = part.replace(/^size\s+/i, "").trim();
      if (clean && !out.some((v) => v.toLowerCase() === clean.toLowerCase())) out.push(clean);
    }
  }
  return out;
}

/** Keeps sizes in a natural order: numbers ascending, then letter sizes in clothing order, then anything else. */
export function sortSizes(sizes: string[]): string[] {
  const letterRank = (s: string) => CLOTHING_LETTERS.indexOf(s.toUpperCase());
  return [...sizes].sort((a, b) => {
    const na = parseFloat(a);
    const nb = parseFloat(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    if (!Number.isNaN(na)) return -1;
    if (!Number.isNaN(nb)) return 1;
    const la = letterRank(a);
    const lb = letterRank(b);
    if (la >= 0 && lb >= 0) return la - lb;
    if (la >= 0) return -1;
    if (lb >= 0) return 1;
    return a.localeCompare(b);
  });
}
