# Drafts for the rest of the idiom bank. Each batch is checked (clue/hint leaks, pinyin against pypinyin,
# duplicates, example contains the idiom) and written as data-src/drafts/<batch>.pending.json plus sheet rows.
# Usage: python3 bank.py            (checks every batch)
import json, os, sys, importlib.util
from pypinyin import pinyin, Style

D = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(D))
STRAND = {"P": "个人成长与心理素质", "R": "人际关系与家庭", "C": "社区生活与邻里精神", "T": "科技与数码生活",
          "E": "环境与永续发展", "H": "传统文化与现代化", "G": "公民意识与社会政策", "W": "职场经济与劳动力",
          "Y": "教育青少年与乐龄课题", "L": "文学与文言"}


def parse_simple(text):
    """w|py|clue|en|example|strand|tip|src  (tip and src may be empty)"""
    out = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        p = [x.strip() for x in line.split("|")]
        p += [""] * (8 - len(p))
        w, py, clue, en, ex, st, tip, src = p[:8]
        out.append(dict(w=w, py=py, clue=clue, en=en, ex=ex, strand=STRAND[st], tip=tip, src=src, hint="", panels=[], panelNote=""))
    return out


def load_batches():
    batches = {}
    for name in sorted(os.listdir(D)):
        if name.startswith("bank_") and name.endswith(".py"):
            spec = importlib.util.spec_from_file_location(name[:-3], os.path.join(D, name))
            m = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(m)
            for key, items in m.BATCHES.items():
                batches[key] = items
    return batches


def existing():
    words = set()
    for f in os.listdir(os.path.join(ROOT, "data-src")):
        if f.endswith(".json"):
            words |= {x["w"] for x in json.load(open(os.path.join(ROOT, "data-src", f)))}
    return words


def check_all():
    batches = load_batches()
    have = existing()
    seen = set()
    problems = []
    for key, items in batches.items():
        for it in items:
            w = it["w"]
            if w in have or w in seen:
                problems.append(f"{key} {w}: duplicate")
            seen.add(w)
            for field in ("clue", "hint"):
                leak = [c for c in w if c in it.get(field, "")]
                if leak:
                    problems.append(f"{key} {w}: {field} leaks {''.join(leak)}")
            if not it.get("hint"):
                ctx = it["ex"].replace(w, "＿" * len(w))
                leak = [c for c in w if c in ctx]
                if leak:
                    problems.append(f"{key} {w}: example context leaks {''.join(leak)}")
            if w not in it["ex"]:
                problems.append(f"{key} {w}: example lacks idiom")
            if len(it["py"].split()) != len(w):
                problems.append(f"{key} {w}: pinyin syllable count")
            ref = " ".join(s[0] for s in pinyin(w, style=Style.TONE))
            if ref != it["py"]:
                problems.append(f"{key} {w}: pinyin '{it['py']}' vs pypinyin '{ref}' (check)")
    return batches, problems


def write(batches):
    rows = []
    for key, items in batches.items():
        prefix, tracks, tier = ("H2" + key[2:].upper(), ["H2"], 2) if key.startswith("h2") else (key.upper(), ["H1", "H2"], 1)
        out = []
        for i, it in enumerate(items):
            rec = {"id": f"cy-{key}{i + 1:02d}", "w": it["w"], "py": it["py"], "tracks": tracks, "tier": tier,
                   "origin": "h2" if key.startswith("h2") else ("dg" if it["panels"] else "curated"), "exam": "",
                   "src": it["src"], "def": it["clue"], "clue": it["clue"], "en": it["en"], "ex": it["ex"],
                   "hint": it["hint"], "tip": it["tip"], "strand": it["strand"], "panels": it["panels"],
                   "panelNote": it["panelNote"]}
            if it.get("wenyan"):
                rec["wenyan"] = it["wenyan"]
            out.append(rec)
            rows.append([f"{prefix}-{i + 1:02d}", rec["w"], rec["py"], rec["clue"], rec["en"], rec["ex"], rec["src"],
                         "是" if rec["panels"] else "否", rec["strand"], rec["tip"], "H2" if tracks == ["H2"] else "H1",
                         "待审", "", rec.get("wenyan", ""), "\n".join(f"{n + 1}. {p}" for n, p in enumerate(rec["panels"]))])
        json.dump(out, open(os.path.join(D, f"batch-{key}.pending.json"), "w"), ensure_ascii=False, indent=1)
    json.dump(rows, open(os.path.join(D, "bank-rows.json"), "w"), ensure_ascii=False)
    return rows


if __name__ == "__main__":
    batches, problems = check_all()
    print("\n".join(problems) or "clean")
    print({k: len(v) for k, v in batches.items()}, "total", sum(len(v) for v in batches.values()))
    if "--write" in sys.argv:
        print(len(write(batches)), "rows written")
