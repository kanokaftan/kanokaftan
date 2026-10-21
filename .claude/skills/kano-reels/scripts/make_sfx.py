# Synthesised sound-effects library for the reels (no stock library is reachable from here).
# Families follow the Drive sound-design guide: whooshes (movement), textures (events), risers & hits (builds).
import numpy as np, wave, sys, os
SR = 48000
rng = np.random.default_rng(11)
OUT = sys.argv[1]

def save(name, x, peak_db):
    x = np.asarray(x, dtype=float)
    if x.ndim == 1: x = np.stack([x, x], 1)
    x = x / (np.max(np.abs(x)) + 1e-9) * 10 ** (peak_db / 20)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as f:
        f.setnchannels(2); f.setsampwidth(2); f.setframerate(SR)
        f.writeframes((np.clip(x, -1, 1) * 32767).astype('<i2').tobytes())

def t_(dur): return np.arange(int(dur * SR)) / SR

def lowpass(x, cutoff):
    """One-pole low-pass with a time-varying cutoff (Hz, scalar or array)."""
    c = np.broadcast_to(np.asarray(cutoff, float), x.shape)
    a = np.exp(-2 * np.pi * c / SR)
    y = np.zeros_like(x); prev = 0.0
    for i in range(len(x)):
        prev = (1 - a[i]) * x[i] + a[i] * prev; y[i] = prev
    return y

def bandnoise(dur, lo, hi):
    n = rng.standard_normal(int(dur * SR))
    return lowpass(n, hi) - lowpass(n, lo)

def whoosh(dur, peak_at, lo=200, hi=5000, airy=1.0):
    """Noise swept up then down; loudest at peak_at (seconds) so it can sit on the fastest frame."""
    t = t_(dur)
    shape = np.where(t < peak_at, (t / peak_at) ** 2.2, np.exp(-(t - peak_at) / (dur - peak_at) * 4))
    cutoff = lo + (hi - lo) * shape
    n = rng.standard_normal(len(t)) * airy
    x = lowpass(n, cutoff) * shape
    # slight stereo movement
    pan = np.clip((t / dur), 0, 1)
    return np.stack([x * (1.2 - pan * 0.4), x * (0.8 + pan * 0.4)], 1)

def env(dur, a, d):
    t = t_(dur); return np.minimum(1, t / max(a, 1e-4)) * np.exp(-t / d)

def pop():
    t = t_(0.12); f = 900 * np.exp(-t * 28) + 280
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(0.12, 0.001, 0.03)

def ui_click():
    t = t_(0.05); x = np.sin(2 * np.pi * 2400 * t) * env(0.05, 0.0005, 0.006) + 0.4 * rng.standard_normal(len(t)) * env(0.05, 0.0002, 0.002)
    return x

def scifi_click():
    t = t_(0.18); f = 3200 - 2200 * t / 0.18
    return np.sin(2 * np.pi * np.cumsum(f) / SR) * env(0.18, 0.001, 0.04) + 0.3 * np.sin(2 * np.pi * 5200 * t) * env(0.18, 0.001, 0.01)

def tap():
    t = t_(0.08); return (np.sin(2 * np.pi * 180 * t) * 0.7 + rng.standard_normal(len(t)) * 0.3) * env(0.08, 0.0005, 0.012)

def camera_click():
    a = rng.standard_normal(int(0.03 * SR)) * env(0.03, 0.0002, 0.004)
    b = rng.standard_normal(int(0.05 * SR)) * env(0.05, 0.0002, 0.008)
    x = np.zeros(int(0.12 * SR)); x[:len(a)] += a; x[int(0.06 * SR):int(0.06 * SR) + len(b)] += b * 0.8
    return lowpass(x, 7000)

def scifi_impact():
    t = t_(1.2)
    sub = np.sin(2 * np.pi * np.cumsum(70 * np.exp(-t * 3) + 38) / SR) * env(1.2, 0.002, 0.35)
    crack = bandnoise(1.2, 800, 9000) * env(1.2, 0.0005, 0.05)
    shimmer = sum(np.sin(2 * np.pi * f * t) for f in (1320, 1980, 2640)) / 3 * env(1.2, 0.01, 0.4) * 0.25
    return sub + crack * 0.8 + shimmer

