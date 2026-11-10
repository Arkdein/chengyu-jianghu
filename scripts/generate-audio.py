#!/usr/bin/env python3
"""Generate offline Mandarin audio (MeloTTS via sherpa-onnx) for every idiom and its example.

Usage: python3 scripts/generate-audio.py MODEL_DIR [--force]

The model is vits-melo-tts-zh_en from the sherpa-onnx releases:
  https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/vits-melo-tts-zh_en.tar.bz2

Polyphones (叶公好龙 = hào, 自给自足 = jǐ, 潜移默化 = qián …) are the classic TTS trap, so this
script does not trust the model's dictionary. It copies the model to a working folder, then writes
every idiom into its lexicon using the pinyin in src/data/idioms.json (the teacher-approved
reading), and adds the idiom to the segmentation dictionary so the reading also holds inside the
example sentence. It prints every idiom where the model's own reading differed, for a spot check.

Writes public/audio/<id>.mp3 and <id>-ex.mp3, then refreshes public/audio/manifest.json.
"""
import json, os, re, shutil, subprocess, sys, unicodedata

from pypinyin import pinyin, Style

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "audio")


def numbered(syl):
    """'hào' -> ('hao', 4); 'lǚ' -> ('lv', 3); neutral tone -> 5"""
    tone = 5
    base = ""
    for ch in unicodedata.normalize("NFD", syl.lower()):
        o = ord(ch)
        if o == 0x304: tone = 1
        elif o == 0x301: tone = 2
        elif o == 0x30C: tone = 3
        elif o == 0x300: tone = 4
        elif o == 0x308: base += "v"
        else: base += ch
    return base.replace("uv", "v").replace("ü", "v"), tone


def spoken_tones(word, tones):
    """Tone sandhi for 一 and 不, as they are spoken (the pinyin shown to students stays in citation form)."""
    out = list(tones)
    for i, ch in enumerate(word[:-1]):
        nxt = tones[i + 1]
        if ch == "不" and nxt == 4:
            out[i] = 2
        elif ch == "一" and i == 0:
            out[i] = 2 if nxt == 4 else 4
    return out


def build_syllable_map(lexicon_lines):
    """toneless pinyin syllable -> list of phones, learnt from the model's own single-character
    entries (paired with pypinyin's default reading of that character)."""
    m = {}
    for line in lexicon_lines:
        parts = line.split()
        if len(parts) < 3 or len(parts[0]) != 1 or not ("一" <= parts[0] <= "鿿"):
            continue
        n = (len(parts) - 1) // 2
        phones = parts[1:1 + n]
        py = pinyin(parts[0], style=Style.TONE3, neutral_tone_with_five=True)[0][0]
        base = re.sub(r"\d", "", py).replace("ü", "v")
        m.setdefault(base, phones)
    return m


def main():
    model_src = sys.argv[1]
    force = "--force" in sys.argv
    work = os.path.join(ROOT, ".tts-model")
    if os.path.exists(work):
        shutil.rmtree(work)
    shutil.copytree(model_src, work)

    data = json.load(open(os.path.join(ROOT, "src", "data", "idioms.json"), encoding="utf-8"))
    idioms = data["idioms"]
    lex_path = os.path.join(work, "lexicon.txt")
    lines = open(lex_path, encoding="utf-8").read().splitlines()
    syl = build_syllable_map(lines)
    index = {l.split(" ", 1)[0]: i for i, l in enumerate(lines)}

    changed, problems = [], []
    for it in idioms:
        sylls = [numbered(s) for s in it["py"].split()]
        said = spoken_tones(it["w"], [t for _, t in sylls])
        phones, tones = [], []
        for (base, _), tone in zip(sylls, said):
            if base not in syl:
                problems.append(f"{it['w']}: no phones for {base}")
                break
            p = syl[base]
            phones += p
            tones += [str(tone)] * len(p)
        else:
            entry = f"{it['w']} {' '.join(phones)} {' '.join(tones)}"
            if it["w"] in index:
                old = lines[index[it["w"]]]
                if old.split() != entry.split():
                    changed.append(f"{it['w']}: model had «{old}», now «{entry}»")
                lines[index[it["w"]]] = entry
            else:
                lines.append(entry)
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    open(lex_path, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    # make sure the segmenter keeps each idiom whole inside sentences
    with open(os.path.join(work, "dict", "jieba.dict.utf8"), "a", encoding="utf-8") as f:
        for it in idioms:
            f.write(f"{it['w']} 100000 i\n")
    print(f"{len(changed)} idioms where the model's reading was replaced:")
    print("\n".join("  " + c for c in changed))

    import sherpa_onnx, soundfile as sf
    cfg = sherpa_onnx.OfflineTtsConfig(
        model=sherpa_onnx.OfflineTtsModelConfig(
            vits=sherpa_onnx.OfflineTtsVitsModelConfig(
                model=f"{work}/model.onnx", lexicon=lex_path,
                tokens=f"{work}/tokens.txt", dict_dir=f"{work}/dict"),
            num_threads=4, provider="cpu"),
        rule_fsts=",".join(f"{work}/{f}" for f in ["date.fst", "number.fst", "phone.fst", "new_heteronym.fst"]
                           if os.path.exists(f"{work}/{f}")),
        max_num_sentences=1)
    tts = sherpa_onnx.OfflineTts(cfg)
    os.makedirs(OUT, exist_ok=True)

    def synth(text, path, speed):
        if os.path.exists(path) and not force:
            return
        a = tts.generate(text, sid=0, speed=speed)
        wav = path + ".tmp.wav"
        sf.write(wav, a.samples, a.sample_rate)
        subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", wav, "-ac", "1", "-ar", "24000",
                        "-codec:a", "libmp3lame", "-b:a", "40k", path], check=True)
        os.remove(wav)

    for n, it in enumerate(idioms, 1):
        synth(it["w"], os.path.join(OUT, f"{it['id']}.mp3"), 0.85)
        synth(it["ex"], os.path.join(OUT, f"{it['id']}-ex.mp3"), 0.95)
        if n % 20 == 0:
            print(f"{n} idioms done", flush=True)
    shutil.rmtree(work)
    subprocess.run([sys.executable, os.path.join(ROOT, "scripts", "make-audio-manifest.py")], check=True)


if __name__ == "__main__":
    main()
