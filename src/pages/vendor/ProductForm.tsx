import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Camera, ChevronDown, Gift, Loader2, Megaphone, Minus, Plus, Star, X } from "lucide-react";
import { toast } from "sonner";
import { missingSetupItems, useShopSetup } from "@/hooks/useShopSetup";
import { VendorLayout, useVendorAuth } from "@/components/vendor/VendorLayout";
import { useVendorProduct } from "@/hooks/useVendorProducts";
import { useProductMutations } from "@/hooks/useProductMutations";
import { useCategories } from "@/hooks/useProducts";
import { firstBuyerPrice, useFirstBuyerMinPercent } from "@/hooks/useBuyerTrust";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { ColorPicker, SizePicker } from "@/components/products/OptionPickers";
import { categoryOptions, cleanCategoryName, sortSizes, tidyLegacyOptions } from "@/lib/productOptions";
import { naira } from "@/lib/naira";
import { detectPhotoColors } from "@/lib/photoColors";
import { cn } from "@/lib/utils";

const MAX_PHOTOS = 6;
const MAX_FIRST_BUYER_PERCENT = 90;
const DISCOUNT_PRESETS = [5, 10, 15, 20];
/** At most this many colours are added automatically from photos. */
const MAX_AUTO_COLORS = 3;

interface FormState {
  name: string;
  description: string;
  price: string;
  compareAt: string;
  discount: string;
  stock: number;
  categoryId: string;
  isActive: boolean;
  sizes: string[];
  colors: string[];
}

const EMPTY: FormState = {
  name: "", description: "", price: "", compareAt: "", discount: "", stock: 1, categoryId: "", isActive: true, sizes: [], colors: [],
};

