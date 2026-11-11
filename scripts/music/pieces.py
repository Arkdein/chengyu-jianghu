"""The 成语江湖 background loops. Run: python3 pieces.py <name> [...] → out/<name>.wav"""
import sys
import numpy as np
from scipy.io import wavfile
from synth import (SR, Track, render, drum, rim, bell, gong, wind, deg, hz, phrase, rng, apply_body, bus)
from synth import string as pluck

ST = 2 ** (1 / 12)


def play_line(tr, line, gong_note, beat, t0, kind='qin', pan=0.0, gain=1.0, ring=3.0, octave=0, vel=0.9):
    """Lay a phrase() line onto the track; returns the end time."""
    t = t0
    for d, o, b, fl in line:
        dur = b * beat
        if d == 0:
            t += dur
            continue
        f = deg(gong_note, d, o + octave)
        kw = {}
        if '/' in fl:
            f0 = f / ST ** 2
            kw['slide'] = (ST ** 2, 0.02, 0.16)
            f = f0
        elif '\\' in fl:
            kw['slide'] = (ST ** -2, dur * 0.55, 0.3)
        if '~' in fl:
            kw['vib'] = 0.006
        x = pluck(f, dur + ring, kind, vel=vel * rng.uniform(0.85, 1.0), harm='h' in fl, **kw)
        tr.add(x, t + rng.uniform(0, 0.012), pan=pan, gain=gain)
        t += dur
    return t


def beats(line):
    return sum(b for _, _, b, _ in line)


# ---------------------------------------------------------------- 书院: slow 古琴, 宫 mode on D, sparse, with wind and a far bell
def shuyuan():
    G, bpm = 'D3', 54
    beat = 60 / bpm
    A = phrase("3 5/ 6~= 0 5_ 6_ 1'/ 6\\= 0")
    B = phrase("1'h 2'h 3'h= 0 6 5 3~= 0")
    C = phrase("2 3/ 5_ 3_ 2~= 1 2_ 3_ 2\\ 1~=. 0_")
    D = phrase("6, 1 2/ 3~= 2_ 1_ 6, 1~=== 0=")
    seq = [A, B, C, D]
    total = sum(beats(p) for p in seq) * beat
    qin = Track(total)
    t = 0
    bass = {0: 'D2', 2: 'A1', 3: 'D2'}
    for i, p in enumerate(seq):
        if i in bass:
            qin.add(pluck(hz(bass[i]), 7.0, 'qin', vel=0.7), t, pan=-0.15)
        t = play_line(qin, p, G, beat, t, pan=0.1)
    apply_body(qin, 'qin')
    tr = bus(total, qin)
    tr.add(bell(hz('G2'), 8, 0.22), 0.4, pan=-0.5)
    tr.add(bell(hz('D3') * 0.99, 8, 0.12), total * 0.55, pan=0.5)
    w = wind(total, 0.035)
    tr.add(w, 0, pan=0)
    return render(tr, rt=3.2, wet=0.32, damp=3500, target_rms=0.085)


