"""Small additive/physical-ish synth for 成语江湖 background music. Everything here is original and generated."""
import numpy as np
from scipy.signal import fftconvolve, butter, sosfilt

SR = 44100
rng = np.random.default_rng(7)

# ---------------------------------------------------------------- pitch
A4 = 440.0
NAMES = {'C': -9, 'D': -7, 'E': -5, 'F': -4, 'G': -2, 'A': 0, 'B': 2}


def hz(name):
    """'D3', 'F#4', 'Bb2' → Hz."""
    n, rest = name[0], name[1:]
    acc = 0
    while rest and rest[0] in '#b':
        acc += 1 if rest[0] == '#' else -1
        rest = rest[1:]
    octv = int(rest)
    return A4 * 2 ** ((NAMES[n] + acc + 12 * (octv - 4)) / 12)


def lp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'low', fs=SR, output='sos'), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, 'high', fs=SR, output='sos'), x)


def bp(x, lo, hi, order=2):
    return sosfilt(butter(order, [lo, hi], 'band', fs=SR, output='sos'), x)


# ---------------------------------------------------------------- plucked strings
KINDS = {
    #        harmonics, rolloff, pluck pos, base decay /s, decay growth, inharm, lowpass, attack noise
    'qin':   dict(K=16, p=1.15, beta=0.13, d0=0.45, c=0.010, B=0.00008, lp=3200, noise=0.10),
    'zheng': dict(K=24, p=0.95, beta=0.07, d0=0.95, c=0.018, B=0.00012, lp=7000, noise=0.16),
    'pipa':  dict(K=22, p=0.9, beta=0.10, d0=2.6, c=0.03, B=0.0001, lp=6500, noise=0.22),
}


def pluck(f, dur, kind='qin', vel=1.0, slide=None, vib=0.0, harm=False):
    """One plucked note. slide=(ratio, start_s, length_s) glides the pitch; vib = 吟猱 depth (fraction)."""
    P = KINDS[kind]
    n = int(dur * SR)
    t = np.arange(n) / SR
    fp = np.full(n, f, dtype=float)
    if slide:
        r, s0, ln = slide
        k = np.clip((t - s0) / ln, 0, 1)
        k = k * k * (3 - 2 * k)
        fp *= r ** k
    if vib:
        env = np.clip((t - 0.25) / 0.6, 0, 1)
        fp *= 1 + vib * env * np.sin(2 * np.pi * 4.6 * t + rng.uniform(0, 6))
    ph = 2 * np.pi * np.cumsum(fp) / SR
    out = np.zeros(n)
    if harm:  # 泛音: light touch at a node → mostly the 2nd/4th partial, glassy and long
        for k, a, d in ((1, 1.0, 0.9), (2, 0.25, 1.6), (3, 0.08, 2.4)):
            out += a * np.sin(k * ph) * np.exp(-d * t)
        out *= 0.55
    else:
        for k in range(1, P['K'] + 1):
            if k * f > 11000:
                break
            a = abs(np.sin(np.pi * k * P['beta'])) / k ** P['p']
            d = P['d0'] * (1 + P['c'] * k * k) * (1 + 0.3 * (f / 400))
            out += a * np.sin(k * ph * np.sqrt(1 + P['B'] * k * k) + rng.uniform(0, 0.3)) * np.exp(-d * t)
        nb = int(0.012 * SR)
        burst = rng.standard_normal(nb) * np.exp(-np.arange(nb) / (0.003 * SR))
        out[:nb] += P['noise'] * bp(burst, f * 1.5, min(f * 12, 15000))
        out = lp(out, P['lp'])
    atk = np.clip(t / 0.003, 0, 1)
    rel = np.clip((dur - t) / min(0.6, dur * 0.3), 0, 1) ** 2
    return out * atk * rel * vel


