#!/usr/bin/env python3
"""Merge the approved idiom sources in data-src/ into src/data/idioms.json.

Sources (all approved by the teacher before they land here):
  data-src/archive.json   50 idioms from the GCE A archive (already used in 词游记)
  data-src/classics.json  典故 idioms from the prototype level
  data-src/batch-*.json   curated batches approved in the review Google Sheet

The script refuses to build if any clue contains a character of its own answer,
or if two entries share an idiom. It also groups idioms into 藏经阁 chapters (卷)
so that idioms learnt together share characters and can cross in a grid.

Usage: python3 scripts/build-data.py
"""
import glob, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "data-src")

# Teaching notes for archive idioms that the archive data does not carry.
ARCHIVE_TIPS = {
    "自给自足": "“给”在这里读 jǐ（供给），不读 gěi。",
    "自暴自弃": "反义成语：越挫越勇，也在真题词库里，可以成对记。",
    "越挫越勇": "反义成语：自暴自弃。",
    "雪中送炭": "反义：落井下石。两个都在真题词库里。",
    "落井下石": "反义：雪中送炭。",
    "垂头丧气": "反义：趾高气扬。",
    "趾高气扬": "反义：垂头丧气。“趾”是足字旁。",
    "何乐而不为": "五字俗语，常用反问句：“……，何乐而不为？”",
}

CHAPTER_SIZE = 10
CHAPTER_NAMES = ["龙门卷", "乾坤卷", "风云卷", "山河卷", "星斗卷", "江湖卷", "日月卷", "四海卷", "九州卷", "天下卷",
                 "青锋卷", "流云卷"]


def load():
    items = []
    for name in ["classics.json", "archive.json"] + sorted(
            os.path.basename(p) for p in glob.glob(os.path.join(SRC, "batch-*.json"))):
        with open(os.path.join(SRC, name), encoding="utf-8") as f:
            items += json.load(f)
    return items


def blank(ex, w):
    return ex.replace(w, "＿" * len(w)) if w in ex else ""


def chapters(items):
    """Greedy grouping: start from the prototype level, then keep adding the idiom that shares
    the most characters with what the student will already have learnt."""
    proto = [it for it in items if it["id"].startswith("cy-p")]
    archive_priority = {"exam": 0, "dg": 1, "curated": 2}
    rest = sorted((it for it in items if not it["id"].startswith("cy-p")),
                  key=lambda it: (archive_priority.get(it["origin"], 3), it["tier"], it["id"]))
    # the prototype level's archive idioms belong to chapter 1 as well
    proto_set = {"自给自足", "自私自利", "自暴自弃", "不离不弃", "不知所措"}
    ch1 = proto + [it for it in rest if it["w"] in proto_set]
    rest = [it for it in rest if it["w"] not in proto_set]
    out = [ch1]
    known = set("".join(it["w"] for it in ch1))
    while rest:
        cur = []
        cur_chars = set()
        while rest and len(cur) < CHAPTER_SIZE:
            def score(it):
                shared = len(set(it["w"]) & (known | cur_chars))
                return (shared, -archive_priority.get(it["origin"], 3))
            best = max(rest, key=score)
            rest.remove(best)
            cur.append(best)
            cur_chars |= set(best["w"])
        known |= cur_chars
        out.append(cur)
    return out


def main():
    items = load()
    seen, problems = set(), []
    for it in items:
        if it["w"] in seen:
            problems.append(f"duplicate idiom {it['w']}")
        seen.add(it["w"])
        leak = [c for c in it["w"] if c in it["clue"]]
        if leak:
            problems.append(f"{it['w']}: clue contains {''.join(leak)}")
        for k in ("py", "clue", "en", "ex"):
            if not it.get(k):
                problems.append(f"{it['w']}: missing {k}")
        if it["w"] not in it["ex"]:
            problems.append(f"{it['w']}: example sentence does not contain the idiom")
        if not it.get("tip"):
            it["tip"] = ARCHIVE_TIPS.get(it["w"], "")
        it["ctx"] = blank(it["ex"], it["w"])
        if not it.get("hint"):
            it["hint"] = "语境：" + it["ctx"]
        if any(c in it["hint"] for c in it["w"]):
            problems.append(f"{it['w']}: hint contains part of the answer")
        it.setdefault("panelNote", "")
    if problems:
        print("\n".join(problems))
        sys.exit(1)
    chs = chapters(items)
    order = []
    for n, ch in enumerate(chs):
        for it in ch:
            it["ch"] = n
            order.append(it)
    data = {
        "chapters": [{"n": n, "name": CHAPTER_NAMES[n] if n < len(CHAPTER_NAMES) else f"第{n + 1}卷",
                      "ids": [it["id"] for it in ch]} for n, ch in enumerate(chs)],
        "idioms": order,
    }
    with open(os.path.join(ROOT, "src", "data", "idioms.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(order)} idioms in {len(chs)} chapters")
    for c in data["chapters"]:
        print(" ", c["name"], " ".join(next(i["w"] for i in order if i["id"] == x) for x in c["ids"]))


if __name__ == "__main__":
    main()