# ---------------------------------------------------------------- 比武: 堂鼓 + 古筝 ostinato, 羽 mode (A minor pentatonic on C 宫)
def biwu():
    G, bpm = 'C4', 132
    beat = 60 / bpm
    bars = 20
    total = bars * 4 * beat
    tr = Track(total)
    # drums: 4-bar pattern, a roll into every 4th bar
    for bar in range(bars):
        t = bar * 4 * beat
        hits = [(0, 1.0, 'b'), (1.5, 0.55, 's'), (2, 0.8, 'b'), (3, 0.5, 's'), (3.5, 0.6, 's')]
        if bar % 4 == 3:
            hits = [(0, 1.0, 'b'), (1, 0.6, 's'), (2, 0.8, 'b')] + [(2.5 + k * 0.25, 0.45 + k * 0.08, 's') for k in range(6)]
        for at, v, kind in hits:
            if kind == 'b':
                tr.add(drum(0.9, 112, 64, v), t + at * beat, pan=-0.1, gain=0.9)
            else:
                tr.add(drum(0.5, 180, 120, v * 0.7, bright=1.6), t + at * beat, pan=0.15, gain=0.7)
        for k in range(4):
            tr.add(rim(0.22), t + (k + 0.5) * beat, pan=0.45)
    # 古筝 ostinato: 羽 (6) based, eighth notes, low register
    osti = phrase("6,_ 3_ 6_ 1'_ 6,_ 3_ 5_ 3_")
    osti2 = phrase("5,_ 2_ 5_ 6_ 5,_ 2_ 3_ 2_")
    zh, pp = Track(total), Track(total)
    for bar in range(bars):
        line = osti if bar % 4 in (0, 1) else osti2 if bar % 4 == 2 else osti
        play_line(zh, line, G, beat, bar * 4 * beat, kind='zheng', pan=-0.3, gain=0.42, ring=0.5, octave=-1, vel=0.8)
    # melody (琵琶-ish, brighter), enters at bar 4
    mel = phrase("6= 1'_ 2'_ 3'= 2'_ 1'_ 6 5 6== 0 "
                 "3' 5'_ 3'_ 2' 1' 2'= 6 1' 6= 5 3 6=== "
                 "1' 2' 3'_ 5'_ 3' 2'= 1'_ 2'_ 3' 6' 5'_ 3'_ 2' 3'== "
                 "6 1' 2'_ 3'_ 2'_ 1'_ 6= 5 6=== 0=")
    t = 4 * 4 * beat
    for d, o, b, fl in mel:
        dur = b * beat
        if d and t < total:
            f = deg(G, d, o - 1)
            if b >= 2:  # 摇指 tremolo on long notes
                n = int(dur / (beat / 4))
                for k in range(n):
                    pp.add(pluck(f, beat / 4 + 0.4, 'pipa', vel=0.55 + 0.1 * (k % 2)), t + k * beat / 4, pan=0.25, gain=0.5)
            else:
                pp.add(pluck(f, dur + 0.5, 'pipa', vel=0.9), t, pan=0.25, gain=0.55)
        t += dur
    # 刮奏 glissando sweeps into bars 4, 8, 12
    for bar in (4, 12, 16):
        t0 = bar * 4 * beat - 0.42
        notes = [deg(G, d, o) for o in (-1, 0, 1) for d in (1, 2, 3, 5, 6)]
        for k, f in enumerate(notes):
            zh.add(pluck(f, 1.2, 'zheng', vel=0.35 + k * 0.03), t0 + k * 0.028, pan=-0.4 + k * 0.05, gain=0.45)
    apply_body(zh, 'zheng')
    apply_body(pp, 'pipa')
    tr = bus(total, tr, zh, pp)
    tr.add(gong(4, 0.5), 8 * 4 * beat, pan=0.2)
    return render(tr, rt=1.6, wet=0.2, damp=6000, target_rms=0.12)


PIECES = {'shuyuan': shuyuan, 'biwu': biwu}


def chime(dur=4.0, vel=0.2):
    """风铃: a few small high bell strikes."""
    return bell(hz('E6') * rng.uniform(0.98, 1.02), dur, vel) + np.pad(bell(hz('A6'), dur - 0.2, vel * 0.6), (int(0.2 * SR), 0))


# ---------------------------------------------------------------- 藏经阁: quiet 泛音, 商 mode (on D 宫, tonic E), very sparse
def cangjing():
    G, bpm = 'D3', 48
    beat = 60 / bpm
    seq = [phrase("2'h 3'h= 5'h 3'h 2'h= 0="),
           phrase("6 1'/ 2'~== 0 1'_ 6_ 5\\ 6== 0"),
           phrase("3'h 5'h 6'h= 5'h 3'h 2'h= 0="),
           phrase("5, 6, 1/ 2~=== 0==")]
    total = sum(beats(p) for p in seq) * beat
    qin = Track(total)
    t = 0
    for i, p in enumerate(seq):
        if i in (0, 2):
            qin.add(pluck(hz('E2' if i == 0 else 'B1'), 8.0, 'qin', vel=0.6), t, pan=-0.2)
        t = play_line(qin, p, G, beat, t, pan=0.15, vel=0.8)
    apply_body(qin, 'qin')
    tr = bus(total, qin)
    tr.add(wind(total, 0.025, 120, 600, 0.05), 0)
    tr.add(chime(5, 0.06), total * 0.3, pan=0.6)
    return render(tr, rt=3.6, wet=0.34, damp=3200, target_rms=0.075)


