# K² Kano Kaftan – App Store screenshots

Seven marketing screenshots for the App Store listing, each **1290 × 2796 px** (portrait), the size App Store Connect asks for under the iPhone 6.9″ / 6.7″ display slot.

These are **real screens from the live app** (www.kanokaftan.shop): real shops, logos, products, prices and photos. The shopper's own chat, invite numbers and order are filled in with real MK Shoes products, because those screens are private to each customer.

| # | File | Headline | App screen |
|---|------|----------|------------|
| 1 | `01-home.png` | Kano’s best fashion, in your pocket | Home |
| 2 | `02-shops.png` | Shop trusted, verified sellers | Shops directory |
| 3 | `03-shop-page.png` | Every shop, its own storefront | MK Shoes shop page |
| 4 | `04-first-order-prices.png` | First-order prices from every shop | Fumo Wears (MK Shoes) with its first-order price |
| 5 | `05-chat.png` | Chat and call sellers directly | Chat with MK Shoes |
| 6 | `06-invite-friends.png` | Invite friends, earn K² | Invite friends |
| 7 | `07-delivery.png` | Delivery handled for you | Order tracking and delivery code |

`overview.png` is a contact sheet of all six side by side, for quick review. Don't upload it to the App Store.

## Uploading

- In App Store Connect, open the app version and go to **App Previews and Screenshots → iPhone 6.9″ Display**. Drag in files `01` to `07` in that order.
- These PNGs are RGB with no transparency, so App Store Connect accepts them as they are.
- **Need 1242 × 2688 (6.5″)?** Resize each file to that size. The aspect ratio is almost the same, so nothing important gets cropped. For example:
  `sips -z 2688 1242 01-home.png --out 6.5/01-home.png` (macOS), or
  `magick 01-home.png -resize 1242x2688! 6.5/01-home.png` (ImageMagick).

## How they were made

- The app screens are real renders of the Kano Kaftan PWA. It was built locally and opened in headless Chromium at 430 × 932 with a device scale factor of 3, against mocked backend data (sample Kano shops, products and orders).
- The product photos are generated illustrations, not photos of real products.
- The phone frame, status bar, backgrounds and type (Playfair Display and Inter) are drawn with HTML/CSS. No Apple artwork is used.
- Brand colours: deep brown `#2A0800`, cream `#FAF9F7` and gold `#E8C77A` / `#A87A1F`.

## Making them again

1. Push any commit to the `appstore-capture` branch. GitHub Actions (`.github/workflows/appstore-capture.yml`) opens the live site on a phone-sized browser, runs `tools/capture-live.mjs` and saves the raw screens to the `appstore-shots` branch.
2. Download that branch into a folder, then run `SHOTS_DIR=<that folder>/ node marketing/app-store/tools/compose.mjs` to put them in the phone frames with the headlines.
