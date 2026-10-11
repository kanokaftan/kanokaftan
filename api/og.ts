// Link previews for products and shops.
//
// The site is a single-page app, so every URL serves the same index.html with
// the generic Kano Kaftan logo. Link previewers (WhatsApp, Facebook, X,
// Telegram, iMessage…) don't run JavaScript, so vercel.json sends *their*
// requests for /products/:slug, /shop/:slug and /vendor/:id here instead, and
// this returns a tiny page whose Open Graph tags show the real product photo
// and price, or the shop's logo and name. People still get the normal app.

export const config = { runtime: "edge" };

const SITE = "https://kanokaftan.shop";
const SITE_NAME = "Kano Kaftan";
const FALLBACK_IMAGE = `${SITE}/og-image.png`;
const DEFAULT_DESCRIPTION = "Clothing, kaftans, fabrics, shoes, caps and accessories from trusted sellers, with safe payments and delivery.";
const MAX_DESCRIPTION = 200;
/** Previews are cached by WhatsApp & co. anyway; let the CDN keep them a few minutes. */
const CACHE_SECONDS = 300;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,120}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface Preview {
  title: string;
  description: string;
  image: string;
  url: string;
  type: "product" | "profile" | "website";
  price?: number;
  imageAlt: string;
}

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", minimumFractionDigits: 0 });

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function clip(text: string | null | undefined, max = MAX_DESCRIPTION): string {
  const clean = (text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

function supabaseEnv() {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return { url, key };
}

export async function rest<T>(path: string, init?: RequestInit): Promise<T> {
  const { url, key } = supabaseEnv();
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`Supabase ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

interface ProductRow {
  name: string;
  slug: string;
  description: string | null;
  price: number;
  compare_at_price: number | null;
  product_images: { url: string; is_primary: boolean | null; display_order: number | null }[] | null;
  vendor: { store_name: string | null } | null;
}

async function productPreview(slug: string): Promise<Preview | null> {
  const select = "name,slug,description,price,compare_at_price,product_images(url,is_primary,display_order),vendor:profiles!products_vendor_id_fkey(store_name)";
  const rows = await rest<ProductRow[]>(`products?select=${encodeURIComponent(select)}&slug=eq.${encodeURIComponent(slug)}&is_active=eq.true&limit=1`);
  const product = rows[0];
  if (!product) return null;
  const price = Number(product.price);
  const was = product.compare_at_price && Number(product.compare_at_price) > price ? ` (was ${naira.format(Number(product.compare_at_price))})` : "";
  const shop = product.vendor?.store_name ? ` · by ${product.vendor.store_name}` : "";
  return {
    title: `${product.name} — ${naira.format(price)}`,
    description: clip(`${naira.format(price)}${was}${shop}. ${product.description || DEFAULT_DESCRIPTION}`),
    // Branded card (photo + name + price + logo); api/og-image.ts falls back to the generic card.
    image: `${SITE}/api/og-image?type=product&slug=${encodeURIComponent(product.slug)}`,
    imageAlt: product.name,
    url: `${SITE}/products/${product.slug}`,
    type: "product",
    price,
  };
}

interface ShopRow {
  store_name: string;
  store_slug: string;
  store_description: string | null;
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

async function shopPreview(by: { slug?: string; vendorId?: string }): Promise<Preview | null> {
  const rows = await rest<ShopRow[]>("rpc/get_shop", {
    method: "POST",
    body: JSON.stringify({ p_slug: by.slug ?? null, p_vendor_id: by.vendorId ?? null }),
  });
  const shop = rows[0];
  if (!shop) return null;
  const place = [shop.city, shop.state].filter(Boolean).join(", ");
  const badge = shop.is_verified ? (shop.verification_tier === "gold" ? "Gold seller" : "Verified seller") : null;
  const facts = [
    badge,
    place && `in ${place}`,
    `${shop.product_count} product${Number(shop.product_count) === 1 ? "" : "s"}`,
    shop.rating && shop.review_count ? `★ ${shop.rating} (${shop.review_count})` : null,
  ].filter(Boolean).join(" · ");
  return {
    title: `${shop.store_name} on ${SITE_NAME}`,
    description: clip(`${facts}. ${shop.store_description || DEFAULT_DESCRIPTION}`),
    // Branded card with the shop's logo, badge and numbers.
    image: `${SITE}/api/og-image?type=shop&slug=${encodeURIComponent(shop.store_slug)}`,
    imageAlt: `${shop.store_name} logo`,
    url: `${SITE}/shop/${shop.store_slug}`,
    type: "profile",
  };
}

function renderHtml(p: Preview): string {
  const t = escapeHtml(p.title);
  const d = escapeHtml(p.description);
  const img = escapeHtml(p.image);
  const url = escapeHtml(p.url);
  const alt = escapeHtml(p.imageAlt);
  const productTags = p.type === "product" && p.price != null
    ? `<meta property="product:price:amount" content="${p.price}" />\n    <meta property="product:price:currency" content="NGN" />`
    : "";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${t}</title>
    <meta name="description" content="${d}" />
    <link rel="canonical" href="${url}" />
    <meta property="og:site_name" content="${SITE_NAME}" />
    <meta property="og:type" content="${p.type === "product" ? "product" : p.type}" />
    <meta property="og:title" content="${t}" />
    <meta property="og:description" content="${d}" />
    <meta property="og:url" content="${url}" />
    <meta property="og:image" content="${img}" />
    <meta property="og:image:secure_url" content="${img}" />
    <meta property="og:image:alt" content="${alt}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    ${productTags}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${t}" />
    <meta name="twitter:description" content="${d}" />
    <meta name="twitter:image" content="${img}" />
    <script>
      // A person (not a link previewer) who lands here goes to the real app.
      location.replace(${JSON.stringify(p.url)} + (${JSON.stringify(p.url)}.includes("?") ? "&" : "?") + "app=1");
    </script>
  </head>
  <body>
    <h1>${t}</h1>
    <p>${d}</p>
    <img src="${img}" alt="${alt}" />
    <p><a href="${url}">Open on ${SITE_NAME}</a></p>
  </body>
</html>`;
}

export async function buildPreview(searchParams: URLSearchParams): Promise<Preview | null> {
  const type = searchParams.get("type");
  const slug = searchParams.get("slug") ?? "";
  const id = searchParams.get("id") ?? "";
  if (type === "product" && SLUG_PATTERN.test(slug)) return productPreview(slug);
  if (type === "shop" && SLUG_PATTERN.test(slug)) return shopPreview({ slug: slug.toLowerCase() });
  if (type === "vendor" && UUID_PATTERN.test(id)) return shopPreview({ vendorId: id });
  return null;
}

export default async function handler(request: Request): Promise<Response> {
  const { searchParams } = new URL(request.url);
  let preview: Preview | null = null;
  try {
    preview = await buildPreview(searchParams);
  } catch (error) {
    console.error("[og] preview failed", { params: searchParams.toString(), error: String(error) });
  }
  // Unknown product/shop or an error: the generic Kano Kaftan preview still works.
  const page = preview ?? {
    title: `${SITE_NAME} – Clothing, Fabrics, Shoes & Accessories`,
    description: DEFAULT_DESCRIPTION,
    image: FALLBACK_IMAGE,
    imageAlt: SITE_NAME,
    url: SITE,
    type: "website" as const,
  };
  return new Response(renderHtml(page), {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS * 12}`,
    },
  });
}
