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

async function loadFonts(origin: string) {
  const font = async (file: string) => {
    const res = await fetch(`${origin}/fonts/${file}`);
    if (!res.ok) throw new Error(`font ${file}: ${res.status}`);
    return res.arrayBuffer();
  };
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
  const origin = url.origin;
  const type = url.searchParams.get("type");
  const slug = url.searchParams.get("slug") ?? "";
  const assets = { logoUrl: `${origin}/logo.svg`, darkLogoUrl: `${origin}/logo-dark.svg` };

  try {
    if (!SLUG_PATTERN.test(slug)) throw new Error("bad slug");
    const element =
      type === "product" ? await loadProduct(slug).then((d) => d && productCard(d, assets))
        : type === "shop" ? await loadShop(slug).then((d) => d && shopCard(d, assets))
          : null;
    if (!element) return Response.redirect(`${origin}/og-image.png`, 302);

    const image = new ImageResponse(element as never, {
      width: CARD_WIDTH,
      height: CARD_HEIGHT,
      fonts: await loadFonts(origin),
    });
    image.headers.set("Cache-Control", CACHE);
    return image;
  } catch (error) {
    console.error("[og-image] failed", { type, slug, error: String(error) });
    // The generic Kano Kaftan card is always better than a broken preview.
    return Response.redirect(`${origin}/og-image.png`, 302);
  }
}

