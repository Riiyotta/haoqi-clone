#!/usr/bin/env python3
"""Re-point citation line ranges after the clone source moved (R16).

    python3 extraction/repoint_citations.py            # dry run: list citations whose needle left its range
    python3 extraction/repoint_citations.py --write    # move each such range to the needle's new first occurrence

A citation is {file, lines: "a-b", needle} (or a section `source` {file, lines, tag}). The range keeps its length;
only citations whose needle is no longer inside the range are touched. A needle that vanished from the file is
reported and left for a human/agent to re-derive (never silently dropped). Needs the sibling clone source.
"""
import json, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ROOT = REPO.parent


def fix(o, report, write):
    if isinstance(o, dict):
        key = "needle" if "needle" in o else ("tag" if "tag" in o else None)
        if key and isinstance(o.get("file"), str) and isinstance(o.get("lines"), str):
            f = REPO / o["file"][len("design-repo/"):] if o["file"].startswith("design-repo/") else ROOT / o["file"]
            if f.is_file():
                ls = f.read_text(errors="ignore").split("\n")
                a, b = (int(x) for x in o["lines"].split("-"))
                if not any(o[key] in l for l in ls[a - 1:b]):
                    hits = [i + 1 for i, l in enumerate(ls) if o[key] in l]
                    if not hits:
                        report.append(f"GONE   {o['file']}: '{o[key][:50]}' no longer exists")
                    else:
                        na = hits[0]; nb = min(len(ls), na + (b - a))
                        report.append(f"MOVED  {o['file']}:{o['lines']} -> {na}-{nb}")
                        if write:
                            o["lines"] = f"{na}-{nb}"
        for v in o.values():
            fix(v, report, write)
    elif isinstance(o, list):
        for v in o:
            fix(v, report, write)


def main():
    write = "--write" in sys.argv
    if not (ROOT / "src").is_dir():
        print("no sibling clone source; nothing to re-point"); return 0
    total = []
    for p in sorted(REPO.rglob("*.json")):
        d = json.loads(p.read_text())
        rep = []
        fix(d, rep, write)
        if rep:
            total += [f"{p.relative_to(REPO)}: {r}" for r in rep]
            if write:
                p.write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n")
    print("\n".join(total) or "all citations in place")
    return 1 if any("GONE" in t for t in total) else 0


if __name__ == "__main__":
    sys.exit(main())
