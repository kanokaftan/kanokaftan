---
name: kano-reels
description: Make or edit a 4K vertical marketing reel for Kano Kaftan — a shop/seller advert, a feature promo (invite friends, first-buyer prices, delivery…), or any Instagram/TikTok/WhatsApp-Status video — using REAL app screens and REAL product photos, swipes/taps/zooms, designed captions, full sound design, a background beat, and a Hausa voiceover script for ElevenLabs. Also covers syncing a returned voiceover to the video and fixing captions after the voice text was edited. Use for "make a video/reel/advert of <shop>", "promote <feature>", "add background sound", "here's the voiceover", "captions don't match the voice".
---

# Kano Kaftan reels

Two finished reels are the templates:

| Template | What it is | Look |
|---|---|---|
| `templates/shop-advert.html` | One shop and its products (Hajmeer Enterprises), ending on "other shops are waiting" | deep plum + rose gold, 37 s before voice |
| `templates/referral-reel.html` | A feature walkthrough (Invite friends / K² credit) | black + gold, 31 s before voice |

Both are HyperFrames compositions (HTML + one paused GSAP timeline) rendered at 2160×3840. Read the
`hyperframes` and `hyperframes-core` skills before changing composition structure.

## The workflow (in this order)

1. **Facts first (never invent).** Query Supabase (project `anptvdidwxiigzkqhdia`) for the real numbers: shop
   (`profiles` where `store_slug`), products (`products` + `product_images.url`), prices, `compare_at_price`,
   `first_buyer_discount_percent`, colours/sizes, verification tier, `store_address.city`, and programme settings in
   `platform_settings` (e.g. `referral_referrer_credit`, `referral_order_percent`). Never select email/phone/bank.
   Demo people in screens (Aisha, Musa…) are fine — say so to the user.

