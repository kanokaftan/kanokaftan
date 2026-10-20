import { chromium } from '/home/user/kano-kaftan2/node_modules/playwright/index.mjs';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';

// Frames the raw live-site screenshots (from capture-live.mjs) into App Store slides.
const HERE = process.env.WORK_DIR || '/tmp/appstore-compose/';
const SHOTS = process.env.SHOTS_DIR || '/home/user/kanokaftan/marketing/app-store/raw/';
mkdirSync(HERE, { recursive: true });
const OUT = '/home/user/kanokaftan/marketing/app-store/';
mkdirSync(OUT, { recursive: true });

const CANVAS = { width: 1290, height: 2796 };
const FONT_DIR = '/home/user/kanokaftan/node_modules/@fontsource/';
const LOGO_SVG = readFileSync('/home/user/kanokaftan/public/logo.svg', 'utf8');
const logoUri = (k, shirt, shade) => 'data:image/svg+xml;base64,' + Buffer.from(
  LOGO_SVG.replaceAll('#111', k).replaceAll('#fff', shirt).replaceAll('#e4e4e4', shade).replaceAll('#e6e6e6', shade)).toString('base64');

export const SLIDES = [
  { file: '01-home.png', shot: 'home.png', theme: 'dark', headline: 'Kano’s best fashion, <em>in your pocket</em>', plain: 'Kano’s best fashion, in your pocket', sub: 'Kaftans, abayas, shoes, caps and bags from real Kano shops.' },
  { file: '02-shops.png', shot: 'shops.png', theme: 'light', headline: 'Shop <em>trusted</em>, verified sellers', plain: 'Shop trusted, verified sellers', sub: 'Gold and verified badges on every shop you visit.' },
  { file: '03-shop-page.png', shot: 'shop.png', theme: 'dark', headline: 'Every shop, <em>its own storefront</em>', plain: 'Every shop, its own storefront', sub: 'Follow your favourite sellers and see their new stock first.' },
  { file: '04-first-order-prices.png', shot: 'product.png', theme: 'light', headline: 'First-order prices from <em>every shop</em>', plain: 'First-order prices from every shop', sub: 'A welcome discount on your first order with each seller.' },
  { file: '05-chat.png', shot: 'chat.png', theme: 'dark', headline: 'Chat and call <em>sellers directly</em>', plain: 'Chat and call sellers directly', sub: 'Ask about sizes, colours and delivery in real time.' },
  { file: '06-invite-friends.png', shot: 'invite.png', theme: 'light', headline: 'Invite friends,<br><em>earn K²</em>', plain: 'Invite friends, earn K²', sub: '200 K² for every friend who joins. Spend it on anything.' },
  { file: '07-delivery.png', shot: 'order.png', theme: 'dark', headline: 'Delivery <em>handled for you</em>', plain: 'Delivery handled for you', sub: 'Track every step. Your payment is protected until it arrives.' },
];

const fontFace = (family, file, weight, style = 'normal') =>
  `@font-face{font-family:'${family}';src:url('file://${FONT_DIR}${file}') format('woff2');font-weight:${weight};font-style:${style};}`;

const FONTS = [
  fontFace('Playfair Display', 'playfair-display/files/playfair-display-latin-700-normal.woff2', 700),
  fontFace('Playfair Display', 'playfair-display/files/playfair-display-latin-600-italic.woff2', 600, 'italic'),
  fontFace('Playfair Display', 'playfair-display/files/playfair-display-latin-700-italic.woff2', 700, 'italic'),
  fontFace('Inter', 'inter/files/inter-latin-500-normal.woff2', 500),
  fontFace('Inter', 'inter/files/inter-latin-600-normal.woff2', 600),
  fontFace('Inter', 'inter/files/inter-latin-700-normal.woff2', 700),
].join('\n');

