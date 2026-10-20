import { COMMON_COLORS } from "@/lib/productOptions";

/**
 * Guesses the main colour(s) of the item in a product photo, as names from
 * COMMON_COLORS. Runs on the phone: the photo is shrunk, the background is
 * estimated from the edges and ignored, centre pixels count more, and each
 * pixel votes for its nearest named colour.
 */

const SAMPLE_SIZE = 64;
const EDGE = 6;
/** How close (in Lab units) a pixel must be to the edge colour to count as background. */
const BACKGROUND_DISTANCE = 8;
/** Share of the item's pixels a colour needs to be reported. */
const MAIN_SHARE = 0.22;
const SECOND_SHARE = 0.3;
const MAX_COLORS = 2;
/** If less than this share of pixels looks like "item", use the whole photo. */
const MIN_FOREGROUND = 0.06;

type Lab = [number, number, number];

function srgbToLinear(c: number): number {
  const v = c / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
}

function rgbToLab(r: number, g: number, b: number): Lab {
  const R = srgbToLinear(r);
  const G = srgbToLinear(g);
  const B = srgbToLinear(b);
  const x = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047;
  const y = R * 0.2126 + G * 0.7152 + B * 0.0722;
  const z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
}

function hexToLab(hex: string): Lab {
  const n = parseInt(hex.slice(1), 16);
  return rgbToLab((n >> 16) & 255, (n >> 8) & 255, n & 255);
}

const distance = (a: Lab, b: Lab) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const PALETTE = COMMON_COLORS.map((c) => ({ name: c.name, lab: hexToLab(c.swatch) }));

/** Nearest named colour for a hex value (used by the custom colour picker too). */
export function nearestColorName(hex: string): string {
  const lab = hexToLab(hex);
  return PALETTE.reduce((best, c) => (distance(lab, c.lab) < distance(lab, best.lab) ? c : best)).name;
}

function nearestIndex(lab: Lab): number {
  let best = 0;
  let bestD = Infinity;
  PALETTE.forEach((c, i) => {
    const d = distance(lab, c.lab);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

async function loadPixels(file: File): Promise<Uint8ClampedArray | null> {
  const canvas = document.createElement("canvas");
  canvas.width = SAMPLE_SIZE;
  canvas.height = SAMPLE_SIZE;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  if ("createImageBitmap" in window) {
    const bitmap = await createImageBitmap(file);
    ctx.drawImage(bitmap, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    bitmap.close?.();
  } else {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      ctx.drawImage(img, 0, 0, SAMPLE_SIZE, SAMPLE_SIZE);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return ctx.getImageData(0, 0, SAMPLE_SIZE, SAMPLE_SIZE).data;
}

/** Main colour names in the photo, most dominant first (empty if it can't tell). */
export async function detectPhotoColors(file: File): Promise<string[]> {
  try {
    const data = await loadPixels(file);
    if (!data) return [];

    const labs: Lab[] = [];
    const edgeLabs: Lab[] = [];
    for (let y = 0; y < SAMPLE_SIZE; y++) {
      for (let x = 0; x < SAMPLE_SIZE; x++) {
        const i = (y * SAMPLE_SIZE + x) * 4;
        const lab = rgbToLab(data[i], data[i + 1], data[i + 2]);
        labs.push(lab);
        if (x < EDGE || y < EDGE || x >= SAMPLE_SIZE - EDGE || y >= SAMPLE_SIZE - EDGE) edgeLabs.push(lab);
      }
    }

    // Background = the average colour around the edges. Pixels close to it are ignored.
    const edgeMean: Lab = [0, 1, 2].map((k) => edgeLabs.reduce((sum, l) => sum + l[k], 0) / edgeLabs.length) as Lab;
    const isForeground = labs.map((lab) => distance(lab, edgeMean) > BACKGROUND_DISTANCE);
    const foregroundShare = isForeground.filter(Boolean).length / labs.length;

    const votes = new Array(PALETTE.length).fill(0);
    let total = 0;
    labs.forEach((lab, p) => {
      // When the item is the same colour as the background (white on white), use every pixel.
      if (foregroundShare >= MIN_FOREGROUND && !isForeground[p]) return;
      const x = p % SAMPLE_SIZE;
      const y = Math.floor(p / SAMPLE_SIZE);
      // Centre of the photo counts more: that's usually the item.
      const dx = (x - SAMPLE_SIZE / 2) / (SAMPLE_SIZE / 2);
      const dy = (y - SAMPLE_SIZE / 2) / (SAMPLE_SIZE / 2);
      const weight = Math.exp(-(dx * dx + dy * dy) * 1.5);
      votes[nearestIndex(lab)] += weight;
      total += weight;
    });
    if (!total) return [];

    const ranked = votes
      .map((v, i) => ({ name: PALETTE[i].name, share: v / total }))
      .sort((a, b) => b.share - a.share);
    return ranked
      .filter((c, i) => c.share >= (i === 0 ? MAIN_SHARE : SECOND_SHARE))
      .slice(0, MAX_COLORS)
      .map((c) => c.name);
  } catch (error) {
    console.warn("[photoColors] could not read photo colours", error);
    return [];
  }
}
