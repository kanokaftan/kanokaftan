# K² Kano Kaftan – App Store screenshots

Six marketing screenshots for the App Store listing, each **1290 × 2796 px** (portrait), the size App Store Connect asks for under the iPhone 6.9″ / 6.7″ display slot.

| # | File | Headline | Subline | App screen |
|---|------|----------|---------|------------|
| 1 | `01-home.png` | Kano’s best fashion, in your pocket | Kaftans, fabrics, shoes & caps from Kano’s finest shops. | Home |
| 2 | `02-shops.png` | Shop trusted, verified sellers | Gold and verified badges on every shop you visit. | Shops directory |
| 3 | `03-first-order-prices.png` | First-order prices from every shop | See your first-order price on every product. | Product detail with the “First order ₦58,500 (−10%)” price highlighted |
| 4 | `04-chat-and-call.png` | Chat and call sellers directly | Ask about sizes, custom fits and delivery in real time. | Chat with a seller |
| 5 | `05-invite-friends.png` | Invite friends, earn K² | 200 K² for every friend who joins. Spend it on anything. | Invite friends (/invite) |
| 6 | `06-delivery.png` | Delivery handled for you | Track every step. Your payment is protected until it arrives. | Order detail and tracking |

`overview.png` is a contact sheet of all six side by side, for quick review. Don't upload it to the App Store.

## Uploading

- In App Store Connect, open the app version and go to **App Previews and Screenshots → iPhone 6.9″ Display**. Drag in files `01` to `06` in that order.
- These PNGs are RGB with no transparency, so App Store Connect accepts them as they are.
- **Need 1242 × 2688 (6.5″)?** Resize each file to that size. The aspect ratio is almost the same, so nothing important gets cropped. For example:
  `sips -z 2688 1242 01-home.png --out 6.5/01-home.png` (macOS), or
  `magick 01-home.png -resize 1242x2688! 6.5/01-home.png` (ImageMagick).

## How they were made

- The app screens are real renders of the Kano Kaftan PWA. It was built locally and opened in headless Chromium at 430 × 932 with a device scale factor of 3, against mocked backend data (sample Kano shops, products and orders).
- The product photos are generated illustrations, not photos of real products.
- The phone frame, status bar, backgrounds and type (Playfair Display and Inter) are drawn with HTML/CSS. No Apple artwork is used.
- Brand colours: deep brown `#2A0800`, cream `#FAF9F7` and gold `#E8C77A` / `#A87A1F`.