# ---------------------------------------------------------------- percussion
def drum(dur=0.9, f0=118, f1=68, vel=1.0, bright=1.0):
    """堂鼓: pitch-dropping membrane plus a stick click."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / 0.05)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / 0.28) + 0.35 * np.sin(1.59 * ph) * np.exp(-t / 0.12)
    click = lp(rng.standard_normal(n), 2500 * bright) * np.exp(-t / 0.012) * 0.5
    return np.tanh(1.4 * (body + click)) * vel


def rim(vel=0.5):
    """鼓边 / 梆子: short woody tick."""
    n = int(0.12 * SR)
    t = np.arange(n) / SR
    imp = np.zeros(n)
    imp[:30] = rng.standard_normal(30)
    x = bp(imp, 900, 1080, 2) * 9 + bp(imp, 1450, 1650, 2) * 5  # a struck block of wood rings at its own modes
    x = x / (np.abs(x).max() + 1e-9) * np.exp(-t / 0.03)
    x += 0.35 * bp(rng.standard_normal(n), 1800, 5000) * np.exp(-t / 0.005)
    return x * vel


def bell(f=196, dur=7.0, vel=0.5):
    """Distant temple bell: inharmonic partials, very long decay."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for r, a, d in ((0.5, 0.6, 0.35), (1.0, 1.0, 0.5), (1.19, 0.5, 0.7), (2.0, 0.45, 0.9), (2.74, 0.3, 1.3), (3.76, 0.18, 1.8)):
        x += a * np.sin(2 * np.pi * f * r * t + rng.uniform(0, 6)) * np.exp(-d * t)
    x *= np.clip(t / 0.004, 0, 1)
    return lp(x, 2500) * vel