def hit():
    t = t_(1.5)
    boom = np.sin(2 * np.pi * np.cumsum(55 * np.exp(-t * 2) + 32) / SR) * env(1.5, 0.002, 0.5)
    return boom + bandnoise(1.5, 100, 3000) * env(1.5, 0.001, 0.08) * 0.6

def riser_bass(dur):
    """Sharp bass riser: sweeping saw-ish tone + noise, ends abruptly at dur."""
    t = t_(dur); f = 60 * (8 ** (t / dur))
    ph = 2 * np.pi * np.cumsum(f) / SR
    tone = np.sin(ph) + 0.5 * np.sin(2 * ph) + 0.25 * np.sin(3 * ph)
    noise = lowpass(rng.standard_normal(len(t)), 300 + 9000 * (t / dur) ** 2)
    e = (t / dur) ** 2.5
    return (tone * 0.7 + noise * 0.5) * e

def riser_metal(dur):
    """Metallic riser: inharmonic partials gliding up with tremolo."""
    t = t_(dur); g = 2 ** (2 * t / dur)
    x = sum(np.sin(2 * np.pi * np.cumsum(f * g) / SR) / (k + 1) for k, f in enumerate((310, 517, 743, 1129, 1663)))
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * (4 + 20 * t / dur) * t)
    return x * trem * (t / dur) ** 2

def suckback(dur):
    t = t_(dur); n = rng.standard_normal(len(t)); x = lowpass(n, 200 + 8000 * (t / dur) ** 3)
    return x[::-1][::-1] * (t / dur) ** 4

def coin():
    t = t_(0.6); x = (np.sin(2 * np.pi * 1975 * t) + 0.6 * np.sin(2 * np.pi * 2637 * t)) * env(0.6, 0.001, 0.12)
    x2 = np.zeros_like(x); s = int(0.07 * SR); x2[s:] = (np.sin(2 * np.pi * 2637 * t[:-s]) + 0.5 * np.sin(2 * np.pi * 3951 * t[:-s])) * env(0.6, 0.001, 0.18)[:-s]
    return x + x2

def success():
    t = t_(1.0); notes = (1046.5, 1318.5, 1568, 2093)
    x = np.zeros_like(t)
    for i, f in enumerate(notes):
        s = int(i * 0.08 * SR); seg = t[:len(t) - s]
        x[s:] += np.sin(2 * np.pi * f * seg) * env(len(seg) / SR, 0.003, 0.3)
    return x

def typing():
    x = np.zeros(int(1.0 * SR))
    for k in range(9):
        s = int((k * 0.1 + rng.uniform(0, 0.03)) * SR); c = rng.standard_normal(int(0.02 * SR)) * env(0.02, 0.0002, 0.003)
        x[s:s + len(c)] += lowpass(c, 4000 + rng.uniform(0, 2000))
    return x

def notif():
    t = t_(0.5); x = np.sin(2 * np.pi * 1760 * t) * env(0.5, 0.002, 0.1)
    s = int(0.12 * SR); x[s:] += np.sin(2 * np.pi * 2349 * t[:-s]) * env(0.5, 0.002, 0.15)[:-s]
    return x

def swipe():
    return whoosh(0.35, 0.16, 400, 7000, 0.8)

# Levels from the guide: whooshes -12, textures -6/-7, risers -5 (peak dBFS here; mixed later on top of a -14 LUFS voice)
save('whoosh_standard', whoosh(0.7, 0.32), -12)
save('whoosh_big', whoosh(1.2, 0.55, 120, 4000, 1.2), -10)
save('whoosh_short', whoosh(0.3, 0.12, 500, 8000), -12)
save('whoosh_transition', whoosh(0.9, 0.45, 150, 9000), -11)
save('swipe', swipe(), -12)
save('pop', pop(), -7)
save('ui_click', ui_click(), -7)
save('scifi_click', scifi_click(), -7)
save('tap', tap(), -6)
save('camera_click', camera_click(), -7)
save('scifi_impact', scifi_impact(), -6)
save('hit', hit(), -6)
save('riser_bass', riser_bass(1.8), -5)
save('riser_metal', riser_metal(1.6), -5)
save('suckback', suckback(1.2), -8)
save('coin', coin(), -7)
save('success', success(), -6)
save('typing', typing(), -9)
save('notif', notif(), -7)
print('ok')
