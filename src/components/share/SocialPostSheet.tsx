import { useEffect, useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { renderSocialPost, type PostFormat, type PostProduct, type PostStyle } from "@/lib/socialPost";
import { cn } from "@/lib/utils";

const FORMATS: { value: PostFormat; label: string }[] = [
  { value: "square", label: "Instagram post" },
  { value: "story", label: "Status / Story" },
];
const STYLES: { value: PostStyle; label: string }[] = [
  { value: "clean", label: "Clean" },
  { value: "bold", label: "Bold" },
];

function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="grid flex-1 rounded-full bg-muted p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("h-9 rounded-full px-2 text-xs font-medium transition-all", value === o.value ? "bg-background shadow-sm" : "text-muted-foreground")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function fileName(product: PostProduct, format: PostFormat): string {
  const slug = product.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "kano-kaftan";
  return `${slug}-${format === "square" ? "instagram" : "status"}.png`;
}

/** Makes a branded Instagram post or WhatsApp Status image from a product, ready to share. */
export function SocialPostSheet({ product, onClose }: { product: PostProduct | null; onClose: () => void }) {
  const [format, setFormat] = useState<PostFormat>("square");
  const [style, setStyle] = useState<PostStyle>("clean");
  const [blob, setBlob] = useState<Blob | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!product) return;
    let cancelled = false;
    let url: string | null = null;
    setBusy(true);
    renderSocialPost(product, format, style)
      .then((made) => {
        if (cancelled) return;
        url = URL.createObjectURL(made);
        setBlob(made);
        setPreview(url);
      })
      .catch((error) => {
        console.error("[SocialPostSheet] could not create image", error);
        if (!cancelled) toast.error("Couldn't create the image. Please try again.");
      })
      .finally(() => !cancelled && setBusy(false));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [product, format, style]);

  const file = () => (blob && product ? new File([blob], fileName(product, format), { type: "image/png" }) : null);

  const share = async () => {
    const f = file();
    if (!f || !product) return;
    try {
      if (navigator.canShare?.({ files: [f] })) {
        await navigator.share({ files: [f], title: product.name, text: `${product.name} · ${product.link}` });
      } else {
        save();
        toast.info("Image saved. Post it from your photos.");
      }
    } catch (error) {
      if ((error as DOMException)?.name === "AbortError") return;
      console.error("[SocialPostSheet] share failed", error);
      toast.error("Couldn't share. Use Save image instead.");
    }
  };

  const save = () => {
    const f = file();
    if (!f || !preview) return;
    const a = document.createElement("a");
    a.href = preview;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <Sheet open={!!product} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[94dvh] overflow-y-auto rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <SheetHeader className="text-left">
          <SheetTitle>Create a post</SheetTitle>
          <SheetDescription>Branded image for Instagram or WhatsApp Status.</SheetDescription>
        </SheetHeader>

        <div className="mt-4 flex gap-2">
          <Segmented<PostFormat> label="Format" value={format} options={FORMATS} onChange={setFormat} />
          <Segmented<PostStyle> label="Style" value={style} options={STYLES} onChange={setStyle} />
        </div>

        <div className="mt-4 flex justify-center">
          <div className={cn("relative overflow-hidden rounded-2xl border bg-muted shadow-sm", format === "square" ? "aspect-square w-full max-w-[340px]" : "aspect-[9/16] w-full max-w-[220px]")}>
            {preview && <img src={preview} alt="Post preview" className={cn("h-full w-full object-cover transition-opacity", busy && "opacity-50")} />}
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <Button variant="outline" className="h-12 rounded-full" onClick={save} disabled={!blob || busy}>
            <Download className="mr-2 h-4 w-4" />Save image
          </Button>
          <Button className="h-12 rounded-full" onClick={share} disabled={!blob || busy}>
            <Share2 className="mr-2 h-4 w-4" />Share
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