// Northern Nigerian lattice used as a faint backdrop texture.
const lattice = (stroke) => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">
  <path d="M60 6 L114 60 L60 114 L6 60Z" fill="none" stroke="${stroke}" stroke-width="2"/>
  <path d="M60 34 L86 60 L60 86 L34 60Z" fill="none" stroke="${stroke}" stroke-width="1.5"/>
  <circle cx="60" cy="60" r="5" fill="${stroke}"/><circle cx="0" cy="0" r="4" fill="${stroke}"/><circle cx="120" cy="0" r="4" fill="${stroke}"/>
  <circle cx="0" cy="120" r="4" fill="${stroke}"/><circle cx="120" cy="120" r="4" fill="${stroke}"/></svg>`).toString('base64');

const THEMES = {
  dark: {
    bg: 'radial-gradient(120% 70% at 50% 8%, #5A1D07 0%, #3A0E02 38%, #2A0800 62%, #1A0500 100%)',
    pattern: lattice('#E8C77A'), patternOpacity: 0.07,
    ink: '#FAF9F7', sub: 'rgba(250,249,247,0.78)', accent: '#E8C77A', eyebrow: '#E8C77A',
    glow: 'radial-gradient(closest-side, rgba(232,199,122,0.35), rgba(232,199,122,0))',
    logo: logoUri('#E8C77A', '#2A0800', '#3A0E02'),
  },
  light: {
    bg: 'radial-gradient(120% 70% at 50% 6%, #FFFFFF 0%, #FAF9F7 40%, #F1E7D6 100%)',
    pattern: lattice('#2A0800'), patternOpacity: 0.045,
    ink: '#2A0800', sub: 'rgba(42,8,0,0.70)', accent: '#A87A1F', eyebrow: '#A87A1F',
    glow: 'radial-gradient(closest-side, rgba(201,154,62,0.30), rgba(201,154,62,0))',
    logo: logoUri('#2A0800', '#FFFFFF', '#EFE6D8'),
  },
};

// Phone geometry (CSS px on the 1290x2796 canvas).
const APP = { width: 430, height: 932 };
const SCREEN_W = 850;
const SCALE = SCREEN_W / APP.width;
const STATUS_H = Math.round(54 * SCALE);
const SCREEN_H = Math.round(APP.height * SCALE) + STATUS_H;
const BEZEL = 22;
const PHONE_W = SCREEN_W + BEZEL * 2;
const PHONE_H = SCREEN_H + BEZEL * 2;
const PHONE_BOTTOM_MARGIN = 64;
const PHONE_TOP = CANVAS.height - PHONE_H - PHONE_BOTTOM_MARGIN;

function statusIcons(color) {
  return `<svg width="190" height="44" viewBox="0 0 190 44" fill="${color}">
    <rect x="0" y="26" width="9" height="12" rx="2"/><rect x="14" y="20" width="9" height="18" rx="2"/>
    <rect x="28" y="13" width="9" height="25" rx="2"/><rect x="42" y="6" width="9" height="32" rx="2"/>
    <path d="M90 36 l-6.5-6.5 a9.5 9.5 0 0 1 13 0Z"/>
    <path d="M77 22 a19 19 0 0 1 26 0 l-4.4 4.4 a12.5 12.5 0 0 0 -17.2 0Z"/>
    <path d="M70 15 a29 29 0 0 1 40 0 l-4.4 4.4 a22.5 22.5 0 0 0 -31.2 0Z"/>
    <rect x="124" y="9" width="54" height="27" rx="8" fill="none" stroke="${color}" stroke-width="3" opacity="0.45"/>
    <rect x="129" y="14" width="40" height="17" rx="4"/>
    <rect x="181" y="17" width="4" height="11" rx="2" opacity="0.45"/></svg>`;
}

function slideHtml(slide, shotUri) {
  const t = THEMES[slide.theme];
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${FONTS}
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{width:${CANVAS.width}px;height:${CANVAS.height}px;overflow:hidden}
  body{background:${t.bg};font-family:'Inter',sans-serif;position:relative;-webkit-font-smoothing:antialiased}
  .pattern{position:absolute;inset:0;background-image:url('${t.pattern}');background-size:120px 120px;opacity:${t.patternOpacity};
    -webkit-mask-image:linear-gradient(to bottom,#000 0%,rgba(0,0,0,.6) 40%,rgba(0,0,0,.15) 100%)}
  .copy{position:absolute;left:90px;right:90px;top:116px;text-align:center}
  .eyebrow{display:inline-flex;align-items:center;gap:22px;color:${t.eyebrow};font:600 34px/1 'Inter';letter-spacing:.24em;text-transform:uppercase}
  .eyebrow img{width:72px;height:72px}
  .rule{display:block;width:120px;height:4px;border-radius:2px;background:${t.accent};margin:40px auto 0;opacity:.9}
  h1{margin-top:36px;color:${t.ink};font:700 110px/1.06 'Playfair Display',serif;letter-spacing:-.012em;text-wrap:balance}
  h1 em{font-style:italic;font-weight:700;color:${t.accent}}
  p{margin:30px auto 0;max-width:1040px;color:${t.sub};font:500 44px/1.3 'Inter';text-wrap:balance}
  .glow{position:absolute;left:50%;top:${PHONE_TOP + 120}px;width:1500px;height:1500px;transform:translateX(-50%);background:${t.glow}}
  .phone{position:absolute;left:${(CANVAS.width - PHONE_W) / 2}px;top:${PHONE_TOP}px;width:${PHONE_W}px;height:${PHONE_H}px;
    border-radius:132px;padding:${BEZEL}px;background:linear-gradient(145deg,#4a4038,#16110e 40%,#2b241f 70%,#5b4c40);
    box-shadow:0 0 0 3px rgba(232,199,122,.55),0 60px 120px rgba(26,5,0,.55),0 20px 40px rgba(26,5,0,.35)}
  .phone::before{content:'';position:absolute;inset:7px;border-radius:126px;border:2px solid rgba(255,255,255,.08);pointer-events:none}
  .btn{position:absolute;width:8px;border-radius:4px;background:#2b241f}
  .screen{position:relative;width:${SCREEN_W}px;height:${SCREEN_H}px;border-radius:${132 - BEZEL}px;overflow:hidden;background:#fff}
  .status{position:absolute;left:0;right:0;top:0;height:${STATUS_H}px;display:flex;align-items:center;justify-content:space-between;padding:8px 64px 0 86px;font:600 40px/1 'Inter';letter-spacing:-.01em}
  .island{position:absolute;top:24px;left:50%;transform:translateX(-50%);width:252px;height:72px;border-radius:40px;background:#000}
  .shot{position:absolute;left:0;top:${STATUS_H}px;width:${SCREEN_W}px;height:${SCREEN_H - STATUS_H}px;display:block}
  .hl{position:absolute;border:5px solid #E8C77A;border-radius:28px;box-shadow:0 0 0 10px rgba(232,199,122,.28),0 0 60px rgba(232,199,122,.55)}
  .home-ind{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);width:300px;height:10px;border-radius:5px;background:rgba(0,0,0,.75)}
  </style></head><body>
  <div class="pattern"></div>
  <div class="glow"></div>
  <div class="copy">
    <div class="eyebrow"><img src="${t.logo}" alt="">Kano Kaftan</div>
    <span class="rule"></span>
    <h1>${slide.headline}</h1>
    <p>${slide.sub}</p>
  </div>
  <div class="phone">
    <div class="btn" style="left:-8px;top:330px;height:110px"></div>
    <div class="btn" style="left:-8px;top:480px;height:170px"></div>
    <div class="btn" style="left:-8px;top:680px;height:170px"></div>
    <div class="btn" style="right:-8px;top:520px;height:250px"></div>
    <div class="screen" id="screen">
      <div class="status" id="status"><span>9:41</span><span id="icons"></span></div>
      <div class="island"></div>
      <img class="shot" id="shot" src="${shotUri}">
      <div class="home-ind" id="homeind"></div>
    </div>
  </div>
  ${slide.highlight ? `<div class="hl" style="left:${(CANVAS.width - PHONE_W) / 2 + BEZEL + slide.highlight.x * SCALE}px;top:${PHONE_TOP + BEZEL + STATUS_H + slide.highlight.y * SCALE}px;width:${slide.highlight.w * SCALE}px;height:${slide.highlight.h * SCALE}px"></div>` : ''}
  <script>
    // Status bar takes its colour from the top of the app screenshot so it blends in.
    window.ready = new Promise((resolve) => {
      const img = document.getElementById('shot');
      const go = () => {
        const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
        const ctx = c.getContext('2d'); ctx.drawImage(img, 0, 0);
        const [r, g, b] = ctx.getImageData(12, 4, 1, 1).data;
        const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        const fg = lum > 0.55 ? '#111' : '#fff';
        const st = document.getElementById('status'); st.style.background = 'rgb(' + r + ',' + g + ',' + b + ')'; st.style.color = fg;
        document.getElementById('screen').style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
        document.getElementById('icons').innerHTML = ${JSON.stringify(statusIcons('FG'))}.replaceAll('FG', fg);
        const [br, bg, bb] = ctx.getImageData(Math.round(img.naturalWidth / 2), img.naturalHeight - 6, 1, 1).data;
        const blum = (0.299 * br + 0.587 * bg + 0.114 * bb) / 255;
        document.getElementById('homeind').style.background = blum > 0.55 ? 'rgba(0,0,0,.75)' : 'rgba(255,255,255,.85)';
        resolve();
      };
      img.complete ? go() : img.addEventListener('load', go);
    });
  </script>
  </body></html>`;
}

