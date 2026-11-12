#!/usr/bin/env python3
"""Score live-vs-clone captures per semantic section (R12).

    python3 extraction/parity/compare.py --captures <OUT_DIR>/<RUN_ID> [--captures <OUT_DIR>/<RUN_ID2>] \
        --out extraction/parity/parity-results.json

For each route x viewport, every section is scored on the viewport rows it occupies at each capture offset
(the crop is computed from the clone's measured geometry, identical for both sides):
  matchRatio = share of pixels whose max |RGB diff| <= 24 (the gate metric, >= 0.80 per section)
  similarity = 1 - mean|RGB diff| / 255 (diagnostic)
The section score is the mean over its offsets (min also recorded). With two runs, the per-section
difference between runs is reported and must be <= 0.01 (reproducibility check).
Requires Pillow + numpy. Writes geometry/score JSON only (no images, no copy text).
"""
import argparse, json, sys
from pathlib import Path

try:
    import numpy as np
    from PIL import Image
except ImportError:  # pragma: no cover
    sys.exit("compare.py needs Pillow and numpy (pip install pillow numpy)")

GATE = 0.80
TOL = 24
REPRO_TOL = 0.01


def load(p):
    return np.asarray(Image.open(p).convert("RGB"), dtype=np.int16)


def score_run(cap_dir):
    cap_dir = Path(cap_dir)
    man = json.loads((cap_dir / "capture-manifest.json").read_text())
    out = []
    for page in man["pages"]:
        vw, vh = (int(x) for x in page["viewport"].split("x"))
        shots = {s: {x["offset"]: x for x in page["shots"][s]} for s in ("clone", "live")}
        diffs = {}
        for off in page["offsets"]:
            a, b = load(cap_dir / shots["clone"][off]["file"]), load(cap_dir / shots["live"][off]["file"])
            h = min(a.shape[0], b.shape[0]); w = min(a.shape[1], b.shape[1])
            d = np.abs(a[:h, :w] - b[:h, :w]).max(axis=2)
            diffs[off] = (d, shots["clone"][off]["actualScrollTop"], shots["live"][off]["actualScrollTop"])
        secs = []
        for i, s in enumerate(page["geometry"]["sections"]):
            per = []
            for off, (d, ac, al) in diffs.items():
                top = int(round(s["top"] - ac)); bot = int(round(s["top"] + s["height"] - ac))
                y0, y1 = max(0, top), min(d.shape[0], bot)
                if y1 - y0 < 40:  # section not meaningfully in this viewport
                    continue
                crop = d[y0:y1]
                per.append({"offset": off, "rows": [y0, y1], "matchRatio": round(float((crop <= TOL).mean()), 4),
                            "similarity": round(float(1 - crop.mean() / 255), 4), "scrollDelta": al - ac})
            if not per:
                continue
            mr = [p["matchRatio"] for p in per]
            secs.append({"index": i, "id": s["id"], "variant": s.get("variant"), "headingLevel": s.get("headingLevel"),
                         "top": s["top"], "height": s["height"],
                         "matchRatio": round(sum(mr) / len(mr), 4), "minMatchRatio": round(min(mr), 4),
                         "similarity": round(sum(p["similarity"] for p in per) / len(per), 4),
                         "offsets": per, "passesGate": (sum(mr) / len(mr)) >= GATE})
        live_h = page.get("liveGeometry", {}).get("pageHeight")
        out.append({"route": page["route"], "viewport": page["viewport"], "clonePageHeight": page["geometry"]["pageHeight"],
                    "livePageHeight": live_h, "sections": secs,
                    "pageMeanMatchRatio": round(sum(x["matchRatio"] for x in secs) / max(1, len(secs)), 4)})
    return man, out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--captures", action="append", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    runs = [score_run(c) for c in a.captures]
    base_man, base = runs[0]
    repro = []
    if len(runs) > 1:
        other = {(p["route"], p["viewport"], s["index"]): s["matchRatio"] for p in runs[1][1] for s in p["sections"]}
        for p in base:
            for s in p["sections"]:
                k = (p["route"], p["viewport"], s["index"])
                if k in other:
                    s["matchRatioRun2"] = other[k]
                    repro.append(abs(other[k] - s["matchRatio"]))
    allsec = [s for p in base for s in p["sections"]]
    below = [{"route": p["route"], "viewport": p["viewport"], "id": s["id"], "variant": s.get("variant"), "index": s["index"],
              "matchRatio": s["matchRatio"]} for p in base for s in p["sections"] if not s["passesGate"]]
    res = {
        "tool": "extraction/parity/compare.py",
        "metric": {"gate": GATE, "pixelTolerance": TOL, "definition": "share of pixels with max |RGB diff| <= 24 over the rows a section occupies"},
        "captureState": {k: base_man[k] for k in ("fixedTime", "seed", "live", "clone")},
        "runs": [m["run"] for m, _ in runs],
        "capturedAt": [m["capturedAt"] for m, _ in runs],
        "reproducibility": {"status": ("single-run — second run pending" if len(runs) == 1 else
                                       ("reproducible: two runs agree within tolerance" if max(repro) <= REPRO_TOL else "NOT reproducible: runs disagree")),
                            "maxRunDelta": round(max(repro), 4) if repro else None, "tolerance": REPRO_TOL,
                            "ok": (max(repro) <= REPRO_TOL) if repro else None, "comparedSections": len(repro)},
        "summary": {"sections": len(allsec), "meanMatchRatio": round(sum(s["matchRatio"] for s in allsec) / max(1, len(allsec)), 4),
                    "belowGate": below},
        "pages": base,
    }
    Path(a.out).write_text(json.dumps(res, indent=1, ensure_ascii=False) + "\n")
    print(f"sections={len(allsec)} mean={res['summary']['meanMatchRatio']} belowGate={len(below)} repro={res['reproducibility']}")


if __name__ == "__main__":
    main()
