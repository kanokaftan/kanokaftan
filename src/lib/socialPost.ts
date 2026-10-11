// Branded images for Instagram (square) and WhatsApp Status (tall), drawn on a
// canvas from a product: photo, name, price, sale badge, shop and the K² logo.

export type PostFormat = "square" | "story";
export type PostStyle = "clean" | "bold";

export interface PostProduct {
  name: string;
  price: number;
  compareAtPrice?: number | null;
  imageUrl?: string | null;
  shopName?: string | null;
  /** Shown at the bottom, e.g. "kanokaftan.shop/shop/royal-house". */
  link: string;
}

export const POST_SIZES: Record<PostFormat, { width: number; height: number }> = {
  square: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

const INK = "#111111";
const MUTED = "#6b6b6b";
const GOLD = "#9A7400";
const PAPER = "#FAFAFA";
const SALE_RED = "#B91C1C";
const DISPLAY_FONT = "'Playfair Display', Georgia, serif";
const BODY_FONT = "Inter, 'Helvetica Neue', Arial, sans-serif";

const naira = (n: number) => new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(n);

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Needed so the finished canvas can be saved/shared (Supabase storage allows it).
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image ${src}`));
    img.src = src;
  });
}

/** Draws `img` to fill the box (like CSS object-fit: cover), clipped to rounded corners. */
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, radius = 0) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (img.naturalWidth - sw) / 2;
  const sy = (img.naturalHeight - sh) / 2;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, radius);
  ctx.clip();
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

/** Splits text into at most `maxLines` lines that fit `width`, adding … if cut. */
function wrap(ctx: CanvasRenderingContext2D, text: string, width: number, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width <= width || !line) {
      line = next;
    } else {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  const used = lines.join(" ").split(/\s+/).length;
  if (used < words.length && lines.length) {
    let last = lines[lines.length - 1];
    while (ctx.measureText(`${last}…`).width > width && last.includes(" ")) last = last.slice(0, last.lastIndexOf(" "));
    lines[lines.length - 1] = `${last}…`;
  }
  return lines;
}

function pill(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, bg: string, fg: string, size = 34) {
  ctx.font = `700 ${size}px ${BODY_FONT}`;
  const padX = size * 0.6;
  const h = size * 1.6;
  const w = ctx.measureText(text).width + padX * 2;
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, h / 2);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + padX, y + h / 2 + 1);
  ctx.textBaseline = "alphabetic";
  return w;
}

function priceRow(ctx: CanvasRenderingContext2D, p: PostProduct, x: number, y: number, color: string, mutedColor: string, size: number) {
  ctx.font = `700 ${size}px ${BODY_FONT}`;
  ctx.fillStyle = color;
  const price = naira(p.price);
  ctx.fillText(price, x, y);
  if (p.compareAtPrice && p.compareAtPrice > p.price) {
    const after = x + ctx.measureText(price).width + size * 0.4;
    ctx.font = `400 ${size * 0.5}px ${BODY_FONT}`;
    ctx.fillStyle = mutedColor;
    const was = naira(p.compareAtPrice);
    ctx.fillText(was, after, y);
    const w = ctx.measureText(was).width;
    ctx.fillRect(after, y - size * 0.18, w, Math.max(2, size * 0.05));
  }
}

function saleText(p: PostProduct): string | null {
  if (!p.compareAtPrice || p.compareAtPrice <= p.price) return null;
  return `${Math.round((1 - p.price / p.compareAtPrice) * 100)}% OFF`;
}

/** Renders the post and returns it as a PNG blob. */
export async function renderSocialPost(product: PostProduct, format: PostFormat, style: PostStyle): Promise<Blob> {
  const { width: W, height: H } = POST_SIZES[format];
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("This phone can't create images");

  // Fonts load only when something uses them; make sure the canvas gets the real ones.
  await Promise.all(
    ["700 60px 'Playfair Display'", "700 60px Inter", "400 30px Inter"].map((f) => document.fonts?.load(f).catch(() => undefined)),
  );
  await document.fonts?.ready;
  const [photo, logo, logoDark] = await Promise.all([
    product.imageUrl ? loadImage(product.imageUrl).catch(() => null) : Promise.resolve(null),
    loadImage("/logo.svg"),
    loadImage("/logo-dark.svg"),
  ]);
  const sale = saleText(product);
  const M = 64; // outer margin

  if (style === "clean") {
    ctx.fillStyle = PAPER;
    ctx.fillRect(0, 0, W, H);
    const photoH = format === "square" ? 560 : 1100;
    if (photo) drawCover(ctx, photo, M, M, W - 2 * M, photoH, 36);
    else {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.roundRect(M, M, W - 2 * M, photoH, 36);
      ctx.fill();
      ctx.drawImage(logoDark, W / 2 - 160, M + photoH / 2 - 160, 320, 320);
    }
    if (sale) pill(ctx, sale, M + 28, M + 28, SALE_RED, "#fff", 36);

    let y = M + photoH + (format === "square" ? 70 : 110);
    if (product.shopName) {
      ctx.font = `400 ${format === "square" ? 30 : 40}px ${BODY_FONT}`;
      ctx.fillStyle = MUTED;
      ctx.fillText(product.shopName, M, y);
      y += format === "square" ? 62 : 86;
    }
    const nameSize = format === "square" ? 54 : 76;
    ctx.font = `700 ${nameSize}px ${DISPLAY_FONT}`;
    ctx.fillStyle = INK;
    const logoSize = format === "square" ? 130 : 170;
    // Story: the logo sits beside the shop name/title, so keep the text clear of it.
    for (const line of wrap(ctx, product.name, W - 2 * M - logoSize - 40, 2)) {
      ctx.fillText(line, M, y);
      y += nameSize * 1.15;
    }
    priceRow(ctx, product, M, y + (format === "square" ? 34 : 60), INK, MUTED, format === "square" ? 60 : 88);

    // Brand: logo (bottom-right on the square, beside the title on the story) + link
    const logoY = format === "square" ? H - M - logoSize - 40 : M + photoH + 70;
    ctx.drawImage(logo, W - M - logoSize, logoY, logoSize, logoSize);
    ctx.font = `700 ${format === "square" ? 28 : 40}px ${BODY_FONT}`;
    ctx.fillStyle = GOLD;
    ctx.fillText(format === "story" ? `Order on ${product.link}` : product.link, M, H - M - (format === "story" ? 60 : 0));
  } else {
    // Bold: full-bleed photo, dark fade, white text.
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, W, H);
    if (photo) drawCover(ctx, photo, 0, 0, W, H);
    else ctx.drawImage(logoDark, W / 2 - 220, H * 0.28 - 220, 440, 440);
    const fade = ctx.createLinearGradient(0, H * 0.35, 0, H);
    fade.addColorStop(0, "rgba(0,0,0,0)");
    fade.addColorStop(0.55, "rgba(0,0,0,0.7)");
    fade.addColorStop(1, "rgba(0,0,0,0.92)");
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, W, H);
    const topFade = ctx.createLinearGradient(0, 0, 0, 260);
    topFade.addColorStop(0, "rgba(0,0,0,0.45)");
    topFade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topFade;
    ctx.fillRect(0, 0, W, 260);

    const logoSize = format === "square" ? 120 : 160;
    ctx.drawImage(logoDark, M, M, logoSize, logoSize);
    if (sale) pill(ctx, sale, W - M - 260, M + 20, SALE_RED, "#fff", 40);

    const nameSize = format === "square" ? 64 : 84;
    const priceSize = format === "square" ? 66 : 90;
    ctx.font = `700 ${nameSize}px ${DISPLAY_FONT}`;
    const lines = wrap(ctx, product.name, W - 2 * M, 2);
    const bottom = H - M - (format === "story" ? 120 : 40);
    let y = bottom - priceSize - 40 - (lines.length - 1) * nameSize * 1.15;
    if (product.shopName) {
      ctx.font = `400 ${format === "square" ? 32 : 42}px ${BODY_FONT}`;
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillText(product.shopName, M, y - nameSize - 10);
    }
    ctx.font = `700 ${nameSize}px ${DISPLAY_FONT}`;
    ctx.fillStyle = "#fff";
    for (const line of lines) {
      ctx.fillText(line, M, y);
      y += nameSize * 1.15;
    }
    priceRow(ctx, product, M, y + 20, "#fff", "rgba(255,255,255,0.7)", priceSize);
    ctx.font = `700 ${format === "square" ? 30 : 42}px ${BODY_FONT}`;
    ctx.fillStyle = "#E7C66B";
    ctx.fillText(format === "story" ? `Order on ${product.link}` : product.link, M, H - M + (format === "story" ? -30 : 0));
  }

  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not create the image"))), "image/png"),
  );
}
