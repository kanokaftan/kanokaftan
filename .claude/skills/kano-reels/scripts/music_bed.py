"""Royalty-free background beat for a reel, made from scratch (no stock music is reachable from the sandbox).

Amapiano / afro-R&B style: kick, claps, shakers, log-drum bass, off-beat piano stabs and a warm pad.
It drops almost to silence for DROP seconds before each hit and slams back on the hit.

    python3 -I music_bed.py --out assets/music-bed.wav --dur 37 --bpm 104 --mood rose --hits 9,22,30,34
"""
import argparse
import wave

import numpy as np

SR = 48000
DROP = 0.45
FADE_IN = 0.25
FADE_OUT = 1.5

# Chord sets (Hz) and bass roots per mood: one chord per bar, cycling.
MOODS = {
    # Dm7 – Gm7 – Bbmaj7 – A7: punchy, a little tension (used for the gold/black referral reel)
    "gold": ([[293.7, 349.2, 440.0, 523.3], [196.0, 233.1, 293.7, 349.2], [233.1, 293.7, 349.2, 440.0], [220.0, 277.2, 329.6, 392.0]],
             [73.4, 98.0, 58.3, 55.0], 0.07, 0.75),
    # Fmaj7 – Em7 – Dm7 – Cmaj7: softer, romantic (used for the plum/rose-gold shop advert)
    "rose": ([[349.2, 440.0, 523.3, 659.3], [329.6, 392.0, 493.9, 587.3], [293.7, 349.2, 440.0, 523.3], [261.6, 329.6, 392.0, 493.9]],
             [87.3, 82.4, 73.4, 65.4], 0.10, 0.6),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", required=True)
    ap.add_argument("--dur", type=float, required=True, help="seconds")
    ap.add_argument("--bpm", type=float, default=108)
    ap.add_argument("--mood", choices=sorted(MOODS), default="gold")
    ap.add_argument("--hits", default="", help="comma-separated seconds where the beat drops out just before")
    ap.add_argument("--seed", type=int, default=5)
    a = ap.parse_args()

    chords, roots, pad_gain, kick_gain = MOODS[a.mood]
    hits = [float(h) for h in a.hits.split(",") if h.strip()]
    beat = 60 / a.bpm
    n = int(SR * a.dur)
    t = np.arange(n) / SR
    out = np.zeros((n, 2))
    rng = np.random.default_rng(a.seed)

    def add(sig, start, pan=0.0, gain=1.0):
        i = int(start * SR)
        if i >= n:
            return
        j = min(n, i + len(sig))
        s = sig[: j - i] * gain
        out[i:j, 0] += s * (1 - pan)
        out[i:j, 1] += s * (1 + pan)

    def env(length, attack, decay):
        x = np.arange(int(length * SR)) / SR
        return np.minimum(1, x / attack) * np.exp(-x / decay)

    def kick():
        length = 0.3
        x = np.arange(int(length * SR)) / SR
        f = 48 + 80 * np.exp(-x * 35)
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(length, 0.001, 0.09)

    def logdrum(freq, length=0.45):
        x = np.arange(int(length * SR)) / SR
        f = freq * (1 + 0.5 * np.exp(-x * 25))
        return np.tanh(2.2 * np.sin(2 * np.pi * np.cumsum(f) / SR) * env(length, 0.003, 0.22))

    def shaker():
        length = 0.05
        s = np.diff(rng.standard_normal(int(length * SR)), prepend=0)
        return s * env(length, 0.002, 0.012)

    def clap():
        length = 0.2
        s = rng.standard_normal(int(length * SR))
        idx = np.arange(len(s))
        e = sum(env(length, 0.001, 0.01) * (idx > int(k * 0.011 * SR)) for k in range(3))
        return s * (e / 3 + env(length, 0.001, 0.06) * 0.5)

    def keys(freqs, length=0.32):
        x = np.arange(int(length * SR)) / SR
        s = sum(np.sin(2 * np.pi * f * x) + 0.35 * np.sin(4 * np.pi * f * x) + 0.12 * np.sin(6 * np.pi * f * x) for f in freqs)
        return s / len(freqs) * env(length, 0.004, 0.18)

    def pad(freqs, length):
        x = np.arange(int(length * SR)) / SR
        s = sum(np.sin(2 * np.pi * f * x + np.sin(2 * np.pi * 0.3 * x)) for f in freqs) / len(freqs)
        return s * np.minimum(1, x / 0.5) * np.minimum(1, (length - x) / 0.5)

    bar = 4 * beat
    for b in range(int(a.dur / bar) + 1):
        t0 = b * bar
        c = b % len(chords)
        add(pad(chords[c], bar), t0, gain=pad_gain)
        for k in range(4):
            add(kick(), t0 + k * beat, gain=kick_gain)
            if k in (1, 3):
                add(clap(), t0 + k * beat, pan=0.1, gain=0.22)
            for s in range(4):
                add(shaker(), t0 + k * beat + s * beat / 4, pan=(0.35 if s % 2 else -0.35), gain=0.16 if s % 2 else 0.08)
        for off in (0.5, 1.5, 2.25, 3.5):
            add(keys([f * 2 for f in chords[c]]), t0 + off * beat, pan=0.2, gain=0.12)
        for off, mul in ((0, 1), (0.75, 1), (1.5, 1.5), (2.5, 1), (3.0, 2)):
            add(logdrum(roots[c] * mul), t0 + off * beat, gain=0.55)

    gain = np.clip(t / FADE_IN, 0, 1) * np.clip((a.dur - t) / FADE_OUT, 0, 1)
    for h in hits:
        gain *= np.where((t > h - DROP) & (t < h), 0.12, 1.0)
    out *= gain[:, None]
    out /= np.max(np.abs(out)) * 1.05
    with wave.open(a.out, "wb") as f:
        f.setnchannels(2)
        f.setsampwidth(2)
        f.setframerate(SR)
        f.writeframes((out * 32767).astype("<i2").tobytes())
    print(f"wrote {a.out}: {a.dur}s, {a.bpm} BPM, mood {a.mood}, drops before {hits}")


if __name__ == "__main__":
    main()
