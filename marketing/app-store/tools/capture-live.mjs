// Screenshots of the LIVE site (www.kanokaftan.shop) for the App Store slides.
// Real shops, logos, products and photos come straight from the live backend.
// Only the signed-in parts that belong to one person (the shopper's chat, invite
// numbers and order) are filled in, using real shops and products.
//
// Run by .github/workflows/appstore-capture.yml (needs internet access).
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const SITE = process.env.SITE || 'https://www.kanokaftan.shop';
// MODE=reel captures scrolling screens and real product photos for the marketing reels instead.
const MODE = process.env.MODE || 'appstore';
const OUT = process.env.SHOTS_DIR || 'marketing/app-store/raw/';
mkdirSync(OUT, { recursive: true });
const AUTH_KEY = 'sb-anptvdidwxiigzkqhdia-auth-token';
const STORAGE = 'https://anptvdidwxiigzkqhdia.supabase.co/storage/v1/object/public/product-images/';

const NOW = new Date('2026-10-20T11:20:00+01:00').getTime();
const minsAgo = (m) => new Date(NOW - m * 60000).toISOString();
const daysAgo = (d) => new Date(NOW - d * 86400000).toISOString();
const ahead = (d) => new Date(NOW + d * 86400000).toISOString();

const user = {
  id: '11111111-1111-1111-1111-111111111111', aud: 'authenticated', role: 'authenticated',
  email: 'aisha.bello@gmail.com', phone: '', app_metadata: { provider: 'email' },
  user_metadata: { full_name: 'Aisha Bello' }, created_at: daysAgo(40),
};

// Real shop and products (from the live database).
const MK = { id: '77db0bb0-bb82-42ef-bc3e-00bfaf502bc1', name: 'MK Shoes', slug: 'mk-shoes', avatar: STORAGE + '77db0bb0-bb82-42ef-bc3e-00bfaf502bc1/avatar.jpeg?t=1791672269172' };
const FUMO = { id: '92357c7b-ba2f-4ecc-b6b8-55ce7364e7db', name: 'Fumo Wears', slug: 'fumo-wears-mvff5sl4', price: 12500 };
const ZOTO = { id: '9677d57c-91ff-4dc3-90be-856d98130835', name: 'ZoTo Original', slug: 'zoto-original-mv377ccz', price: 30000 };

const CONV = '5b1f4c7e-2d3a-4e8f-9a10-c0ffee000001';
const msg = (i, mine, body, m) => ({ id: `00000000-0000-4000-8000-00000000000${i}`, conversation_id: CONV, sender_id: mine ? user.id : MK.id, body, message_type: 'text', media_path: null, product_id: null, reply_to_id: null, created_at: minsAgo(m), read_at: minsAgo(m - 1) });
const messages = [
  msg(1, true, 'Salaam! Do you have Fumo Wears in size 43?', 46),
  msg(2, false, 'Wa alaikum salaam. Yes, 43 is available in black and brown.', 44),
  msg(3, true, 'Black please. How long will delivery to Nassarawa take?', 40),
  msg(4, false, 'Same day in Kano. Order before 2pm and the rider brings it this evening.', 37),
  msg(5, true, 'Great, ordering now 🙏', 35),
  msg(6, false, 'Thank you! Na gode.', 34),
];
const inbox = [{
  id: CONV, kind: 'shop', role: 'customer', other_party_id: MK.id, other_party_name: MK.name, other_party_avatar: MK.avatar,
  other_party_is_vendor: true, shop_slug: MK.slug, product_id: FUMO.id, product_name: FUMO.name, product_slug: FUMO.slug,
  last_message_at: messages.at(-1).created_at, last_message_preview: messages.at(-1).body, unread: false,
}];