2. **Real screens + photos (the sandbox can't reach supabase.co, so GitHub Actions captures them).**
   `marketing/app-store/tools/capture-live.mjs`, run by `.github/workflows/appstore-capture.yml`:
   - push `shop-capture` → branch `shop-shots`: one shop's page, its 4 product pages, every product photo
     (`shop/p<N>-<M>.jpg`), its avatar/banner, other shops' avatars/banners, `shop/index.json`.
     Shop is `SHOP_SLUG` (default `hajmeer-enterprises`) and the product slugs list in `MODE === 'shop'` — edit both.
   - push `reel-capture` → branch `reel-shots`: home, invite, profile, invite landing, shops, two product pages,
     40 newest product photos (`photos/index.json`).
   - Each screen comes as `<name>.png` (one phone screen), `<name>-scroll.png` (whole page, tab bar removed) and
     `<name>-tabbar.png` (the floating bar, to overlay fixed at the bottom).
   - Push: `git push origin HEAD:main HEAD:merge/vendor-platform HEAD:shop-capture`, then wait for the branch:
     `until git ls-remote origin shop-shots | grep -q shop; do sleep 10; done` (run in background), then
     `git fetch origin +shop-shots:refs/remotes/origin/shop-shots` (the `+` matters: it's force-pushed) and
     `git -C <repo> archive origin/shop-shots | tar -x` into the project's `raw/`.
   - A branch that already exists won't change until the new run finishes — check `capture-log.txt` mentions it.

3. **Project setup.** `bash scripts/new_project.sh /home/user/kanokaftan-ad/<name> shop-advert` (fonts incl.
   Hausa letters, local GSAP, logos, synthesised SFX). Copy chosen raw files into `assets/`.

4. **Adapt the template** (copy `template.html` → `index.html`, keep the template outside the project when rendering):
   - Swap image `src`s, names, prices, captions. Keep every figure true to step 1.
   - **Colour tone:** change only the `:root` variables + `#glow` gradients + `.cap .h` gradient. Pick a tone from the
     shop's own branding (Hajmeer's banner is gold on plum → plum + rose gold). Give each shop its own tone.
   - **Phone screens:** the screen is `1290×2796` screenshot px inside `.native` scaled by `.930233`. Put taps (`.tap`),
     highlights (`.hl`) and "selected chip" overlays (`.sel`) in screenshot px **on the `.page`** if they must scroll
     with it. Find positions by cropping the screenshot (`PIL crop` + Read the image) — never guess.
     Tab bar top: `python3 -I scripts/locate_bar.py raw/x.png raw/x-tabbar.png`.
   - Scroll = tween the `.page` `y`; swipe = tween two `.page`s `x` by `-1290`.
   - Captions follow `reference/caption-and-sound-rules.md`.

5. **Sound + music.** SFX `<audio>` tags are already laid out by family (track 20 whooshes, 21/22 textures, 23 risers,
   24 hits). Move them with the events. Every `<audio>` needs an `id` and a `data-duration` equal to the file length
   (or lint complains about overlaps). Beat: `python3 -I scripts/music_bed.py --out assets/music-bed.wav --dur <len>
   --bpm 104 --mood rose|gold --hits <comma list of riser-end times>`. Music `data-volume` ≈0.4 without a voice,
   ≈0.16 under a voice.

6. **Check before rendering.** `npx --yes hyperframes@0.8.181 lint` → 0 errors (warnings about sub-compositions and
   file size are expected). Then snapshots at one moment per scene:
   `PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium npx --yes hyperframes@0.8.181 snapshot --at 1.5,4.8,... --no-end -o snaps --timeout 25000`
   and Read the contact sheet. Look for: wrapped hero words, text over faces, wrong tap spots, ɗ/ƙ shown as đ.

7. **Apply the pro motion rules** in `reference/pro-techniques.md` while building: entries ~0.35 s ease-out, exits
   ease-in, arrive from oversize (never grow from 0), transforms over fades, cut on motion, something moving on every
   frame (drift/Ken Burns under holds — re-timing to a voice makes holds longer, so add drift), end hold ≤ 1.4 s,
   one hero per frame, no typed letter-by-letter headlines.

8. **Render 4K.** Run in the background:
   `PUPPETEER_EXECUTABLE_PATH=/opt/pw-browsers/chromium npx --yes hyperframes@0.8.181 render -o renders/<name>-4k.mp4 --workers 3`
   (~4 min for 40 s). Verify with `ffprobe` (2160×3840) and `ffmpeg -af ebur128=peak=true` (aim ≈ −15 LUFS, peak < −1 dB).
   Then `bash scripts/qa.sh renders/<name>-4k.mp4 <seconds>` — fix every FAIL; look at each WARN (frozen stretches,
   mono, loudness) and fix or explain it. Then `bash scripts/export_social.sh renders/<name>-4k.mp4` for the
   1080×1920 Reels/TikTok copy and the 720p WhatsApp Status copy (−14 LUFS).
   Send the 4K master and the 1080 copy with SendUserFile (`display: render`). Never commit renders to git (too big).

9. **Hausa voiceover script.** Write `AI-VOICE-SCRIPT.txt` like `reference/example-voice-script-shop.txt`: timestamps,
   ElevenLabs v3 emotion tags + `[pause Xs]`, an SSML version, pronunciation notes, export notes. Also paste
   Version A in chat as a code block. Facts only from step 1.

10. **When the voiceover comes back** (an mp3 in `/root/.claude/uploads/...`):
   1. `bash scripts/find_lines.sh <mp3>` → line starts (pauses ≥ 0.45 s = new line). Map them to the script's lines;
      short pauses inside a line are normal. AI voices run ~1.3–1.5× longer than the script timings.
   2. `bash scripts/prep_voice.sh <mp3> assets/voiceover.wav`
   3. Anchors: OLD = each scene's start in the template (+ its total length), NEW = the matching line start
      (+ voice length rounded up ~0.5 s). Regenerate the beat for the new length with the new hit times.
   4. `python3 -I scripts/retime.py --src <template> --dst index.html --old ... --new ... --voice-dur <s>` —
      always from the un-retimed template.
   5. Lint, snapshot, render, verify, send.

11. **Captions vs. edited voice.** If the user edited words in ElevenLabs, ask for the exact text, then change only the
    caption spans (keep `.s .w` / `.h` structure), snapshot those moments, re-render. Also update the template in this
    skill if the change is permanent.

## Hard-won rules (each one cost a re-render)

- **Hausa letters:** ɗ (U+0257), ƙ, ɓ and ₦ are in the fonts' *latin-ext* files. Both `@font-face` sets must be in the
  page (templates already have them). Without them ɗ renders as đ from a fallback font.
- **GSAP from the CDN is blocked** → `assets/gsap.min.js`.
- **iPhone footage is HLG HDR** (`color_transfer=arib-std-b67`): HyperFrames then takes the slow layered path
  (~40 min). Grade it, then re-tag as bt709: `ffmpeg -i in.mp4 -c copy -bsf:v h264_metadata=colour_primaries=1:transfer_characteristics=1:matrix_coefficients=1 -color_primaries bt709 -color_trc bt709 -colorspace bt709 out.mp4`.
  Render log must say `beginframe` and `hasHdrContent:false`.
- **Tone-mapping HLG with zscale/tonemap turned skin orange.** Grade the untone-mapped decode instead, e.g.
  `eq=contrast=1.06:saturation=1.10:gamma=1.12,colorbalance=rs=0.03:bs=-0.02:rm=0.02:bm=-0.015,curves=all='0/0.015 0.18/0.17 0.45/0.52 0.85/0.88 1/0.97',vignette=angle=PI/7`,
  upscale `scale=2160:3840:flags=lanczos,unsharp=5:5:0.6`, x264 crf 15.
- **Two root HTML files** in the project folder = lint error; keep templates/backups outside.
- Never tween `fontSize` (lint error) — tween `scale`. Repeated `fromTo` on one element: `immediateRender:false` on later ones.
- `pkill -f`/`pgrep -f` patterns also match your own shell command — don't wait on renders with them; use
  `run_in_background` and the completion notice.
- Sandbox can't reach instagram/youtube/huggingface (no yt-dlp downloads, no Whisper). Ask the user for the words.
- Music/SFX can't be downloaded: `make_sfx.py` and `music_bed.py` synthesise everything (royalty-free).
- Don't publish demo personal data as real; phone numbers on a shop's own banner are theirs — don't zoom on them.

## Files

- `scripts/new_project.sh` — project folder with fonts, GSAP, logos, SFX
- `scripts/make_sfx.py` — whooshes, pops, clicks, taps, impacts, risers, hits, coin, success, typing, notification
- `scripts/music_bed.py` — beat with drop-outs before hits (`--mood gold|rose`)
- `scripts/find_lines.sh`, `scripts/prep_voice.sh`, `scripts/retime.py` — voiceover sync
- `scripts/locate_bar.py` — where a tab bar sits in a screenshot
- `scripts/qa.sh` — delivery gates: 9:16, duration, −14 LUFS, true peak, mono, frozen/black frames, silence
- `scripts/export_social.sh` — 1080×1920 Reels/TikTok and 720p WhatsApp copies from the 4K master
- `reference/pro-techniques.md` — motion, caption, sound and delivery rules distilled from the best public video skills
- `reference/caption-and-sound-rules.md` — caption style, sound design levels and placement (from the user's Drive course)
- `reference/drive-visual-style.md` — what the Drive inspiration images look like
- `reference/example-voice-script-*.txt` — the two AI voice scripts that worked