def gong(dur=4.0, vel=0.6):
    """小锣-ish crash-swell for flourishes."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = np.zeros(n)
    for f, a in ((310, 1), (467, .7), (633, .6), (871, .5), (1190, .4), (1650, .3)):
        x += a * np.sin(2 * np.pi * f * (1 + 0.02 * np.exp(-t / 0.4)) * t + rng.uniform(0, 6))
    x += 0.6 * hp(rng.standard_normal(n), 2000)
    return lp(x, 6000) * np.exp(-t / 1.3) * np.clip(t / 0.003, 0, 1) * vel * 0.35


def wind(dur, level=0.05, lo=180, hi=900, rate=0.07):
    n = int(dur * SR)
    t = np.arange(n) / SR
    x = bp(rng.standard_normal(n), lo, hi)
    env = 0.6 + 0.4 * np.sin(2 * np.pi * rate * t) * np.sin(2 * np.pi * rate * 0.37 * t + 1)
    return x / (np.abs(x).max() + 1e-9) * env * level


# ---------------------------------------------------------------- mixing
class Track:
    def __init__(self, seconds):
        self.n = int(seconds * SR)
        self.L = np.zeros(self.n + 12 * SR)
        self.R = np.zeros(self.n + 12 * SR)

    def add(self, x, at, pan=0.0, gain=1.0):
        i = int(at * SR)
        j = min(i + len(x), len(self.L))
        x = x[: j - i] * gain
        self.L[i:j] += x * np.sqrt((1 - pan) / 2)
        self.R[i:j] += x * np.sqrt((1 + pan) / 2)


def reverb_ir(rt=2.4, damp=4000):
    n = int(rt * SR)
    t = np.arange(n) / SR
    env = np.exp(-6.9 * t / rt)
    irs = []
    for _ in range(2):
        x = rng.standard_normal(n) * env
        x = 0.5 * lp(x, damp) + 0.5 * lp(x, damp / 3) * (1 - np.exp(-t * 4))
        x[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
        irs.append(x / np.sqrt((x ** 2).sum()))
    return irs


def render(track, rt=2.4, wet=0.28, damp=4000, loop=True, target_rms=0.11):
    """Reverb, wrap the tail onto the start so the loop is seamless, master."""
    irL, irR = reverb_ir(rt, damp)
    L = track.L + wet * fftconvolve(track.L, irL)[: len(track.L)] * 3
    R = track.R + wet * fftconvolve(track.R, irR)[: len(track.R)] * 3
    if loop:
        tail = len(L) - track.n
        L[:tail] += L[track.n:]
        R[:tail] += R[track.n:]
        L, R = L[: track.n], R[: track.n]
    st = np.stack([L, R], 1)
    st = hp(st.T, 35).T
    rms = np.sqrt((st ** 2).mean())
    st *= target_rms / (rms + 1e-9)
    st = np.tanh(st * 1.3) / 1.3
    return np.clip(st, -0.98, 0.98).astype(np.float32)


# ---------------------------------------------------------------- notation
def scale(tonic, mode):
    """Pentatonic degrees 1 2 3 5 6 on a 宫 note; returns degree → semitones."""
    return {1: 0, 2: 2, 3: 4, 5: 7, 6: 9}


def deg(gong_name, d, octave=0):
    """Scale degree d (1,2,3,5,6) above the 宫 note, shifted by octaves."""
    return hz(gong_name) * 2 ** (({1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11}[d] + 12 * octave) / 12)


def phrase(src):
    """'5 6_ 5_ 3~= 0 2 3 1/=' → [(degree, octave, beats, flags)].
    digit = degree; ' up an octave, , down; _ halves the beat, = adds a beat, . adds half;
    ~ 吟猱 vibrato, / slide up into the note, \\ slide down after it, h 泛音, 0 = rest."""
    out = []
    for tok in src.split():
        d = int(tok[0])
        o = tok.count("'") - tok.count(',')
        b = 1.0
        for ch in tok:
            if ch == '_':
                b /= 2
            elif ch == '=':
                b += 1
            elif ch == '.':
                b += 0.5
        flags = set(c for c in tok if c in '~/\\h')
        out.append((d, o, b, flags))
    return out


# ================================================================ v2: physical string model (Karplus-Strong waveguide)
from scipy.signal import lfilter

STRINGS = {
    #          T60 at f0 (s), loss-filter brightness a, pluck pos, excitation softness (× f0 lowpass), detune cents, body mix
    'qin':   dict(t60=7.0, a=0.64, pos=0.12, soft=11, det=0.9, body=0.55, squeak=0.05),
    'zheng': dict(t60=3.6, a=0.86, pos=0.09, soft=30, det=1.6, body=0.35, squeak=0.0),
    'pipa':  dict(t60=1.6, a=0.88, pos=0.14, soft=36, det=1.2, body=0.3, squeak=0.0),
}


def _ks(f, n, t60, a, exc):
    """One string: delay line + lowpass loss + allpass fine tuning, run with lfilter."""
    P = SR / f
    N = int(np.floor(P - (1 - a) - 0.15))
    d = P - N - (1 - a)
    c = (1 - d) / (1 + d)
    g = 0.001 ** (1 / (f * t60))
    den = np.zeros(N + 3)
    den[0], den[1] = 1.0, c
    den[N] -= g * a * c
    den[N + 1] -= g * (a + (1 - a) * c)
    den[N + 2] -= g * (1 - a)
    x = np.zeros(n)
    x[: len(exc)] = exc[:n]
    return lfilter([1.0, c], den, x)


def _bend(x, ratio):
    """Time-varying pitch: read x at speed ratio(t)."""
    pos = np.concatenate([[0], np.cumsum(ratio[:-1])])
    pos = pos[pos < len(x) - 1]
    return np.interp(pos, np.arange(len(x)), x)


def string(f, dur, kind='qin', vel=1.0, slide=None, vib=0.0, harm=False):
    P = STRINGS[kind]
    n = int(dur * SR)
    t = np.arange(n) / SR
    # pitch path relative to f: attack tension overshoot, slides, 吟猱
    r = np.ones(n) * (1 + 0.003 * np.exp(-t / 0.08))
    if slide:
        rr, s0, ln = slide
        k = np.clip((t - s0) / ln, 0, 1)
        k = k * k * (3 - 2 * k)
        r *= rr ** k
    if vib:
        env = np.clip((t - 0.3) / 0.7, 0, 1)
        r *= 1 + vib * env * np.sin(2 * np.pi * (4.2 + 0.8 * t) * t + rng.uniform(0, 6))
    fmax = f * r.max()
    m = int(n * r.max()) + SR // 10
    per = int(SR / f)
    # excitation: one period of noise, softened like a fingertip/silk, combed by pluck position
    k = max(1, int(P['pos'] * per))
    i = np.arange(per)
    e = np.where(i < k, i / k, (per - i) / (per - k))  # the string's shape at release: a triangle peaked at the pluck point
    e = e - e.mean() + 0.12 * rng.standard_normal(per)
    e = lp(np.concatenate([e, np.zeros(per)]), min(f * P['soft'], 16000))
    if harm:  # 泛音: touch at 1/2 → only even partials survive; damp the odd ones with a comb at half the period
        h = per // 2
        e = e + np.concatenate([np.zeros(h), e[:-h]])
    t60 = P['t60'] * (1.4 if harm else 1) * (220 / f) ** 0.35
    s1 = _ks(f, m, t60, P['a'] + (0.08 if harm else 0), e)
    s2 = _ks(f * 2 ** (P['det'] / 1200), m, t60 * 0.8, P['a'], e * 0.7)
    s = s1 + s2
    s = _bend(s, r)[:n]
    if len(s) < n:
        s = np.pad(s, (0, n - len(s)))
    s = hp(s, 40)
    if P['squeak'] and slide:  # 走手音: silk under the sliding finger
        ns = bp(rng.standard_normal(n), 1200, 4200)
        k = np.clip((t - slide[1]) / slide[2], 0, 1)
        win = np.sin(np.pi * k) * (k > 0) * (k < 1)
        s += P['squeak'] * ns * win * np.abs(s).max()
    s /= np.abs(s).max() + 1e-9
    atk = np.clip(t / 0.004, 0, 1)
    rel = np.clip((dur - t) / min(0.6, dur * 0.3), 0, 1) ** 2
    return s * atk * rel * vel * 0.6


def body_ir(kind='qin', seconds=0.25):
    """A wooden soundbox: a handful of damped resonances plus the direct sound."""
    n = int(seconds * SR)
    t = np.arange(n) / SR
    modes = {'qin': [(96, .9, .06), (152, .8, .05), (218, .7, .045), (305, .55, .04), (410, .5, .035), (560, .4, .03), (760, .3, .022), (1040, .22, .018), (1500, .12, .012)],
             'zheng': [(130, .6, .04), (240, .7, .035), (380, .6, .03), (620, .5, .022), (900, .4, .018), (1400, .3, .012), (2100, .2, .008)],
             'pipa': [(180, .6, .03), (330, .7, .025), (520, .6, .02), (850, .5, .015), (1300, .4, .01), (2200, .3, .007)]}[kind]
    ir = np.zeros(n)
    for f, a, tau in modes:
        ir += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6)) * np.exp(-t / tau)
    ir /= np.sqrt((ir ** 2).sum())
    out = np.zeros(n)
    out[0] = 1.0
    return out, ir


def apply_body(track, kind):
    direct, ir = body_ir(kind)
    mix = STRINGS[kind]['body']
    for ch in ('L', 'R'):
        x = getattr(track, ch)
        y = fftconvolve(x, ir)[: len(x)]
        y *= np.sqrt((x ** 2).sum()) / (np.sqrt((y ** 2).sum()) + 1e-9)
        setattr(track, ch, (1 - mix) * x + mix * y)
    if kind == 'qin':  # silk strings on a long box: warm, little above 3 kHz
        track.L, track.R = lp(track.L, 3800), lp(track.R, 3800)


def bus(total, *tracks):
    """Sum instrument tracks (each already body-processed) into one track."""
    out = Track(total)
    for tr in tracks:
        out.L += tr.L
        out.R += tr.R
    return out
