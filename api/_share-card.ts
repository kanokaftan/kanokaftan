// Draws the 1200x630 link-preview cards (product photo or shop logo + name,
// price and the K² logo). Shared by api/og-image.ts and the local preview script.
// Elements are plain { type, props } objects (what JSX compiles to), so this
// needs no React/JSX build step.

export const CARD_WIDTH = 1200;
export const CARD_HEIGHT = 630;

const INK = "#111111";
const MUTED = "#5f5f5f";
const GOLD = "#7A5A0B";
const PAPER = "#FAFAFA";

type Style = Record<string, string | number>;
interface Node {
  type: string;
  props: { style?: Style; children?: Child | Child[]; src?: string; width?: number; height?: number; alt?: string };
}
type Child = Node | string | null | false;

function el(type: string, style: Style, children?: Child | Child[], extra: Omit<Node["props"], "style" | "children"> = {}): Node {
  return { type, props: { style, children, ...extra } };
}

export interface ProductCardData {
  name: string;
  price: number;
  compareAtPrice: number | null;
  shopName: string | null;
  photoUrl: string | null;
}

export interface ShopCardData {
  name: string;
  place: string | null;
  productCount: number;
  rating: number | null;
  reviewCount: number;
  badge: "gold" | "blue" | null;
  logoUrl: string | null;
}

const naira = new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 });

/** The renderer can't decode WebP; those photos fall back to the branded panel. */
export function usableImage(url: string | null | undefined): string | null {
  if (!url) return null;
  return /\.webp(\?|$)/i.test(url) ? null : url;
}

function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

function brandFooter(logoUrl: string): Node {
  return el("div", { display: "flex", alignItems: "center", gap: 18, marginTop: "auto" }, [
    el("img", { width: 64, height: 64 }, undefined, { src: logoUrl, width: 64, height: 64 }),
    el("div", { display: "flex", flexDirection: "column" }, [
      el("div", { fontFamily: "Playfair", fontSize: 30, color: INK }, "Kano Kaftan"),
      el("div", { fontSize: 22, color: GOLD, fontWeight: 700 }, "kanokaftan.shop"),
    ]),
  ]);
}

/** Left half: the photo, or a dark branded panel with the logo when there is none. */
function photoPanel(photoUrl: string | null, darkLogoUrl: string, round = false): Node {
  if (photoUrl) {
    return el("div", { display: "flex", width: CARD_HEIGHT, height: CARD_HEIGHT, backgroundColor: "#eee" }, [
      el("img", { width: CARD_HEIGHT, height: CARD_HEIGHT, objectFit: "cover", borderRadius: round ? 9999 : 0 }, undefined, {
        src: photoUrl, width: CARD_HEIGHT, height: CARD_HEIGHT,
      }),
    ]);
  }
  return el("div", {
    display: "flex", width: CARD_HEIGHT, height: CARD_HEIGHT, alignItems: "center", justifyContent: "center",
    backgroundImage: "linear-gradient(135deg, #171717 0%, #262626 55%, #5C4300 100%)",
  }, [el("img", { width: 300, height: 300 }, undefined, { src: darkLogoUrl, width: 300, height: 300 })]);
}

export function productCard(data: ProductCardData, assets: { logoUrl: string; darkLogoUrl: string }): Node {
  const onSale = data.compareAtPrice != null && data.compareAtPrice > data.price;
  const off = onSale ? Math.round((1 - data.price / (data.compareAtPrice as number)) * 100) : 0;
  return el("div", { display: "flex", width: CARD_WIDTH, height: CARD_HEIGHT, backgroundColor: PAPER, fontFamily: "Inter, InterExt" }, [
    photoPanel(usableImage(data.photoUrl), assets.darkLogoUrl),
    el("div", { display: "flex", flexDirection: "column", flex: 1, padding: "56px 56px 48px" }, [
      data.shopName ? el("div", { fontSize: 24, color: MUTED, marginBottom: 14 }, clip(`by ${data.shopName}`, 40)) : null,
      el("div", { fontFamily: "Playfair", fontSize: 54, lineHeight: 1.1, color: INK }, clip(data.name, 70)),
      el("div", { display: "flex", alignItems: "center", gap: 18, marginTop: 28 }, [
        el("div", { fontSize: 50, fontWeight: 700, color: INK }, naira.format(data.price)),
        onSale ? el("div", { fontSize: 28, color: MUTED, textDecoration: "line-through" }, naira.format(data.compareAtPrice as number)) : null,
      ]),
      onSale
        ? el("div", {
          display: "flex", alignSelf: "flex-start", marginTop: 16, padding: "6px 16px", borderRadius: 999,
          backgroundColor: "#B91C1C", color: "#fff", fontSize: 22, fontWeight: 700,
        }, `${off}% OFF`)
        : null,
      brandFooter(assets.logoUrl),
    ]),
  ]);
}

export function shopCard(data: ShopCardData, assets: { logoUrl: string; darkLogoUrl: string }): Node {
  const facts = [
    data.place,
    `${data.productCount} product${data.productCount === 1 ? "" : "s"}`,
    data.rating && data.reviewCount ? `Rated ${data.rating}/5 (${data.reviewCount})` : null,
  ].filter(Boolean).join("  ·  ");
  const badge = data.badge === "gold" ? { text: "Gold seller", bg: "#9A7400" } : data.badge === "blue" ? { text: "Verified seller", bg: "#1D9BF0" } : null;
  const logo = usableImage(data.logoUrl);
  return el("div", {
    display: "flex", width: CARD_WIDTH, height: CARD_HEIGHT, alignItems: "center", gap: 64, padding: "0 90px",
    backgroundColor: PAPER, fontFamily: "Inter, InterExt",
  }, [
    logo
      ? el("img", { width: 320, height: 320, borderRadius: 9999, objectFit: "cover", border: "8px solid #fff", boxShadow: "0 20px 50px rgba(0,0,0,0.15)" }, undefined, { src: logo, width: 320, height: 320 })
      : el("div", { display: "flex", width: 320, height: 320, borderRadius: 9999, alignItems: "center", justifyContent: "center", backgroundColor: INK, color: "#fff", fontSize: 140, fontFamily: "Playfair" }, data.name.charAt(0).toUpperCase()),
    el("div", { display: "flex", flexDirection: "column", flex: 1, height: 460 }, [
      badge ? el("div", { display: "flex", alignSelf: "flex-start", padding: "6px 16px", borderRadius: 999, backgroundColor: badge.bg, color: "#fff", fontSize: 22, fontWeight: 700, marginBottom: 18 }, badge.text) : null,
      el("div", { fontFamily: "Playfair", fontSize: 64, lineHeight: 1.05, color: INK }, clip(data.name, 40)),
      el("div", { fontSize: 28, color: MUTED, marginTop: 18 }, facts),
      el("div", { fontSize: 26, color: MUTED, marginTop: 10 }, "Shop safely on Kano Kaftan"),
      brandFooter(assets.logoUrl),
    ]),
  ]);
}
