#!/usr/bin/env python3
"""Prove every verify_all.py check actually catches drift.

    python3 extraction/prove_drift.py

For each case: copy design-repo/ into a fresh OS temp dir (with the sibling clone source symlinked next to it
when present, so source-dependent checks run too), inject one defect, run verify_all.py there and require the
named check(s) to FAIL. A control copy with no injection must pass. Exit 1 if any case is not caught.
"""
import json, os, re, shutil, subprocess, sys, tempfile
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
ROOT = REPO.parent
SOURCE_DEPENDENT = {"CITATIONS", "SOURCE_IDENTITY"}  # WARN-only when the design-repo is used standalone
SIBLINGS = ["src", "public", "CLONE_SPEC.md", "CLONE_SPEC_PAGES.md", "SHADERS.md", "ia.json", "IA.md", "index.html", "package.json", "README.md"]


def J(p):
    return json.loads(p.read_text())


def W(p, d):
    p.write_text(json.dumps(d, indent=1, ensure_ascii=False) + "\n")


def edit(rel, fn):
    def m(r):
        p = r / rel; d = J(p); fn(d); W(p, d)
    return m


def text(rel, old, new):
    def m(r):
        p = r / rel; s = p.read_text()
        assert old in s, f"{rel}: '{old[:40]}' not found"
        p.write_text(s.replace(old, new, 1))
    return m


def first_cite(d):
    for e in d["evidence"]:
        return e


