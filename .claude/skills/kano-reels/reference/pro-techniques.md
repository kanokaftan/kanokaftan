# Pro techniques (studied from public video skills, Oct 2026)

Sources read (documentation only — no third-party code was installed or run):
- zhuyansen/awesome-claude-video-skills — security-graded index of ~180–320 video skills
- Tejashmakwana/motionmaxxing — measured how professional motion designers move things
- Barty-Bart/motion-graphics — high-energy explainers + beat-locked sound effects
- kajisho5/ffmpeg-skill — 42 ffmpeg operations, platform exports, loudness, captions, reframing
- digitalsamba/claude-code-video-toolkit — project phases, brand profiles, review passes
- kurbaitaev/ghost-editor — face-safe caption styles for talking-head reels

## Motion (what separates "designer-made" from "agent-made")

| Rule | Value | How in GSAP |
|---|---|---|
| Typical move length | median 10 frames (0.33 s); entries 11–12 f (0.37–0.4 s); opacity 6 f (0.2 s); blur 7–8 f | `duration: 0.35` for entries, `0.2` for fades |
| Landing | decelerate (ease-out) | `power3.out` / `expo.out` |
| Leaving | accelerate (ease-in) | `power3.in` |
| Overshoot | rare (<9% of moves) and slow — a lean past the mark, not a bouncy spring | use `back.out(1.2–1.4)` sparingly; not on everything |
| Arrival | **decelerate from oversize** (logos ~3.5×) or slide from an edge. **Nothing grows from zero** | `fromTo(el,{scale:2.5,opacity:0},{scale:1,opacity:1,ease:"expo.out"})` |
| Fades | avoid — pros use transforms ~6:1 over opacity fades; fade-to-black is a default, not a decision | exit by sliding/scaling out with the cut |
| Cuts | hard cuts, **on motion** (the next scene starts already moving; clips end mid-move) | start each scene's first tween at the scene start, 0 delay |
| Dead frames | something moves on ~99% of frames; never >3 still frames in a row | slow Ken Burns / drift / glow breathing under every hold |
| End hold | 0.6–1.4 s, final shot ≤ 25% of the film, end gets smaller | end card ≤ 1.4 s of stillness |
| Composition | one hero per frame (two panels only if one is 2× the other) | |
| Avoid | corner labels/counters/timecodes, progress bars, header/footer bars, kicker above headline, left headline + right media, letter-by-letter "typed" headlines, flat colour per scene, small cards floating on a void, "status dot · label · value" UI cards | |
| Ground | every frame has light, depth and texture (glow, grain, grid) — a surface, not a swatch | keep `#glow`, grid and vignette |
| Legibility | UI text ≥ 4% of frame height when shown; UI fragments ≥ 55% of frame width or cropped by the frame | punch-in on phone screens before showing small UI text |

Self-audit of our first reels against this: coins/avatars grew from scale 0–0.2 (→ arrive from oversize instead);
several exits were opacity fades (→ slide/scale out on the cut); some holds had no motion (→ add drift).

## Hook + structure (short form)

- 12–20 s high-energy promos: title slam → kinetic words → one signature moment → product micro-interaction → end card.
- A new idea on every beat; every transition is a shape/element that carries into the next scene (match cut).
- Never invent numbers, customers or offers — only what the user or the live data gives.
- Render a fast draft first, review it, then the final.

## Captions

- Time captions to every spoken word when a transcript exists; highlight the key word (colour sweep or highlighter).
- Never cover the face or the app's own buttons; keep out of the platform UI (bottom ~20%, right edge ~15% on Reels/TikTok).
- Wrap by phrase, never inside a word; minimum size ≈ 4.5% of frame height.
- Styles worth having: clean bold, editorial lowercase, one big word per line (serif or heavy grotesk), chest captions.

## Sound

- One sound per cue, on the cue frame; beat grid checked against kick drums < 120 Hz and cuts moved onto beats.
- Mix target for social: **−14 LUFS integrated, true peak ≤ −1 dBTP** (some kits use −16 / −4 dBTP for headroom).
- Check the mono fold-down (phone speakers are mono).
- Library families: whoosh, transition, pop, click, typing, riser, impact, ding, glitch, UI blips, ambience.

## Delivery

- Master in 4K, but upload the platform's native size: Reels/TikTok/Shorts 1080×1920, 30 fps, H.264 High, BT.709,
  `+faststart`; WhatsApp Status 720×1280 under 16 MB. (`scripts/export_social.sh`)
- HDR/HLG/Dolby Vision → convert to SDR BT.709 (don't just relabel when the matrix differs).
- 16:9 → 9:16 crop throws away 70% of the width: look at a contact sheet before choosing the crop; otherwise blur-pad.
- QA every export (`scripts/qa.sh`): size, duration, loudness, true peak, mono, frozen stretches, black frames, silence.

## Process ideas worth copying

- Project phases (planning → assets → review → audio → editing → rendering → complete) tracked in a `project.json`
  so a resumed session knows where it is.
- A brand profile per seller (colours, fonts, voice) reused across videos.
- A review pass per scene before the final render.
