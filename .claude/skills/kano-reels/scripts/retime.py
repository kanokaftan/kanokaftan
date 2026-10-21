"""Re-times a finished composition to a voiceover.

Scene starts move to where each spoken line starts (OLD anchors -> NEW anchors, piecewise linear).
Animation lengths stay the same so motion stays snappy; only WHEN things happen moves.
Sounds keep their event point on the mapped moment: whoosh peaks, riser ends (so a riser still lands on its hit).
Linear "hold" tweens (ease: "none") stretch with their scene.

    python3 -I retime.py --src template.html --dst index.html \
        --old 0,3,7,9,12.5,15,19,22,26,30,34,37 \
        --new 0,3.69,8.28,10.7,14.41,18.27,22.65,25.44,30.32,34.25,38.54,43 \
        --voice-dur 42.53 --music-vol 0.16

Run it from the project folder (it reads assets/sfx/*.wav to get sound lengths).
OLD's last value must be the template's root data-duration; NEW's last value becomes the new length.
"""
import argparse
import json
import re
import wave

# Where in each sound the "event" is, so that point lands on the mapped moment.
PEAK = {"whoosh_standard": 0.32, "whoosh_big": 0.55, "whoosh_short": 0.12, "whoosh_transition": 0.45, "swipe": 0.16}


def floats(s):
    return [float(x) for x in s.split(",")]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", required=True)
    ap.add_argument("--dst", required=True)
    ap.add_argument("--old", required=True, type=floats)
    ap.add_argument("--new", required=True, type=floats)
    ap.add_argument("--voice-dur", type=float, required=True)
    ap.add_argument("--music-vol", type=float, default=0.16, help="music under a voice: about -16 dB")
    a = ap.parse_args()
    OLD, NEW = a.old, a.new
    assert len(OLD) == len(NEW) and OLD == sorted(OLD) and NEW == sorted(NEW), "anchors must pair up and increase"

    def M(t):
        for i in range(len(OLD) - 1):
            if t <= OLD[i + 1] or i == len(OLD) - 2:
                return NEW[i] + (t - OLD[i]) * (NEW[i + 1] - NEW[i]) / (OLD[i + 1] - OLD[i])
        return t

    s = open(a.src).read()

    def wav_len(path):
        with wave.open(path) as w:
            return w.getnframes() / w.getframerate()

    def audio(m):
        tag = m.group(0)
        name = re.search(r'src="assets/sfx/([^"]+)\.wav"', tag).group(1)
        start = float(re.search(r'data-start="([\d.]+)"', tag).group(1))
        length = wav_len(f"assets/sfx/{name}.wav")
        anchor = length if name.startswith("riser") else PEAK.get(name, 0.0)
        new = max(0.0, M(start + anchor) - anchor)
        return re.sub(r'data-start="[\d.]+"', f'data-start="{new:.3f}"', tag)

    s = re.sub(r'<audio id="(?:wh|tx|rs|ht)\d+"[^>]*>', audio, s)

    def clip(m):
        tag = m.group(0)
        st = re.search(r'data-start="([\d.]+)"', tag)
        du = re.search(r'data-duration="([\d.]+)"', tag)
        if not st or not du:
            return tag
        start, dur = float(st.group(1)), float(du.group(1))
        ns, ne = M(start), M(start + dur)
        tag = tag.replace(st.group(0), f'data-start="{ns:.3f}"', 1)
        return tag.replace(du.group(0), f'data-duration="{ne - ns:.3f}"', 1)

    s = re.sub(r'<div [^>]*data-start="[\d.]+"[^>]*>', clip, s)

    total = NEW[-1]
    s = re.sub(r'<audio id="music"([^>]*)data-duration="[\d.]+"([^>]*)data-volume="[\d.]+"',
               lambda m: f'<audio id="music"{m.group(1)}data-duration="{total:g}"{m.group(2)}data-volume="{a.music_vol}"', s)
    vo = f'<audio id="vo" src="assets/voiceover.wav" data-start="0" data-duration="{a.voice_dur}" data-track-index="25" data-volume="1"></audio>'
    if 'id="vo"' in s:
        s = re.sub(r'<audio id="vo"[^>]*></audio>', vo, s)
    else:
        s = re.sub(r"<!-- VOICEOVER:.*?-->", "<!-- VOICEOVER -->\n  " + vo, s, flags=re.S)

    helper = """const tl = gsap.timeline({ paused: true });
// Re-timed to the voiceover: scene starts follow the spoken lines; animation lengths stay the same.
const OLD_T = %s, NEW_T = %s;
const M = (t) => { for (let i = 0; i < OLD_T.length - 1; i++) { if (t <= OLD_T[i + 1] || i === OLD_T.length - 2) { return NEW_T[i] + (t - OLD_T[i]) * (NEW_T[i + 1] - NEW_T[i]) / (OLD_T[i + 1] - OLD_T[i]); } } return t; };
const stretch = (vars, pos) => (vars && vars.ease === "none" && vars.duration ? { ...vars, duration: M(pos + vars.duration) - M(pos) } : vars);
const _to = tl.to.bind(tl), _fromTo = tl.fromTo.bind(tl), _set = tl.set.bind(tl);
tl.to = (t, v, p) => _to(t, stretch(v, p), M(p));
tl.fromTo = (t, f, v, p) => _fromTo(t, f, stretch(v, p), M(p));
tl.set = (t, v, p) => _set(t, v, M(p));""" % (json.dumps(OLD), json.dumps(NEW))
    assert "const OLD_T" not in s, "src is already re-timed: always re-time from the template, not from a re-timed file"
    s = s.replace("const tl = gsap.timeline({ paused: true });", helper, 1)
    open(a.dst, "w").write(s)
    print(f"re-timed {a.src} -> {a.dst}: {OLD[-1]}s -> {total}s")


if __name__ == "__main__":
    main()