# ---------------------------------------------------------------- 客栈: light, bouncy 古筝, 徵 mode (on C 宫, tonic G)
def kezhan():
    G, bpm = 'C4', 100
    beat = 60 / bpm
    mel = phrase("5 6 1' 6 5 3 2 3 5_ 6_ 5 3 2 1 2 3= 5 6 1' 2' 3' 2' 1' 6 5_ 6_ 1' 6 5 5== 0 "
                 "3' 5' 3' 2' 1' 2' 1' 6 5 6 1' 2' 3'== 0 2' 3' 2' 1' 6 1' 6 5 3 5 6_ 1'_ 6 5===")
    bars = 16
    total = bars * 4 * beat
    zh, tr = Track(total), Track(total)
    play_line(zh, mel, G, beat, 0, kind='zheng', pan=0.2, gain=0.8, ring=1.2, vel=0.85)
    roots = [5, 1, 6, 5, 1, 6, 2, 5, 1, 5, 1, 1, 2, 6, 2, 5]
    for bar, r in enumerate(roots):
        t = bar * 4 * beat
        for k, (d, o) in enumerate(((r, -2), (5 if r != 5 else 2, -1), (r, -1), (5 if r != 5 else 2, -1))):
            zh.add(pluck(deg(G, d, o), beat + 0.6, 'zheng', vel=0.55 if k == 0 else 0.35), t + k * beat, pan=-0.35, gain=0.6)
        tr.add(rim(0.12), t + beat, pan=0.5)
        tr.add(rim(0.1), t + 3 * beat, pan=0.5)
        if bar % 4 == 0:
            tr.add(bell(hz('E6'), 2.5, 0.07), t, pan=0.6)
    apply_body(zh, 'zheng')
    tr = bus(total, tr, zh)
    return render(tr, rt=1.3, wet=0.18, damp=5000, target_rms=0.095)


# ---------------------------------------------------------------- 奇遇 / 岔路: mysterious, 羽 mode (A), wind, 醒木 knock
def qiyu():
    G, bpm = 'C4', 66
    beat = 60 / bpm
    seq = [phrase("6, 0_ 1_ 3~== 0="),
           phrase("2 1_ 6,_ 5,\\= 0 3, 5,_ 6,_ 3,~=== 0="),
           phrase("6'h 5'h 3'h= 0 2'h 3'h 6h= 0="),
           phrase("6,, 1, 3, 2,~== 1,_ 2,_ 6,,~=== 0==")]
    total = sum(beats(p) for p in seq) * beat
    qin, zh, tr = Track(total), Track(total), Track(total)
    t = 0
    for i, p in enumerate(seq):
        qin.add(pluck(hz('A1'), 9.0, 'qin', vel=0.55), t, pan=-0.2)
        if i == 2:
            t = play_line(zh, p, G, beat, t, kind='zheng', pan=0.4, gain=0.7, vel=0.7)
        else:
            t = play_line(qin, p, G, beat, t, pan=0.1, octave=0)
    apply_body(qin, 'qin')
    apply_body(zh, 'zheng')
    tr = bus(total, qin, zh)
    tr.add(rim(0.55), 0.05, pan=0)          # 醒木
    tr.add(rim(0.25), 0.05 + 0.09, pan=0)
    tr.add(wind(total, 0.06, 150, 900, 0.09), 0)
    tr.add(chime(5, 0.05), total * 0.62, pan=-0.6)
    return render(tr, rt=3.0, wet=0.32, damp=3800, target_rms=0.08)


