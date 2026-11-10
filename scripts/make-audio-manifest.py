#!/usr/bin/env python3
"""List which audio files exist so the app only offers audio that is really there."""
import json, os
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
d = os.path.join(root, "public", "audio")
names = sorted(f[:-4] for f in os.listdir(d) if f.endswith(".mp3"))
words = [n for n in names if not n.endswith("-ex")]
ex = [n[:-3] for n in names if n.endswith("-ex")]
json.dump({"w": words, "ex": ex}, open(os.path.join(d, "manifest.json"), "w"), separators=(",", ":"))
print(len(words), "word clips,", len(ex), "sentence clips")
