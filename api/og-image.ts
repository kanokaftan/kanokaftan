// 1200x630 share-preview image for a product or shop (see api/_share-card.ts).
// api/og.ts points og:image here, so WhatsApp/Facebook/X show a branded card:
// product photo + name + price + shop + K² logo, or the shop's logo and details.

import { ImageResponse } from "@vercel/og";
import { CARD_HEIGHT, CARD_WIDTH, productCard, shopCard, type ProductCardData, type ShopCardData } from "./_share-card";
import { rest } from "./og";

export const config = { runtime: "edge" };

/** Images change rarely; keep them at the CDN for a day, refresh in the background. */
const CACHE = "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800";
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,120}$/i;
/**
 * Fonts and logos always come from the public site, never from the URL this
 * function was called on: *.vercel.app deployment URLs sit behind Vercel login
 * and answer with an HTML page instead of the file.
 */
const ASSET_ORIGIN = "https://www.kanokaftan.shop";
/** Same font files on a public CDN, used if the site copy can't be fetched. */
const FONT_CDN: Record<string, string> = {
  "inter-latin-400-normal.woff": "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-400-normal.woff",
  "inter-latin-700-normal.woff": "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-700-normal.woff",
  "inter-latin-ext-700-normal.woff": "https://cdn.jsdelivr.net/npm/@fontsource/inter@5.0.18/files/inter-latin-ext-700-normal.woff",
  "playfair-display-latin-700-normal.woff": "https://cdn.jsdelivr.net/npm/@fontsource/playfair-display@5.0.27/files/playfair-display-latin-700-normal.woff",
};
/** "wOFF": the first bytes of every .woff file. */
const WOFF_SIGNATURE = 0x774f4646;

interface ProductRow {
  name: string;
  price: number;
  compare_at_price: number | null;
  product_images: { url: string; is_primary: boolean | null; display_order: number | null }[] | null;
  vendor: { store_name: string | null } | null;
}

interface ShopRow {
  store_name: string;
  avatar_url: string | null;
  store_banner_url: string | null;
  city: string | null;
  state: string | null;
  product_count: number;
  rating: number | null;
  review_count: number;
  is_verified: boolean;
  verification_tier: string | null;
}

async function loadProduct(slug: string): Promise<ProductCardData | null> {
  const select = "name,price,compare_at_price,product_images(url,is_primary,display_order),vendor:profiles!products_vendor_id_fkey(store_name)";
  const rows = await rest<ProductRow[]>(`products?select=${encodeURIComponent(select)}&slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`);
  const p = rows[0];
  if (!p) return null;
  const images = [...(p.product_images ?? [])].sort(
    (a, b) => Number(!!b.is_primary) - Number(!!a.is_primary) || (a.display_order ?? 0) - (b.display_order ?? 0),
  );
  return {
    name: p.name,
    price: Number(p.price),
    compareAtPrice: p.compare_at_price != null ? Number(p.compare_at_price) : null,
    shopName: p.vendor?.store_name ?? null,
    photoUrl: images[0]?.url ?? null,
  };
}

async function loadShop(slug: string): Promise<ShopCardData | null> {
  const rows = await rest<ShopRow[]>("rpc/get_shop", { method: "POST", body: JSON.stringify({ p_slug: slug.toLowerCase(), p_vendor_id: null }) });
  const s = rows[0];
  if (!s) return null;
  return {
    name: s.store_name,
    place: [s.city, s.state].filter(Boolean).join(", ") || null,
    productCount: Number(s.product_count) || 0,
    rating: s.rating,
    reviewCount: Number(s.review_count) || 0,
    badge: s.is_verified ? (s.verification_tier === "gold" ? "gold" : "blue") : null,
    logoUrl: s.avatar_url || s.store_banner_url,
  };
}

async function fetchWoff(url: string): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  const data = await res.arrayBuffer();
  if (data.byteLength < 4 || new DataView(data).getUint32(0) !== WOFF_SIGNATURE) {
    throw new Error(`${url}: not a font (${res.headers.get("content-type")})`);
  }
  return data;
}

async function loadFonts() {
  const font = (file: string) =>
    fetchWoff(`${ASSET_ORIGIN}/fonts/${file}`).catch((error) => {
      console.warn("[og-image] site font failed, using CDN copy", String(error));
      return fetchWoff(FONT_CDN[file]);
    });
  // latin-ext carries the naira sign (₦).
  const [regular, bold, boldExt, display] = await Promise.all([
    font("inter-latin-400-normal.woff"), font("inter-latin-700-normal.woff"), font("inter-latin-ext-700-normal.woff"),
    font("playfair-display-latin-700-normal.woff"),
  ]);
  return [
    { name: "Inter", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Inter", data: bold, weight: 700 as const, style: "normal" as const },
    // Separate name so it is used only as a fallback (it lacks basic Latin letters).
    { name: "InterExt", data: boldExt, weight: 700 as const, style: "normal" as const },
    { name: "Playfair", data: display, weight: 700 as const, style: "normal" as const },
  ];
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const slug = url.searchParams.get("slug") ?? "";
  const assets = { logoUrl: `${ASSET_ORIGIN}/logo.svg`, darkLogoUrl: `${ASSET_ORIGIN}/logo-dark.svg` };

  try {
    if (!SLUG_PATTERN.test(slug)) throw new Error("bad slug");
    const element =
      type === "product" ? await loadProduct(slug).then((d) => d && productCard(d, assets))
        : type === "shop" ? await loadShop(slug).then((d) => d && shopCard(d, assets))
          : null;
    if (!element) return Response.redirect(`${ASSET_ORIGIN}/og-image.png`, 302);

    const image = new ImageResponse(element as never, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: await loadFonts(),
    });
    // Drawing happens while the body streams; read it here so a failure lands in
    // the catch below instead of sending an empty 200 image.
    const png = await image.arrayBuffer();
    return new Response(png, { headers: { "Content-Type": "image/png", "Cache-Control": CACHE } });
  } catch (error) {
    console.error("[og-image] failed", { type, slug, error: String(error) });
    // The generic Kano Kaftan card is always better than a broken preview.
    return Response.redirect(`${ASSET_ORIGIN}/og-image.png`, 302);
  }
}