function Section({ title, hint, children, sectionRef }: { title: string; hint?: string; children: React.ReactNode; sectionRef?: React.Ref<HTMLElement> }) {
  return (
    <section ref={sectionRef} className="scroll-mt-20 space-y-2.5">
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

/** Tap-to-open optional block ("+ Add colours"), already open when it has content. */
function Optional({ label, open, onOpen, children }: { label: string; open: boolean; onOpen: () => void; children: React.ReactNode }) {
  if (open) return <>{children}</>;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-2 rounded-2xl border border-dashed px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted/50">
      <Plus className="h-4 w-4" />{label}
    </button>
  );
}

export default function ProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userId } = useVendorAuth();
  const isEditing = !!id;
  const { data: existing, isLoading: productLoading } = useVendorProduct(id || null);
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { createProduct, updateProduct, uploadImage } = useProductMutations(userId);
  const { data: setup } = useShopSetup(!id);
  const { data: minDiscount = DISCOUNT_PRESETS[0] } = useFirstBuyerMinPercent();

  const [form, setForm] = useState<FormState>(EMPTY);
  const [images, setImages] = useState<string[]>([]);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [showSizes, setShowSizes] = useState(false);
  const [showColors, setShowColors] = useState(false);
  const [showMore, setShowMore] = useState(false);
  const [customDiscount, setCustomDiscount] = useState(false);
  /** Colours found in the photos (kept even if the seller unticks one, so it isn't added again). */
  const [detectedColors, setDetectedColors] = useState<string[]>([]);
  const detectedRef = useRef<string[]>([]);
  const photoInput = useRef<HTMLInputElement>(null);
  const refs = { photos: useRef<HTMLElement>(null), name: useRef<HTMLElement>(null), category: useRef<HTMLElement>(null), price: useRef<HTMLElement>(null) };

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));

  useEffect(() => {
    if (!existing || !isEditing) return;
    const sizes = sortSizes(tidyLegacyOptions(existing.sizes));
    const colors = tidyLegacyOptions(existing.colors);
    setForm({
      name: existing.name,
      description: existing.description || "",
      price: String(existing.price),
      compareAt: existing.compare_at_price ? String(existing.compare_at_price) : "",
      discount: existing.first_buyer_discount_percent != null ? String(existing.first_buyer_discount_percent) : "",
      stock: existing.stock_quantity,
      categoryId: existing.category_id || "",
      isActive: existing.is_active,
      sizes,
      colors,
    });
    setShowSizes(sizes.length > 0);
    setShowColors(colors.length > 0);
    setShowMore(!!existing.description || !!existing.compare_at_price || !existing.is_active);
    setImages(
      [...(existing.product_images || [])]
        .sort((a: { is_primary: boolean; display_order: number | null }, b: { is_primary: boolean; display_order: number | null }) =>
          Number(b.is_primary) - Number(a.is_primary) || (a.display_order ?? 0) - (b.display_order ?? 0))
        .map((img: { url: string }) => img.url),
    );
  }, [existing, isEditing]);

  // New products start with the smallest first-buyer discount allowed, so sellers needn't type it.
  useEffect(() => {
    if (!isEditing && form.discount === "" && minDiscount) set("discount", String(minDiscount));
  }, [isEditing, minDiscount, form.discount]);

  const category = categories?.find((c) => c.id === form.categoryId);
  const options = categoryOptions(category?.slug);
  const hasPresetSizes = options.sizeGroups.length > 0;
  const discountChoices = useMemo(
    () => [...new Set([minDiscount, ...DISCOUNT_PRESETS].filter((p) => p >= minDiscount))].sort((a, b) => a - b).slice(0, 4),
    [minDiscount],
  );
  const priceNumber = Number(form.price);
  const discountNumber = Number(form.discount);
  const discountValid = form.discount !== "" && discountNumber >= minDiscount && discountNumber <= MAX_FIRST_BUYER_PERCENT;

  const addPhotos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).slice(0, MAX_PHOTOS - images.length);
    e.target.value = "";
    if (!files.length) return;
    setUploadingCount(files.length);
    void addColorsFrom(files);
    const results = await Promise.allSettled(files.map((file) => uploadImage(file)));
    const ok = results.flatMap((r) => (r.status === "fulfilled" ? [r.value as string] : []));
    const failed = results.length - ok.length;
    if (failed) {
      console.error("[ProductForm] some photos failed", results.filter((r) => r.status === "rejected"));
      toast.error(failed === 1 ? "One photo didn't upload. Try it again." : `${failed} photos didn't upload. Try them again.`);
    }
    setImages((prev) => [...prev, ...ok].slice(0, MAX_PHOTOS));
    setUploadingCount(0);
  };

  /** Reads the main colour of each new photo and ticks it in Colours (only colours not seen before). */
  const addColorsFrom = async (files: File[]) => {
    const found = [...new Set((await Promise.all(files.map(detectPhotoColors))).flat())];
    const seen = detectedRef.current;
    const fresh = found.filter((c) => !seen.includes(c)).slice(0, Math.max(0, MAX_AUTO_COLORS - seen.length));
    if (!fresh.length) return;
    detectedRef.current = [...seen, ...fresh];
    setDetectedColors(detectedRef.current);
    setForm((f) => ({ ...f, colors: [...f.colors, ...fresh.filter((c) => !f.colors.includes(c))] }));
    setShowColors(true);
  };

  const makeCover = (index: number) => setImages((prev) => [prev[index], ...prev.filter((_, i) => i !== index)]);
  const removePhoto = (index: number) => setImages((prev) => prev.filter((_, i) => i !== index));

  const problem = (): { message: string; ref: React.RefObject<HTMLElement> } | null => {
    if (!images.length) return { message: "Add at least one photo", ref: refs.photos };
    if (!form.name.trim()) return { message: "Give your product a name", ref: refs.name };
    if (!form.categoryId) return { message: "Choose a category", ref: refs.category };
    if (!(priceNumber > 0)) return { message: "Enter the price", ref: refs.price };
    if (!discountValid) return { message: `First-order discount must be ${minDiscount}% to ${MAX_FIRST_BUYER_PERCENT}%`, ref: refs.price };
    return null;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const issue = problem();
    if (issue) {
      toast.error(issue.message);
      issue.ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSubmitting(true);
    const product = {
      name: form.name.trim(),
      description: form.description.trim(),
      price: priceNumber,
      compare_at_price: Number(form.compareAt) > priceNumber ? Number(form.compareAt) : null,
      first_buyer_discount_percent: discountNumber,
      stock_quantity: Math.max(0, Math.round(form.stock)),
      category_id: form.categoryId,
      is_active: form.isActive,
      sizes: form.sizes,
      colors: options.colors ? form.colors : [],
    };
    const imageData = images.map((url, index) => ({ url, is_primary: index === 0, display_order: index }));
    try {
      if (isEditing && id) await updateProduct.mutateAsync({ productId: id, product, images: imageData });
      else await createProduct.mutateAsync({ product, images: imageData });
      navigate("/vendor/products");
    } catch (error) {
      // The mutation hooks already show the reason.
      console.error("[ProductForm] save failed", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (isEditing && productLoading) {
    return (
      <VendorLayout title="Edit product">
        <div className="mx-auto max-w-xl space-y-4">
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </VendorLayout>
    );
  }

  // New products need phone, exact location and bank account first (the database enforces it too).
  if (!isEditing && setup && !setup.complete) {
    return (
      <VendorLayout title="Add product">
        <div className="mx-auto max-w-md rounded-2xl border bg-card p-6 text-center">
          <p className="font-semibold">One step before your first product</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add your {missingSetupItems(setup).join(", ")} so buyers can trust your shop and you can get paid.
          </p>
          <Button asChild className="mt-4 rounded-full"><Link to="/vendor/settings">Finish shop setup</Link></Button>
        </div>
      </VendorLayout>
    );
  }

  const busy = submitting || uploadingCount > 0;

  return (
    <VendorLayout title={isEditing ? "Edit product" : "Add product"} hideTabBar>
      <form onSubmit={submit} className="mx-auto max-w-xl space-y-6 pb-28 md:pb-8" noValidate>
        {/* Photos */}
        <Section title="Photos" hint="The first photo is the cover. Tap another photo to make it the cover." sectionRef={refs.photos}>
          <input ref={photoInput} type="file" accept="image/*" multiple className="hidden" onChange={addPhotos} />
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {images.map((url, index) => (
              <div key={url} className={cn("relative aspect-square overflow-hidden rounded-2xl border-2", index === 0 ? "border-primary" : "border-transparent")}>
                <button type="button" onClick={() => index !== 0 && makeCover(index)} className="h-full w-full" aria-label={index === 0 ? "Cover photo" : `Make photo ${index + 1} the cover`}>
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
                {index === 0 && (
                  <span className="absolute bottom-1 left-1 inline-flex items-center gap-0.5 rounded-full bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    <Star className="h-2.5 w-2.5 fill-current" />Cover
                  </span>
                )}
                <button type="button" onClick={() => removePhoto(index)} aria-label={`Remove photo ${index + 1}`}
                  className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            {Array.from({ length: uploadingCount }, (_, i) => (
              <div key={`up-${i}`} className="flex aspect-square items-center justify-center rounded-2xl bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ))}
            {images.length + uploadingCount < MAX_PHOTOS && (
              <button type="button" onClick={() => photoInput.current?.click()} disabled={uploadingCount > 0}
                className={cn("flex aspect-square flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50",
                  images.length === 0 && "col-span-3 aspect-[3/1] border-primary/40 bg-primary/5 text-primary sm:col-span-4")}>
                <Camera className="h-6 w-6" />
                <span className="text-xs font-semibold">{images.length === 0 ? "Add photos (up to 6)" : "Add"}</span>
              </button>
            )}
          </div>
        </Section>

        {/* Name */}
        <Section title="What are you selling?" sectionRef={refs.name}>
          <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Embroidered Babban Riga" className="h-12 text-base" maxLength={120} />
        </Section>

        {/* Category */}
        <Section title="Category" sectionRef={refs.category}>
          {categoriesLoading ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <div className="flex flex-wrap gap-2">
              {categories?.map((c) => (
                <button key={c.id} type="button" onClick={() => set("categoryId", c.id)} aria-pressed={form.categoryId === c.id}
                  className={cn("min-h-10 rounded-full border px-4 text-sm font-medium transition-colors active:scale-95",
                    form.categoryId === c.id ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:bg-muted")}>
                  {cleanCategoryName(c.name)}
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* Price & quantity */}
        <Section title="Price and quantity" sectionRef={refs.price}>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
              <Input type="number" inputMode="numeric" min="0" step="100" value={form.price} onChange={(e) => set("price", e.target.value)}
                placeholder="Price" className="h-12 pl-7 text-base" aria-label="Price in naira" />
            </div>
            <div className="flex h-12 items-center rounded-md border">
              <button type="button" onClick={() => set("stock", Math.max(0, form.stock - 1))} className="flex h-full w-11 items-center justify-center" aria-label="One less">
                <Minus className="h-4 w-4" />
              </button>
              <Input type="number" inputMode="numeric" min="0" value={form.stock} onChange={(e) => set("stock", Math.max(0, Number(e.target.value) || 0))}
                className="h-full w-14 border-0 px-0 text-center text-base shadow-none focus-visible:ring-0" aria-label="How many in stock" />
              <button type="button" onClick={() => set("stock", form.stock + 1)} className="flex h-full w-11 items-center justify-center" aria-label="One more">
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="text-right text-[11px] text-muted-foreground -mt-1">in stock</p>

          <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium"><Gift className="h-4 w-4 text-primary" />First-order discount</p>
            <p className="text-xs text-muted-foreground">Only for shoppers buying on Kano Kaftan for the first time. It brings you new customers.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {discountChoices.map((p) => (
                <button key={p} type="button" onClick={() => { set("discount", String(p)); setCustomDiscount(false); }}
                  aria-pressed={!customDiscount && discountNumber === p}
                  className={cn("min-h-10 rounded-xl border px-4 text-sm font-semibold", !customDiscount && discountNumber === p ? "border-primary bg-primary text-primary-foreground" : "bg-background")}>
                  {p}%
                </button>
              ))}
              {customDiscount ? (
                <div className="relative">
                  <Input autoFocus type="number" inputMode="numeric" min={minDiscount} max={MAX_FIRST_BUYER_PERCENT} value={form.discount}
                    onChange={(e) => set("discount", e.target.value)} className="h-10 w-20 pr-6" aria-label="Discount percent" />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                </div>
              ) : (
                <button type="button" onClick={() => setCustomDiscount(true)} className="min-h-10 rounded-xl border border-dashed px-3 text-sm text-muted-foreground">Other</button>
              )}
            </div>
            {priceNumber > 0 && discountValid && (
              <p className="mt-2 text-xs">First-time buyers pay <span className="font-semibold">{naira(firstBuyerPrice(priceNumber, discountNumber))}</span> instead of {naira(priceNumber)}.</p>
            )}
          </div>
        </Section>

        {/* Sizes (only when they fit the category) */}
        {(hasPresetSizes || showSizes || form.sizes.length > 0) ? (
          <Section title={`${options.sizeLabel} available`} hint="Tap every size you have. Skip if it comes in one size.">
            <SizePicker groups={options.sizeGroups} value={form.sizes} onChange={(sizes) => set("sizes", sizes)} />
          </Section>
        ) : (
          form.categoryId && <Optional label="Add sizes (optional)" open={false} onOpen={() => setShowSizes(true)}>{null}</Optional>
        )}

        {/* Colours (optional) */}
        {options.colors && (
          <Optional label="Add colours (optional)" open={showColors || form.colors.length > 0} onOpen={() => setShowColors(true)}>
            <Section title="Colours available" hint="Tap every colour you have.">
              <ColorPicker value={form.colors} onChange={(colors) => set("colors", colors)} detected={detectedColors.filter((c) => form.colors.includes(c))} />
            </Section>
          </Optional>
        )}

        {/* More details */}
        <div className="rounded-2xl border">
          <button type="button" onClick={() => setShowMore((v) => !v)} className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold" aria-expanded={showMore}>
            More details (optional)
            <ChevronDown className={cn("h-4 w-4 transition-transform", showMore && "rotate-180")} />
          </button>
          {showMore && (
            <div className="space-y-4 border-t px-4 pb-4 pt-3">
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" value={form.description} onChange={(e) => set("description", e.target.value)} rows={4} className="resize-none"
                  placeholder="Material, fit, how to care for it…" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="compare">Old price (shows a "sale" tag)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">₦</span>
                  <Input id="compare" type="number" inputMode="numeric" min="0" step="100" value={form.compareAt} onChange={(e) => set("compareAt", e.target.value)}
                    placeholder="Leave empty if not on sale" className="h-11 pl-7" />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <Label htmlFor="active">Show in my shop</Label>
                  <p className="text-xs text-muted-foreground">Turn off to hide it without deleting.</p>
                </div>
                <Switch id="active" checked={form.isActive} onCheckedChange={(v) => set("isActive", v)} />
              </div>
              {isEditing && id && (
                <Button asChild type="button" variant="outline" className="w-full gap-1.5">
                  <Link to={`/vendor/promote?product=${id}`}><Megaphone className="h-4 w-4" />Promote on the homepage</Link>
                </Button>
              )}
            </div>
          )}
        </div>

        {/* One clear action */}
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 p-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] backdrop-blur md:static md:border-0 md:bg-transparent md:p-0">
          <div className="mx-auto flex max-w-xl gap-2">
            <Button type="button" variant="ghost" className="h-12 rounded-full" onClick={() => navigate("/vendor/products")}>Cancel</Button>
            <Button type="submit" className="h-12 flex-1 rounded-full text-base" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {uploadingCount > 0 ? "Uploading photos…" : isEditing ? "Save changes" : "Post product"}
            </Button>
          </div>
        </div>
      </form>
    </VendorLayout>
  );
}
