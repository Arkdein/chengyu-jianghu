"""Normalise, add the 2 s overlap tail for crossfade looping, encode into the app."""
import json, os, subprocess, numpy as np, sys
from scipy.io import wavfile
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'public', 'music')
LOOPS = ['shuyuan', 'biwu', 'cangjing', 'kezhan', 'qiyu', 'xinmo']
STINGS = ['win', 'lose']
def lufs(path):
    r = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(r.split('Integrated loudness:')[1].split('I:')[1].split('LUFS')[0])
man = {}
import os; os.makedirs(OUT, exist_ok=True)
for n in LOOPS + STINGS:
    sr, x = wavfile.read(f'out/{n}.wav')
    if n in STINGS:
        env = np.abs(x).max(1)
        last = np.where(env > 10 ** (-55 / 20))[0].max()
        x = x[: last + sr // 2].copy()
        f = min(len(x), sr)
        x[-f:] *= np.linspace(1, 0, f)[:, None]
    loop = len(x) / sr
    if n in LOOPS:
        x = np.concatenate([x, x[: 2 * sr]])
    wavfile.write('/tmp/m.wav', sr, x.astype(np.float32))
    gain = (-20 if n in LOOPS else -18) - lufs('/tmp/m.wav')
    subprocess.run(['ffmpeg', '-hide_banner', '-loglevel', 'error', '-y', '-i', '/tmp/m.wav', '-af', f'volume={gain:.2f}dB,alimiter=limit=0.95',
                    '-b:a', '96k', f'{OUT}/{n}.mp3'], check=True)
    man[n] = {'loop': round(loop, 4)} if n in LOOPS else {}
    print(n, f'{loop:.2f}s', f'gain {gain:+.1f} dB', os.path.getsize(f'{OUT}/{n}.mp3') // 1024, 'KB')
json.dump(man, open(f'{OUT}/manifest.json', 'w'))