function overviewHtml(files) {
  const THUMB_W = 380;
  const thumbH = Math.round((THUMB_W * CANVAS.height) / CANVAS.width);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
  ${FONTS}
  *{margin:0;box-sizing:border-box}
  body{background:#EDE6DA;padding:80px;display:inline-block;font-family:'Inter'}
  h2{font:700 56px/1 'Playfair Display';color:#2A0800;margin-bottom:12px}
  .meta{font:500 26px/1 'Inter';color:rgba(42,8,0,.65);margin-bottom:56px}
  .row{display:flex;gap:40px}
  figure{width:${THUMB_W}px}
  img{width:${THUMB_W}px;height:${thumbH}px;border-radius:28px;box-shadow:0 18px 40px rgba(42,8,0,.25);display:block}
  figcaption{margin-top:22px;font:600 22px/1.35 'Inter';color:#2A0800}
  figcaption span{display:block;font-weight:500;color:rgba(42,8,0,.6)}
  </style></head><body>
  <h2>K² Kano Kaftan · App Store screenshots</h2>
  <div class="meta">${files.length} slides · 1290 × 2796 (iPhone 6.9″ / 6.7″)</div>
  <div class="row">${files.map((f) => `<figure><img src="${f.uri}"><figcaption>${f.file}<span>${f.plain}</span></figcaption></figure>`).join('')}</div>
  </body></html>`;
}

const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--allow-file-access-from-files'] });
const page = await browser.newPage({ viewport: CANVAS, deviceScaleFactor: 1 });
const done = [];
for (const slide of SLIDES) {
  const shotUri = 'data:image/png;base64,' + readFileSync(SHOTS + slide.shot).toString('base64');
  const htmlPath = HERE + 'slide-' + slide.file.replace('.png', '.html');
  writeFileSync(htmlPath, slideHtml(slide, shotUri));
  await page.goto('file://' + htmlPath);
  await page.evaluate(() => window.ready);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: OUT + slide.file, clip: { x: 0, y: 0, ...CANVAS } });
  done.push({ ...slide, uri: 'data:image/png;base64,' + readFileSync(OUT + slide.file).toString('base64') });
  console.log('slide', slide.file);
}
const ovPath = HERE + 'overview.html';
writeFileSync(ovPath, overviewHtml(done));
const ov = await browser.newPage({ viewport: { width: 800, height: 600 }, deviceScaleFactor: 1 });
await ov.goto('file://' + ovPath);
await ov.evaluate(() => document.fonts.ready);
await ov.waitForTimeout(300);
await ov.locator('body').screenshot({ path: OUT + 'overview.png' });
console.log('overview done');
await browser.close();
