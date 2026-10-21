# Caption and sound rules

Learned from the user's Google Drive folder "How to Edit VIRAL Reels with AI" (UE sound-design training,
prompt list, 29 inspiration images) and from what worked in the Kano Kaftan reels.

## Captions

- **Two fonts:** a small white sans for the setup words (Inter 600, 96 px at 2160 wide) and ONE big hero word or
  phrase in italic serif (Playfair Display 700 italic, 180–230 px) in the accent colour or gradient.
- Structure in HTML: `<div class="cap"><span class="s"><span class="w">word</span> …</span><span class="h w">Hero</span></div>`.
  The `caption(id, at)` helper pops small words one by one (back-ease, 0.07 s stagger), then the hero scales in from 1.5 with a blur.
- Hero must fit one line (`white-space:nowrap`): use `.h.sm` (180 px) for long ones, shorten the phrase if still too long.
- Placement: top band (y≈230–700) when a phone or graphic fills the middle; lower-centre (y≈2300–2700) over photos.
  Keep clear of the bottom ~20% (Instagram UI).
- Words must match the voiceover. If the voice text changes, the captions change.
- Hausa on screen; app screens stay as they are (English UI is real).

## Visual style

- Dark stage, a big soft radial glow in the accent colour behind the subject, faint grid/dot texture, vignette.
- Glass cards: translucent gradient, 3 px light border, inner top highlight, big soft shadow.
- Stats count up (number tween with `onUpdate`), rings fill, rows pop in staggered, node→node flows with drawing links.
- Real photos in rounded cards with a price tag pill; slow Ken Burns (scale 1.15→1 over the scene).
- Phone: 1200 px wide frame, dark bezel, glow. Dive in from below with a slight rotation; punch-in (scale ~1.3–1.45) to
  focus a detail; blur + darken it when an overlay (WhatsApp bubble etc.) sits on top.

## Sound design (from the UE training)

Three families, each on its own track:

| Family | Use for | Level | Placement |
|---|---|---|---|
| **Whooshes** | anything that MOVES: slides, swipes, zooms, phone in/out, scene changes | −12 dB (−10 for big moves) | the whoosh's PEAK on the fastest frame of the motion |
| **Textures** | things that HAPPEN without sliding: pop (text), UI click (buttons), tap, sci-fi click (UI change), sci-fi impact (a reveal), camera click (cut), coin/success (rewards), typing | −6/−7 dB | exactly on the event frame |
| **Risers + hits** | building into the next section | −5 dB | riser ENDS on the section change, hit under it; ~5 s after the hook; ≥2 bass + ≥2 metallic per video |

- One loudest moment per scene. Voice always on top.
- The guide says no music under graphics; the user asked for a background beat anyway → keep it low and duck it under the
  voice (≈0.16 volume), and let it drop out just before each hit.
- Never a whoosh for a pop, never a pop for a slide.

## Hook + structure that worked

1. Hook question in the first 3 s over real product photos.
2. The promise in one number/word (200 K², ₦3,000 kacal, verified shop).
3. "Ga yadda ake yi" / the shop on a phone — real screens, scroll, tap, swipe.
4. Proof beats (prices, colours, first-buyer discount, safe payment, earnings).
5. Wider world ("ba X kaɗai ba — akwai shaguna da yawa") for shop adverts.
6. End card: logo, Hausa call to action, kanokaftan.shop, a CTA pill that gets tapped.
