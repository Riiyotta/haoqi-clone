#!/usr/bin/env python3
"""R9 whole-page-wrapper quality gate over MEASURED section heights.

    python3 extraction/wrapper_gate.py        # prints findings, exit 1 on any error

Input: extraction/measured-values.json -> sectionHeights (recorded by extraction/measure_sections.mjs at 1440x900)
and extraction/wrapper-gate-whitelist.json. Thresholds are pinned HERE in code; the JSON copies must match them.
  HERO > 1800 px warn, > 3000 px error unless whitelisted.
  one in-flow section > 50 % of its page warn, > 60 % error unless whitelisted
  (pages with < 3 in-flow sections are skipped; fixed/overlay/backdrop sections take no page height and are excluded).
  Missing measurement for a mapped route/in-flow section: error. Wrong viewport: error.
  Whitelist entries need reviewedBy, a justification >= 30 chars and maxHeightPx / maxShare above the measured value;
  over-cap and stale (no longer exceeding a threshold) entries fail; a whitelisted hit still warns.
  An agent reviewer must be labelled "agent attestation, not a human sign-off".
"""
import json, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
HERO_WARN_PX = 1800
HERO_FAIL_PX = 3000
SHARE_WARN = 0.50
SHARE_FAIL = 0.60
MIN_SECTIONS = 3
REQUIRED_VIEWPORT = "1440x900"
AGENT_LABEL = "agent attestation, not a human sign-off"


def evaluate(mv, whitelist, sections, routes):
    errors, warnings = [], []
    sh = mv.get("sectionHeights") or {}
    th = sh.get("thresholds", {})
    pinned = {"heroWarnPx": HERO_WARN_PX, "heroFailPx": HERO_FAIL_PX, "shareWarn": SHARE_WARN, "shareFail": SHARE_FAIL, "minSections": MIN_SECTIONS}
    for k, v in pinned.items():
        if th.get(k) != v:
            errors.append(f"THRESHOLD_DRIFT: sectionHeights.thresholds.{k}={th.get(k)} but the code pins {v}")
    if sh.get("viewport") != REQUIRED_VIEWPORT:
        errors.append(f"WRONG_VIEWPORT: sectionHeights measured at {sh.get('viewport')}, gate requires {REQUIRED_VIEWPORT}")
    pages = sh.get("pages", {})
    wl = {(e.get("route"), e.get("section"), e.get("variant")): e for e in whitelist.get("entries", [])}
    used = set()
    for e in whitelist.get("entries", []):
        rb = str(e.get("reviewedBy") or "")
        if not rb:
            errors.append(f"WHITELIST_NO_REVIEWER: {e.get('route')} {e.get('section')}")
        if any(x in rb.lower() for x in ("agent", "claude", "assistant", "automated")) and AGENT_LABEL not in rb:
            errors.append(f"WHITELIST_AGENT_UNLABELLED: reviewedBy '{rb}' must say '{AGENT_LABEL}'")
        if len(str(e.get("justification") or "")) < 30:
            errors.append(f"WHITELIST_NO_JUSTIFICATION: {e.get('route')} {e.get('section')} needs a justification >= 30 chars")
    for r in routes:
        route = r["route"]
        probe = "/__not_found_probe__" if route == "/*" else route
        page = pages.get(probe)
        want = [x.split(":")[0] for x in r["composition"] if sections[x.split(":")[0]]["layer"] == "in-flow"]
        if page is None:
            errors.append(f"MISSING_MEASUREMENT: route {route} has no sectionHeights entry")
            continue
        got = [s["id"] for s in page["sections"]]
        if got != want:
            errors.append(f"MISSING_MEASUREMENT: {route} measured {got} but its composition has in-flow {want}")
        ph = page["pageHeight"]
        n = len(page["sections"])
        for s in page["sections"]:
            sid, var, h = s["id"], s.get("variant"), s["heightPx"]
            key = (probe, sid, var)
            e = wl.get(key) or wl.get((route, sid, var))
            cat = sections[sid]["category"]
            share = h / ph if ph else 0
            hit_err = (cat == "HERO" and h > HERO_FAIL_PX) or (n >= MIN_SECTIONS and share > SHARE_FAIL)
            hit_warn = (cat == "HERO" and h > HERO_WARN_PX) or (n >= MIN_SECTIONS and share > SHARE_WARN)
            label = f"{route} {sid}{':' + var if var else ''} {h:.0f}px ({share:.1%} of {ph:.0f}px)"
            if e is not None:
                used.add((e.get("route"), e.get("section"), e.get("variant")))
                if not hit_err:
                    errors.append(f"WHITELIST_STALE: {label} no longer exceeds an error threshold; remove the entry")
                if h > e.get("maxHeightPx", 0) or share > e.get("maxShare", 0):
                    errors.append(f"WHITELIST_OVER_CAP: {label} exceeds maxHeightPx {e.get('maxHeightPx')} / maxShare {e.get('maxShare')}")
                if hit_warn:
                    warnings.append(f"WHITELISTED: {label} (reviewedBy: {e.get('reviewedBy')})")
                continue
            if hit_err:
                errors.append(f"WRAPPER_GATE: {label} exceeds {'HERO ' + str(HERO_FAIL_PX) + 'px' if cat == 'HERO' and h > HERO_FAIL_PX else f'{SHARE_FAIL:.0%} page share'}")
            elif hit_warn:
                warnings.append(f"WRAPPER_GATE_WARN: {label}")
    for k in wl:
        if k not in used:
            errors.append(f"WHITELIST_STALE: entry {k} matches no measured section")
    return errors, warnings


def run():
    mv = json.loads((REPO / "extraction/measured-values.json").read_text())
    wl = json.loads((REPO / "extraction/wrapper-gate-whitelist.json").read_text())
    sections = {p.stem: json.loads(p.read_text()) for p in (REPO / "sections").glob("*.json")}
    routes = json.loads((REPO / "templates/routes.json").read_text())["routes"]
    return evaluate(mv, wl, sections, routes)


if __name__ == "__main__":
    e, w = run()
    for x in w:
        print("WARN ", x)
    for x in e:
        print("ERROR", x)
    print(f"wrapper gate: {len(e)} error(s), {len(w)} warning(s)")
    sys.exit(1 if e else 0)