CASES = [
    ("phantom allowlist entry", edit("tokens/llm/component-allowlist.json", lambda d: d["sections"].__setitem__("cta.newsletter", {"variants": [], "styleOverrides": [], "motionPatterns": ["none"], "retrievalEligible": True, "generatedAssetRoles": []})), ["ALLOWLIST_PARITY"]),
    ("orphan contract (allowlist entry removed)", edit("tokens/llm/component-allowlist.json", lambda d: d["sections"].pop("hero.banner")), ["ALLOWLIST_PARITY"]),
    ("allowlist retrieval flag flipped alone", edit("tokens/llm/component-allowlist.json", lambda d: d["sections"]["shell.hint-panel"].__setitem__("retrievalEligible", True)), ["ALLOWLIST_PARITY", "RETRIEVAL_PINS"]),
    ("contract + allowlist flipped together (pin catches)", lambda r: (edit("sections/shell.transition-mask.json", lambda d: (d.__setitem__("retrievalEligible", True), d.pop("retrievalIneligibleReason")))(r),
                                                                      edit("tokens/llm/component-allowlist.json", lambda d: d["sections"]["shell.transition-mask"].__setitem__("retrievalEligible", True))(r)), ["RETRIEVAL_PINS"]),
    ("runtime-named section added unpinned", lambda r: (W(r / "sections/shell.cookie-banner.json", {**J(r / "sections/shell.grid-overlay.json"), "id": "shell.cookie-banner", "title": "Cookie banner", "semantic": {"id": "shell.cookie-banner", "category": "SHELL"}}),
                                                         edit("tokens/llm/component-allowlist.json", lambda d: d["sections"].__setitem__("shell.cookie-banner", dict(d["sections"]["shell.grid-overlay"])))(r)), ["RETRIEVAL_PINS"]),
    ("citation out of range", edit("sections/hero.banner.json", lambda d: d["evidence"][0].__setitem__("lines", "9000-9010")), ["CITATIONS"]),
    ("citation in range but wrong content", edit("sections/hero.banner.json", lambda d: d["source"].__setitem__("lines", "1-5")), ["CITATIONS"]),
    ("manifest count drift", edit("registry.manifest.json", lambda d: d["counts"].__setitem__("sections", 17)), ["MANIFEST_COUNTS"]),
    ("allowlistVersion drift", edit("registry.manifest.json", lambda d: d.__setitem__("allowlistVersion", "0.9.0")), ["VERSION_FIELDS"]),
    ("registry availability loosened", edit("assets/asset-roles.json", lambda d: d["roles"]["owner-portrait"].__setitem__("availability", "generation-safe")), ["ASSET_PINS"]),
    ("pin removed from semantic_validate", text("schema/semantic_validate.py", '"owner-portrait": "blocked-for-generation", ', ""), ["ASSET_PINS"]),
    ("pinned policy changed to another valid value", edit("assets/asset-roles.json", lambda d: d["roles"]["live-site-embed"].__setitem__("generationPolicy", "may-generate-new")), ["ASSET_PINS"]),
    ("token excerpt edited", text("extraction/excerpts/original-css-tokens.css", "--selection-bg:#c0fe04", "--selection-bg:#c0fe05"), ["EXCERPT_PINS"]),
    ("foundation colour edited", edit("tokens/00-foundation/color.json", lambda d: d["tokens"]["color.label-2"].__setitem__("light", "rgba(54,54,48,.7)")), ["TOKEN_CATALOG_DRIFT"]),
    ("catalog value edited", edit("tokens/llm/token-catalog.json", lambda d: d["tokens"]["text.primary"].__setitem__("light", "rgba(1,1,1,1)")), ["TOKEN_CATALOG_DRIFT", "POLICY_HASH"]),
    ("token policy edited", edit("tokens/llm/token-policy.json", lambda d: d["styleFields"]["text"]["allowedPrefixes"].append("surface.")), ["POLICY_HASH"]),
    ("policy category not a catalog key", edit("tokens/llm/token-policy.json", lambda d: d["styleFields"]["font"].__setitem__("category", "typography")), ["TOKEN_CATALOG_DRIFT"]),
    ("graph rule without validator code", edit("compatibility/graph.json", lambda d: d["rules"].append({"id": "ONE_FOOTER", "severity": "error", "rule": "x", "enforcedBy": "schema/semantic_validate.py"})), ["GRAPH_VALIDATOR_AGREEMENT"]),
    ("graph severity differs from validator", edit("compatibility/graph.json", lambda d: d["rules"][-1].__setitem__("severity", "warn")), ["GRAPH_VALIDATOR_AGREEMENT"]),
    ("schema hand-edited", edit("schema/pagespec.schema.json", lambda d: d["properties"]["theme"]["enum"].append("sepia")), ["SCHEMA_IN_SYNC"]),
    ("contract fallback edited", edit("sections/hero.banner.json", lambda d: d["motion"]["reducedMotionFallback"].__setitem__("scramble-in", "none")), ["MOTION_PATTERNS"]),
    ("wrapper whitelist stale", edit("extraction/measured-values.json", lambda d: [s.__setitem__("heightPx", 900) for s in d["sectionHeights"]["pages"]["/inspire_mono"]["sections"] if s["id"] == "article.image-grid"]), ["WRAPPER_GATE"]),
    ("wrapper whitelist entry removed", edit("extraction/wrapper-gate-whitelist.json", lambda d: d["entries"].clear()), ["WRAPPER_GATE"]),
    ("hero measured 3100px", edit("extraction/measured-values.json", lambda d: d["sectionHeights"]["pages"]["/"]["sections"][0].__setitem__("heightPx", 3100)), ["WRAPPER_GATE"]),
    ("gate threshold edited in JSON", edit("extraction/measured-values.json", lambda d: d["sectionHeights"]["thresholds"].__setitem__("heroFailPx", 9000)), ["WRAPPER_GATE"]),
    ("gate threshold edited in code", text("extraction/wrapper_gate.py", "SHARE_FAIL = 0.60", "SHARE_FAIL = 0.95"), ["WRAPPER_GATE"]),
    ("source-identity registry tampered", edit("policy/source-identity.json", lambda d: d["patterns"]["brand"].pop(0)), ["SOURCE_IDENTITY", "POLICY_HASH"]),
    ("parity exception self-approved", edit("extraction/measured-values.json", lambda d: d["parity"]["exceptions"].append({"route": "/", "viewport": "1440x900", "section": "hero.banner", "index": 0, "status": "approved", "approvedBy": "claude agent"})), ["PARITY_EVIDENCE"]),
    ("parity: gate outcome flips between runs", edit("extraction/parity/parity-results.json", lambda d: d["reproducibility"]["gateFlips"].append({"route": "/", "viewport": "1440x900", "id": "hero.banner", "run1": 0.85, "run2": 0.75})), ["PARITY_EVIDENCE"]),
    ("parity: run-to-run delta > 0.10", edit("extraction/parity/parity-results.json", lambda d: d["reproducibility"].__setitem__("maxRunDelta", 0.65)), ["PARITY_EVIDENCE"]),
    ("route mapped twice", edit("templates/routes.json", lambda d: d["routes"].append(dict(d["routes"][1], template="template.not-found"))), ["TEMPLATES_ROUTES"]),
    ("template node / contract disagree", edit("sections/intro.about.json", lambda d: d.__setitem__("templates", ["template.article"])), ["TEMPLATES_ROUTES"]),
    ("entry point outside package", edit("registry.manifest.json", lambda d: d["entryPoints"].__setitem__("ia", "../ia.json")), ["ENTRY_POINTS"]),
    ("absolute machine path in README", lambda r: (r / "README.md").write_text((r / "README.md").read_text() + "\nsee " + "/" + "Users" + "/someone/x\n"), ["HYGIENE"]),
    ("junk file in package", lambda r: (r / "sections/.DS_Store").write_bytes(b"\0"), ["HYGIENE"]),
    ("policy self-ratified", edit("policy/design-policy.json", lambda d: d["approval"].__setitem__("status", "approved")), ["POLICY_HASH"]),
    ("example made invalid", edit("schema/examples/generated.home.pagespec.json", lambda d: d["brand"].__setitem__("name", "HAOQI.DESIGN")), ["EXAMPLES_SEMANTIC"]),
    ("generated example missing for a family", lambda r: (r / "schema/examples/generated.not-found.pagespec.json").unlink(), ["EXAMPLES_SEMANTIC"]),
]