# ---------------------------------------------------------------- 心魔: low drums, semitone clashes, reversed gong swells
def xinmo():
    bpm = 70
    beat = 60 / bpm
    bars = 12
    total = bars * 4 * beat
    tr, qin, zh = Track(total), Track(total), Track(total)
    A1, A2, Bb2, E2, E5, F5 = (hz(n) for n in ('A1', 'A2', 'Bb2', 'E2', 'E5', 'F5'))
    for bar in range(bars):
        t = bar * 4 * beat
        hits = [(0, 1.0, 'b'), (0.75, 0.5, 'b'), (2, 0.85, 'b'), (3.5, 0.4, 's')]
        if bar % 4 == 3:
            hits = [(0, 1.0, 'b'), (2, 0.8, 'b')] + [(2.5 + k * 0.25, 0.35 + k * 0.1, 's') for k in range(6)]
        for at, v, kind in hits:
            if kind == 'b':
                tr.add(drum(1.1, 96, 52, v), t + at * beat, pan=-0.05, gain=1.0)
            else:
                tr.add(drum(0.5, 160, 110, v * 0.7, bright=1.4), t + at * beat, pan=0.2, gain=0.7)
        # low drone that sags a semitone, the sound of doubt creeping in
        qin.add(pluck(A1, 4 * beat + 1.5, 'qin', vel=0.75, slide=(2 ** (-1 / 12), 2.2 * beat, 1.2 * beat), vib=0.004), t, pan=-0.2)
        for k, f in enumerate((A2, Bb2, A2, E2)):
            zh.add(pluck(f, beat + 0.5, 'zheng', vel=0.5 if k != 1 else 0.6), t + k * beat, pan=0.3, gain=0.55)
        if bar % 4 == 2:
            for f in (E5, F5):
                zh.add(pluck(f, 2.5, 'zheng', vel=0.4), t + 2 * beat, pan=0.5, gain=0.5)
        if bar % 4 == 3:  # reversed gong swelling into the next downbeat
            g = gong(3.0, 0.7)[::-1]
            tr.add(g, t + 4 * beat - len(g) / SR, pan=0.1, gain=0.8)
    apply_body(qin, 'qin')
    apply_body(zh, 'zheng')
    tr = bus(total, tr, qin, zh)
    tr.add(wind(total, 0.04, 80, 400, 0.11), 0)
    return render(tr, rt=2.2, wet=0.26, damp=3000, target_rms=0.11)


# ---------------------------------------------------------------- stingers (not looped)
def win():
    total = 5.0
    tr, zh = Track(total), Track(total)
    for k, at in enumerate((0, 0.22, 0.4, 0.55)):
        tr.add(drum(0.8, 120, 70, 0.6 + 0.1 * k), at, gain=0.9)
    notes = [deg('C4', d, o) for o in (-1, 0, 1) for d in (1, 2, 3, 5, 6)]
    for k, f in enumerate(notes):
        zh.add(pluck(f, 1.5, 'zheng', vel=0.35 + k * 0.03), 0.62 + k * 0.03, pan=-0.4 + k * 0.05)
    for f in ('C4', 'E4', 'G4', 'C5', 'E5'):
        zh.add(pluck(hz(f), 4.0, 'zheng', vel=0.7), 1.1 + rng.uniform(0, 0.02), pan=rng.uniform(-0.3, 0.3))
    tr.add(gong(4, 0.7), 1.1)
    tr.add(drum(1.2, 110, 60, 1.0), 1.1)
    apply_body(zh, 'zheng')
    tr = bus(total, tr, zh)
    return render(tr, rt=2.2, wet=0.28, damp=5000, loop=False, target_rms=0.12)


def lose():
    total = 5.0
    tr, qin = Track(total), Track(total)
    qin.add(pluck(hz('A2'), 4.6, 'qin', vel=0.9, slide=(2 ** (-5 / 12), 0.8, 1.6), vib=0.004), 0.1)
    qin.add(pluck(hz('A1'), 4.8, 'qin', vel=0.6), 0.1)
    tr.add(drum(1.3, 80, 45, 0.6), 0.1)
    tr.add(wind(total, 0.05, 120, 600, 0.2), 0)
    apply_body(qin, 'qin')
    tr = bus(total, tr, qin)
    return render(tr, rt=3.0, wet=0.32, damp=3000, loop=False, target_rms=0.09)


PIECES.update({'cangjing': cangjing, 'kezhan': kezhan, 'qiyu': qiyu, 'xinmo': xinmo, 'win': win, 'lose': lose})

if __name__ == '__main__':
    import os
    os.makedirs('out', exist_ok=True)
    for name in sys.argv[1:]:
        x = PIECES[name]()
        wavfile.write(f'out/{name}.wav', SR, x)
        print(name, f'{len(x) / SR:.1f}s', 'peak', float(np.abs(x).max()))