const ORDER_ID = 'a3f9c2e1-7b4d-4e8a-9c21-5d6e7f8a9b0c';
const order = {
  id: ORDER_ID, user_id: user.id, status: 'out_for_delivery', payment_status: 'paid', payment_reference: 'KK-7Q2M9X',
  subtotal: FUMO.price + ZOTO.price, shipping_fee: 1500, total: FUMO.price + ZOTO.price + 1500 - 625, credit_used: 0, first_buyer_discount: 625,
  shipping_address: { full_name: 'Aisha Bello', phone: '0803 456 7812', street_address: 'Zoo Road, Nassarawa GRA', city: 'Kano', state: 'Kano', landmark: 'Opposite Ado Bayero Mall' },
  notes: null, escrow_status: 'held', delivery_type: 'standard', estimated_delivery_date: ahead(0.2),
  tracking_updates: [
    { status: 'payment_confirmed', message: 'Payment received. Your money is held safely until delivery.', timestamp: minsAgo(300) },
    { status: 'ready_for_pickup', message: 'MK Shoes packed your order.', timestamp: minsAgo(200) },
    { status: 'shipped', message: 'Collected by the Kano Kaftan rider.', timestamp: minsAgo(90) },
    { status: 'out_for_delivery', message: 'The rider is on the way to you.', timestamp: minsAgo(25) },
  ],
  confirmed_at: null, auto_release_at: ahead(4), shipped_at: minsAgo(90), dispute_status: null, dispute_reason: null,
  created_at: minsAgo(300), updated_at: minsAgo(25),
  order_items: [
    { id: 'oi1', order_id: ORDER_ID, product_id: FUMO.id, product_name: FUMO.name, variant_name: null, size: '43', color: 'Black', quantity: 1, unit_price: FUMO.price, total_price: FUMO.price, vendor_id: MK.id, created_at: minsAgo(300) },
    { id: 'oi2', order_id: ORDER_ID, product_id: ZOTO.id, product_name: ZOTO.name, variant_name: null, size: '43', color: null, quantity: 1, unit_price: ZOTO.price, total_price: ZOTO.price, vendor_id: MK.id, created_at: minsAgo(300) },
  ],
};

const referral = {
  enabled: true, code: 'AISHA482', friend_credit: 0, referrer_credit: 200, order_percent: 5, min_order: 0, balance: 1400, joined: 9, rewarded: 7, verified: 7, bank_verified: true, earned: 1650,
  friends: [
    { id: 'f1', name: 'Musa', status: 'rewarded', joined_at: daysAgo(9), rewarded_at: daysAgo(2), earned: 450, pings: 0, can_ping: false },
    { id: 'f2', name: 'Zainab', status: 'rewarded', joined_at: daysAgo(6), rewarded_at: daysAgo(5), earned: 200, pings: 0, can_ping: false },
    { id: 'f3', name: 'Umar', status: 'rewarded', joined_at: daysAgo(3), rewarded_at: daysAgo(3), earned: 200, pings: 0, can_ping: false },
    { id: 'f4', name: 'Bala', status: 'joined', joined_at: daysAgo(1), rewarded_at: null, earned: 0, pings: 0, can_ping: true },
  ],
  history: [
    { amount: 200, kind: 'referral_reward', order_id: null, created_at: daysAgo(1) },
    { amount: 250, kind: 'referral_commission', order_id: 'o1', created_at: daysAgo(2) },
  ],
};

const log = [];
/** The site's public (anon) key, seen on its own requests; used to list product photos. */
let publicKey = null;
const note = (s) => { log.push(s); console.log(s); };
const qp = (url, key) => new URL(url).searchParams.get(key) || '';