def run_copy(mutate, with_source=True):
    tmp = Path(tempfile.mkdtemp(prefix="drift-"))
    try:
        dst = tmp / "design-repo"
        shutil.copytree(REPO, dst, ignore=shutil.ignore_patterns("__pycache__", ".DS_Store"))
        if with_source:
            for s in SIBLINGS:
                if (ROOT / s).exists():
                    os.symlink(ROOT / s, tmp / s)
        if mutate:
            mutate(dst)
        r = subprocess.run([sys.executable, "-B", str(dst / "extraction/verify_all.py")], capture_output=True, text=True, timeout=600)
        fails = set(re.findall(r"^FAIL\s+(\S+)", r.stdout, re.M))
        return r.returncode, fails, r.stdout
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def main():
    ok = True
    rc, fails, out = run_copy(None)
    print(f"{'ok  ' if rc == 0 else 'MISS'} control (unmodified copy) exit={rc} fails={sorted(fails)}")
    ok &= rc == 0
    has_source = (ROOT / "src").is_dir()
    skipped = 0
    for name, mut, expect in CASES:
        # checks that need the sibling clone source only WARN standalone, so they cannot be proven there
        exp = [e for e in expect if has_source or e not in SOURCE_DEPENDENT]
        if not exp:
            skipped += 1
            print(f"skip {name:50} needs the sibling clone source ({expect})")
            continue
        rc, fails, out = run_copy(mut, with_source=has_source)
        hit = rc != 0 and set(exp) <= fails
        ok &= hit
        print(f"{'ok  ' if hit else 'MISS'} {name:50} expect {exp} -> FAIL {sorted(fails)}")
    print(f"\nprove_drift: {len(CASES) - skipped} injected defects run, {'all caught' if ok else 'SOME NOT CAUGHT'}" + (f", {skipped} skipped (need sibling source)" if skipped else "") + "; control passes")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