function list(route, rows, single) {
  if (single) return route.fulfill({ json: rows[0] ?? null });
  return route.fulfill({ json: rows, headers: { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}`, 'access-control-expose-headers': 'content-range' } });
}

/** Personal data is filled in; everything else goes to the real backend as a signed-out visitor. */
async function router(route, opts) {
  const req = route.request();
  const full = req.url();
  const url = full.split('?')[0];
  const fn = url.split('/').pop();
  const single = req.headers()['accept']?.includes('vnd.pgrst.object');
  const body = (() => { try { return req.postDataJSON() || {}; } catch { return {}; } })();

  if (url.includes('/realtime/')) return route.abort();
  if (req.headers().apikey) publicKey = req.headers().apikey;
  if (opts.guest && url.includes('/auth/v1/')) return route.fulfill({ status: 401, json: { message: 'not signed in' } });
  if (url.includes('/auth/v1/user')) return route.fulfill({ json: user });
  if (url.includes('/auth/v1/')) return route.fulfill({ json: {} });

  if (url.includes('/rpc/')) {
    switch (fn) {
      case 'has_role': return route.fulfill({ json: false });
      case 'track_events': case 'touch_last_seen': case 'record_my_device': case 'mark_conversation_read': case 'mark_call_seen':
        return route.fulfill({ json: null });
      case 'first_buyer_status': return route.fulfill({ json: { first_buyer: true, signed_in: true, bank_verified: true } });
      case 'my_buyer_bank_account': return route.fulfill({ json: { bank_name: 'GTBank', last4: '4821', account_name: 'AISHA BELLO', verified_at: daysAgo(10), number_saved: true } });
      case 'my_customer_credit': case 'my_credit': return route.fulfill({ json: { balance: 1400, min_order: 0 } });
      case 'my_referral': return route.fulfill({ json: referral });
      case 'list_inbox': return route.fulfill({ json: inbox });
      case 'guest_cart': return route.fulfill({ json: [] });
      case 'my_ambassador_dashboard': case 'my_ambassador_application': case 'my_partner': case 'my_logistics_company_id':
        return route.fulfill({ json: null });
      case 'get_delivery_code': case 'my_delivery_code': case 'order_delivery_code': return route.fulfill({ json: '482615' });
      case 'conversation_presence': return route.fulfill({ json: { online: true, last_seen_at: minsAgo(1) } });
      case 'referral_invite': return route.fulfill({ json: { valid: true, inviter: 'Aisha' } });
      case 'conversation_block_state': return route.fulfill({ json: { blocked_by_me: false, blocked_me: false } });
      default: break; // real backend
    }
  }

  const table = url.match(/\/rest\/v1\/([^/]+)$/)?.[1];
  if (table) {
    const mineProfile = table === 'profiles' && qp(full, 'id') === `eq.${user.id}`;
    switch (true) {
      case table === 'messages': return list(route, opts.messages ?? [], single);
      case table === 'conversations':
        return route.fulfill({ json: single ? { id: CONV, kind: 'shop', customer_id: user.id, vendor_id: MK.id, product_id: FUMO.id, customer_last_read_at: new Date(NOW).toISOString(), vendor_last_read_at: new Date(NOW).toISOString() } : [] });
      case table === 'orders': return list(route, opts.orders ?? [], single);
      case table === 'order_deliveries': return list(route, opts.orders ? [{ order_id: ORDER_ID, delivery_company: 'Kano Kaftan Riders', company_phone: null, pickup_code: '482615', rider_name: 'Sani', rider_phone: null }] : [], single);
      case table === 'calls': case table === 'cart_items': case table === 'notifications': case table === 'wishlists':
      case table === 'message_reactions': case table === 'customer_credits':
        return list(route, [], single);
      case mineProfile: return route.fulfill({ json: single ? { id: user.id, avatar_url: null, full_name: 'Aisha Bello', store_name: null, phone: '08034567812' } : [] });
      case table === 'delivery_addresses':
        return list(route, [{ id: 'a1', user_id: user.id, full_name: 'Aisha Bello', phone: '0803 456 7812', street_address: 'Zoo Road, Nassarawa GRA', city: 'Kano', state: 'Kano', landmark: 'Opposite Ado Bayero Mall', is_default: true, latitude: null, longitude: null }], single);
      default: break;
    }
  }

  // Real backend, as a signed-out visitor (the app's own public key).
  const headers = { ...req.headers() };
  if (headers.apikey) headers.authorization = `Bearer ${headers.apikey}`;
  return route.continue({ headers });
}

const browser = await chromium.launch();
const errors = [];

async function newPage(opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
    serviceWorkers: 'block', locale: 'en-NG', timezoneId: 'Africa/Lagos', colorScheme: 'light', reducedMotion: 'reduce',
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(30000);
  await page.clock.setFixedTime(new Date(NOW));
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript(([key, u, guest, lang]) => {
    try {
      if (!guest) localStorage.setItem(key, JSON.stringify({ access_token: 'x.eyJzdWIiOiIxIn0.x', refresh_token: 'r', expires_at: Math.floor(Date.now() / 1000) + 3600, expires_in: 3600, token_type: 'bearer', user: u }));
      localStorage.setItem('i18nextLng', lang);
      localStorage.setItem('kk-push-prompt-dismissed', String(Date.now()));
      localStorage.setItem('pwa-install-dismissed', String(Date.now()));
    } catch { /* storage unavailable */ }
    const style = document.createElement('style');
    style.textContent = '[data-sonner-toaster]{display:none!important} vercel-live-feedback{display:none!important} *{scrollbar-width:none!important} ::-webkit-scrollbar{display:none!important}';
    document.addEventListener('DOMContentLoaded', () => document.head.appendChild(style));
  }, [AUTH_KEY, user, !!opts.guest, opts.lang || 'en']);
  await page.route(/supabase\.co/, (route) => router(route, opts).catch((e) => { note('route error ' + e.message); return route.abort(); }));
  return page;
}

async function settle(page, text, extra = 1500) {
  if (text) await page.getByText(text).first().waitFor({ timeout: 25000 }).catch(() => note('MISSING text: ' + text));
  await page.waitForTimeout(extra);
  await page.evaluate(() => Promise.race([
    Promise.all([...document.images].map((i) => (i.complete ? null : new Promise((r) => { i.addEventListener('load', r); i.addEventListener('error', r); })))),
    new Promise((r) => setTimeout(r, 8000)),
  ]));
  await page.waitForTimeout(600);
}

async function shot(name, path, text, opts = {}, after) {
  try {
    const page = await newPage(opts);
    await page.goto(SITE + path, { waitUntil: 'domcontentloaded' });
    await settle(page, text);
    // Which build of the site was captured (its main script name changes with every deploy).
    const build = await page.evaluate(() => document.querySelector('script[type=module][src*="/assets/"]')?.getAttribute('src') ?? 'unknown');
    note(`${name}: site build ${build}`);
    if (after) await after(page);
    await page.screenshot({ path: OUT + name + '.png' });
    // A taller version too, in case the slide needs more of the page.
    await page.screenshot({ path: OUT + name + '-full.png', fullPage: true });
    note('captured ' + name);
    await page.context().close();
  } catch (e) {
    note(`FAILED ${name}: ${e.message}`);
  }
}

/** Scrolls the page so lazy photos load, saves the bottom tab bar on its own, then the whole page without it. */
async function scrollShot(name, path, text, opts = {}) {
  try {
    const page = await newPage(opts);
    await page.goto(SITE + path, { waitUntil: 'domcontentloaded' });
    await settle(page, text);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < height; y += 500) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await page.waitForTimeout(350);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await settle(page, null, 800);
    await page.screenshot({ path: OUT + name + '.png' });
    const bar = await page.evaluate(() => {
      const fixed = [...document.querySelectorAll('body *')].filter((el) => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return (cs.position === 'fixed' || cs.position === 'sticky') && r.bottom >= window.innerHeight - 4 && r.top > window.innerHeight / 2 && r.height > 20;
      });
      fixed.forEach((el) => el.setAttribute('data-reel-bottom', '1'));
      const el = fixed[0];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    if (bar) await page.screenshot({ path: OUT + name + '-tabbar.png', clip: bar, omitBackground: true });
    await page.addStyleTag({ content: '[data-reel-bottom]{display:none!important}' });
    await page.waitForTimeout(300);
    await page.screenshot({ path: OUT + name + '-scroll.png', fullPage: true });
    note(`captured ${name} (${height}px tall${bar ? ', tab bar saved' : ''})`);
    await page.context().close();
  } catch (e) {
    note(`FAILED ${name}: ${e.message}`);
  }
}

/** Downloads real product photos (full size) with their names and prices. */
async function savePhotos(limit = 40) {
  if (!publicKey) return note('FAILED photos: no public key seen');
  mkdirSync(OUT + 'photos', { recursive: true });
  const api = 'https://anptvdidwxiigzkqhdia.supabase.co/rest/v1/product_images?select=url,display_order,products!inner(name,price,slug,is_active,categories(slug))&products.is_active=eq.true&order=created_at.desc&limit=' + limit;
  const res = await fetch(api, { headers: { apikey: publicKey, authorization: 'Bearer ' + publicKey } });
  if (!res.ok) return note('FAILED photos: ' + res.status);
  const rows = await res.json();
  const index = [];
  for (const [i, row] of rows.entries()) {
    try {
      const img = await fetch(row.url.startsWith('http') ? row.url : STORAGE + row.url);
      if (!img.ok) continue;
      const ext = (img.headers.get('content-type') || '').includes('png') ? 'png' : 'jpg';
      const file = `photo-${String(i + 1).padStart(2, '0')}.${ext}`;
      writeFileSync(OUT + 'photos/' + file, Buffer.from(await img.arrayBuffer()));
      index.push({ file, name: row.products.name, price: row.products.price, category: row.products.categories?.slug ?? null, slug: row.products.slug });
    } catch (e) {
      note('photo failed ' + row.url + ' ' + e.message);
    }
  }
  writeFileSync(OUT + 'photos/index.json', JSON.stringify(index, null, 2));
  note(`saved ${index.length} product photos`);
}

/** Every photo of one shop's products, plus its logo and banner, and the logos/banners of the other shops. */
async function saveShopMedia(slug) {
  if (!publicKey) return note('FAILED shop media: no public key seen');
  const base = 'https://anptvdidwxiigzkqhdia.supabase.co/rest/v1/';
  const get = async (q) => {
    const res = await fetch(base + q, { headers: { apikey: publicKey, authorization: 'Bearer ' + publicKey } });
    if (!res.ok) throw new Error(q + ' ' + res.status);
    return res.json();
  };
  const save = async (url, file) => {
    const img = await fetch(url.startsWith('http') ? url : STORAGE + url);
    if (!img.ok) return false;
    writeFileSync(OUT + 'shop/' + file, Buffer.from(await img.arrayBuffer()));
    return true;
  };
  mkdirSync(OUT + 'shop', { recursive: true });
  const index = { shop: null, products: [], others: [] };
  try {
    const [shop] = await get(`profiles?select=id,store_name,store_slug,avatar_url,store_banner_url,store_description,verification_tier&store_slug=eq.${slug}`);
    index.shop = shop;
    if (shop.avatar_url) await save(shop.avatar_url, 'avatar.jpg');
    if (shop.store_banner_url) await save(shop.store_banner_url, 'banner.jpg');
    const products = await get(`products?select=id,name,slug,price,compare_at_price,colors,sizes,product_images(url,display_order)&vendor_id=eq.${shop.id}&is_active=eq.true&order=created_at.desc`);
    for (const [pi, p] of products.entries()) {
      const files = [];
      const imgs = [...(p.product_images || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
      for (const [ii, im] of imgs.entries()) {
        const file = `p${pi + 1}-${ii + 1}.jpg`;
        if (await save(im.url, file)) files.push(file);
      }
      index.products.push({ name: p.name, slug: p.slug, price: p.price, compare_at_price: p.compare_at_price, colors: p.colors, sizes: p.sizes, files });
    }
    const others = await get(`profiles?select=store_name,store_slug,avatar_url,store_banner_url,verification_tier&store_slug=not.is.null&store_slug=neq.${slug}&limit=30`);
    for (const [oi, o] of others.entries()) {
      const entry = { name: o.store_name, slug: o.store_slug, tier: o.verification_tier, avatar: null, banner: null };
      if (o.avatar_url && (await save(o.avatar_url, `other${oi + 1}-avatar.jpg`))) entry.avatar = `other${oi + 1}-avatar.jpg`;
      if (o.store_banner_url && (await save(o.store_banner_url, `other${oi + 1}-banner.jpg`))) entry.banner = `other${oi + 1}-banner.jpg`;
      index.others.push(entry);
    }
  } catch (e) {
    note('FAILED shop media: ' + e.message);
  }
  writeFileSync(OUT + 'shop/index.json', JSON.stringify(index, null, 2));
  note(`saved shop media: ${index.products.length} products, ${index.others.length} other shops`);
}

/** Every shop's logo and banner, and every active product's photos with its shop, for seller-recruitment reels. */
async function saveMarketMedia() {
  if (!publicKey) return note('FAILED market media: no public key seen');
  const base = 'https://anptvdidwxiigzkqhdia.supabase.co/rest/v1/';
  const get = async (q) => {
    const res = await fetch(base + q, { headers: { apikey: publicKey, authorization: 'Bearer ' + publicKey } });
    if (!res.ok) throw new Error(q + ' ' + res.status);
    return res.json();
  };
  const save = async (url, file) => {
    const img = await fetch(url.startsWith('http') ? url : STORAGE + url);
    if (!img.ok) return false;
    writeFileSync(OUT + 'market/' + file, Buffer.from(await img.arrayBuffer()));
    return true;
  };
  mkdirSync(OUT + 'market', { recursive: true });
  const index = { shops: [], products: [] };
  try {
    const shops = await get('profiles?select=id,store_name,store_slug,avatar_url,store_banner_url,verification_tier&store_slug=not.is.null');
    for (const [i, sh] of shops.entries()) {
      const entry = { name: sh.store_name, slug: sh.store_slug, tier: sh.verification_tier, avatar: null, banner: null };
      if (sh.avatar_url && (await save(sh.avatar_url, `shop${i + 1}-avatar.jpg`))) entry.avatar = `shop${i + 1}-avatar.jpg`;
      if (sh.store_banner_url && (await save(sh.store_banner_url, `shop${i + 1}-banner.jpg`))) entry.banner = `shop${i + 1}-banner.jpg`;
      index.shops.push({ ...entry, id: undefined });
      sh.entry = entry;
    }
    const byId = Object.fromEntries(shops.map((sh) => [sh.id, sh.store_name]));
    const products = await get('products?select=name,slug,price,compare_at_price,vendor_id,product_images(url,display_order)&is_active=eq.true&order=created_at.desc');
    for (const [pi, p] of products.entries()) {
      const imgs = [...(p.product_images || [])].sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0)).slice(0, 2);
      const files = [];
      for (const [ii, im] of imgs.entries()) {
        const file = `prod${pi + 1}-${ii + 1}.jpg`;
        if (await save(im.url, file)) files.push(file);
      }
      index.products.push({ name: p.name, slug: p.slug, price: p.price, compare_at_price: p.compare_at_price, shop: byId[p.vendor_id] ?? null, files });
    }
  } catch (e) {
    note('FAILED market media: ' + e.message);
  }
  writeFileSync(OUT + 'market/index.json', JSON.stringify(index, null, 2));
  note(`saved market media: ${index.shops.length} shops, ${index.products.length} products`);
}

if (MODE === 'seller') {
  await scrollShot('sell-ha', '/sell', 'Kano Kaftan', { guest: true, lang: 'ha' });
  await scrollShot('sell-en', '/sell', 'Kano Kaftan', { guest: true });
  await scrollShot('shops', '/shops', 'MK Shoes');
  await scrollShot('home', '/', 'MK Shoes');
  for (const slug of ['mk-shoes', 'queen-s-land-collection', 'm-asharif-genaral-merchandise', 'hajmeer-enterprises']) {
    await scrollShot('shop-' + slug, '/shop/' + slug, 'Products');
  }
  await saveMarketMedia();
} else if (MODE === 'shop') {
  const slug = process.env.SHOP_SLUG || 'hajmeer-enterprises';
  await scrollShot('shop', '/shop/' + slug, 'Hajmeer');
  await scrollShot('shops', '/shops', 'MK Shoes');
  await scrollShot('home', '/', 'MK Shoes');
  for (const p of ['exclusive-rings-mvgtqgo3', 'original-nice-style-shoe-mvgt9zzf', 'original-lv-mvgt4dc8', 'nice-style-shoes-mvftv84v']) {
    await scrollShot('product-' + p, '/products/' + p, 'Hajmeer');
  }
  await saveShopMedia(slug);
} else if (MODE === 'reel') {
  await scrollShot('home', '/', 'MK Shoes');
  await scrollShot('invite', '/invite', '200 K²');
  await scrollShot('profile', '/profile', 'Aisha');
  await scrollShot('invite-landing', '/invite/AISHA482', 'invited you', { guest: true });
  await scrollShot('shops', '/shops', 'MK Shoes');
  await scrollShot('product', '/products/egyptian-abaya-mv3v8bfn', 'Egyptian abaya');
  await scrollShot('product2', '/products/royal-jacket-falmaran-mv57jw9l', 'ROYAL JACKET');
  await savePhotos();
} else {
  await shot('home', '/', 'MK Shoes');
  await shot('shops', '/shops', 'MK Shoes');
  await shot('product', '/products/' + FUMO.slug, FUMO.name);
  await shot('shop', '/shop/' + MK.slug, MK.name);
  await shot('chat', '/messages/' + CONV, 'Na gode', { messages });
  await shot('invite', '/invite', '200 K²');
  await shot('order', '/orders/' + ORDER_ID, FUMO.name, { orders: [order] });
}

note(errors.length ? 'PAGE ERRORS: ' + [...new Set(errors)].join(' | ') : 'no page errors');
writeFileSync(OUT + 'capture-log.txt', log.join('\n') + '\n');
await browser.close();
