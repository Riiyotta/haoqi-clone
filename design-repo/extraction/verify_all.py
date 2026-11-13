#!/usr/bin/env python3
"""Verify the whole design-repo. Run from anywhere:  python3 extraction/verify_all.py

Self-contained: the repo root is derived from this file. Checks that need the sibling clone source
(citation ranges into src/ and CLONE_SPEC*.md, source-identity re-derivation, ia.json reconciliation, git tracking)
WARN instead of failing when the design-repo is used standalone (zip / copied alone).
Drift-proven by extraction/prove_drift.py (every check below has at least one injected-failure case).
Exit 1 on any FAIL.
"""
import hashlib, json, re, subprocess, sys
from pathlib import Path

sys.dont_write_bytecode = True  # importing the validator must not leave __pycache__ in the package

REPO = Path(__file__).resolve().parent.parent
ROOT = REPO.parent
HAS_SOURCE = (ROOT / "src").is_dir() and (ROOT / "CLONE_SPEC.md").is_file()
sys.path.insert(0, str(REPO / "schema")); sys.path.insert(0, str(REPO / "extraction"))
import semantic_validate as SV  # noqa: E402
import wrapper_gate  # noqa: E402
import policy_hash  # noqa: E402

# ---- pins duplicated on purpose: editing a registry (or the validator) alone cannot loosen them
PINNED_AVAILABILITY = {
    "project-thumbnail": "reference-only", "project-hover-thumbnail": "reference-only", "article-figure": "reference-only", "article-slide": "reference-only",
    "source-wordmark": "blocked-for-generation", "owner-portrait": "blocked-for-generation", "owner-signature": "blocked-for-generation",
    "glass-3d-model": "blocked-for-generation", "sticker-set": "blocked-for-generation", "live-site-embed": "blocked-for-generation",
    "downloadable-archive": "blocked-for-generation", "background-music": "blocked-for-generation",
    "placeholder-brand-mark": "generation-safe", "user-supplied-brand-mark": "generation-safe", "fictional-portrait": "generation-safe",
    "user-supplied-portrait": "generation-safe", "generated-signature-mark": "generation-safe", "generated-project-visual": "generation-safe",
    "generated-article-figure": "generation-safe", "generated-3d-model": "generation-safe", "generated-sticker": "generation-safe",
    "placeholder-embed": "generation-safe", "placeholder-download": "generation-safe", "user-supplied-audio": "generation-safe", "ui-glyph": "generation-safe",
}
PINNED_GENERATION_POLICY = {"owner-portrait": "must-not-fabricate-likeness", "live-site-embed": "must-not-embed-live-third-party",
                            "source-wordmark": "must-not-reuse-or-imitate", "owner-signature": "must-not-reuse-or-imitate"}
RETRIEVAL_INELIGIBLE = {"shell.status-row", "shell.scroll-progress", "shell.transition-mask", "shell.mobile-menu", "shell.hint-panel",
                        "effect.pointer-trail", "overlay.image-lightbox"}
RUNTIME_NAME = re.compile(r"cursor|pointer|trail|loader|preload|mask|transition|modal|dialog|drawer|overlay|lightbox|menu|toast|tooltip|hint|cookie|consent|progress|status|ticker", re.I)
# machine-path detector, assembled from pieces so this file does not match itself
ABS_PATH = re.compile("|".join(["/" + "Users" + "/", "/" + "home" + "/[a-z]", "C:" + r"\\" + "Users", "/" + "private/(tmp|var)"]))
RUNTIME_NAME_EXEMPT = {"shell.grid-overlay": "decorative fixed column grid drawn over the page; part of the visual system, not runtime UI"}

results = []


def rec(name, status, detail=""):
    results.append((name, status, detail))


def load(rel):
    return json.loads((REPO / rel).read_text())


def check(name):
    def deco(fn):
        try:
            fn()
        except Exception as e:  # a crashing check is a failing check
            rec(name, "FAIL", f"exception: {type(e).__name__}: {e}")
        return fn
    return deco


ALL_JSON = sorted(p for p in REPO.rglob("*.json") if ".git" not in p.parts)
DATA = {}


@check("JSON_PARSE")
def _():
    bad = []
    for p in ALL_JSON:
        try:
            DATA[str(p.relative_to(REPO))] = json.loads(p.read_text())
        except Exception as e:
            bad.append(f"{p.relative_to(REPO)}: {e}")
    rec("JSON_PARSE", "FAIL" if bad else "PASS", f"{len(ALL_JSON)} files" + (f"; {bad[:3]}" if bad else ""))


SECTIONS = {p.stem: json.loads(p.read_text()) for p in sorted((REPO / "sections").glob("*.json"))}
TEMPLATES = load("templates/templates.json")["templates"]
ROUTES = load("templates/routes.json")["routes"]
ROLES = load("assets/asset-roles.json")["roles"]
MAN = load("registry.manifest.json")
ALLOW = load("tokens/llm/component-allowlist.json")
EXAMPLES = sorted((REPO / "schema/examples").glob("*.json")) + [REPO / "schema/example.pagespec.json"]


@check("SCHEMA_DRAFT07")
def _():
    from jsonschema import Draft7Validator
    errs = []
    for rel in ("schema/pagespec.schema.json", "schema/section-contract.schema.json"):
        Draft7Validator.check_schema(load(rel))
    ps = Draft7Validator(load("schema/pagespec.schema.json"))
    for p in EXAMPLES:
        errs += [f"{p.name}: {e.message[:120]}" for e in ps.iter_errors(json.loads(p.read_text()))]
    cs = Draft7Validator(load("schema/section-contract.schema.json"))
    for sid, c in SECTIONS.items():
        errs += [f"{sid}: {e.message[:120]}" for e in cs.iter_errors(c)]
    rec("SCHEMA_DRAFT07", "FAIL" if errs else "PASS", f"{len(EXAMPLES)} examples + {len(SECTIONS)} contracts, {len(errs)} errors" + (f": {errs[:3]}" if errs else ""))


@check("SCHEMA_IN_SYNC")
def _():
    r = subprocess.run([sys.executable, str(REPO / "schema/build_schema.py"), "--check"], capture_output=True, text=True)
    rec("SCHEMA_IN_SYNC", "PASS" if r.returncode == 0 else "FAIL", r.stdout.strip())


@check("EXAMPLES_SEMANTIC")
def _():
    bad, modes = [], {}
    for p in EXAMPLES:
        spec = json.loads(p.read_text())
        e, w = SV.validate(spec)
        if e:
            bad.append(f"{p.name}: {[x['rule'] for x in e][:4]}")
        modes.setdefault(spec["template"], set()).add(spec["mode"])
    missing = [t for t in TEMPLATES if "generated" not in modes.get(t, set())]
    rec("EXAMPLES_SEMANTIC", "FAIL" if bad or missing else "PASS",
        f"{len(EXAMPLES)} examples pass; generated example per template family: {'all' if not missing else 'MISSING ' + str(missing)}" + (f"; {bad}" if bad else ""))


@check("ALLOWLIST_PARITY")
def _():
    probs = []
    if set(ALLOW["sections"]) != set(SECTIONS):
        probs.append(f"sections phantom={sorted(set(ALLOW['sections']) - set(SECTIONS))} orphan={sorted(set(SECTIONS) - set(ALLOW['sections']))}")
    for kind in ("primitives", "components"):
        files = {p.stem for p in (REPO / kind).glob("*.json")}
        if set(ALLOW[kind]) != files:
            probs.append(f"{kind} phantom={sorted(set(ALLOW[kind]) - files)} orphan={sorted(files - set(ALLOW[kind]))}")
    for sid, a in ALLOW["sections"].items():
        c = SECTIONS.get(sid)
        if not c:
            continue
        want = {"variants": c["variants"], "styleOverrides": c["styleOverrides"], "motionPatterns": c["motion"]["allowedPatterns"],
                "retrievalEligible": c["retrievalEligible"], "generatedAssetRoles": c["assets"]["generatedAssetRoles"]}
        for k, v in want.items():
            if a.get(k) != v:
                probs.append(f"{sid}.{k}: allowlist {a.get(k)} != contract {v}")
    sch = load("schema/pagespec.schema.json")["definitions"]
    props = set()
    for k, d in sch.items():
        if k.startswith("node_"):
            props |= set(d["properties"])
    if set(ALLOW["nodeProperties"]) != props:
        probs.append(f"nodeProperties {sorted(ALLOW['nodeProperties'])} != schema node properties {sorted(props)}")
    rec("ALLOWLIST_PARITY", "FAIL" if probs else "PASS", f"{len(SECTIONS)} sections, {len(ALLOW['primitives'])} primitives, {len(ALLOW['components'])} components" + (f"; {probs[:4]}" if probs else ""))


@check("VERSION_FIELDS")
def _():
    probs = []
    if MAN.get("allowlistVersion") != ALLOW.get("allowlistVersion"):
        probs.append(f"manifest allowlistVersion {MAN.get('allowlistVersion')} != allowlist {ALLOW.get('allowlistVersion')}")
    if not MAN.get("versionFieldNote"):
        probs.append("manifest lacks versionFieldNote")
    if MAN.get("pageSpecVersion") != load("schema/pagespec.schema.json")["properties"]["pageSpecVersion"]["const"]:
        probs.append("manifest pageSpecVersion != schema const")
    rec("VERSION_FIELDS", "FAIL" if probs else "PASS", "allowlistVersion + pageSpecVersion machine-checked" + (f"; {probs}" if probs else ""))


def iter_cites(o, where):
    if isinstance(o, dict):
        if {"file", "lines", "needle"} <= set(o) and isinstance(o["file"], str):
            yield where, o["file"], o["lines"], o["needle"]
        elif {"file", "lines", "tag"} <= set(o) and isinstance(o["file"], str):
            yield where, o["file"], o["lines"], o["tag"]
        for k, v in o.items():
            yield from iter_cites(v, where)
    elif isinstance(o, list):
        for v in o:
            yield from iter_cites(v, where)


def git_tracked():
    try:
        r = subprocess.run(["git", "-C", str(ROOT), "ls-files"], capture_output=True, text=True, timeout=30)
        top = subprocess.run(["git", "-C", str(ROOT), "rev-parse", "--show-toplevel"], capture_output=True, text=True, timeout=30)
        if r.returncode or top.returncode or Path(top.stdout.strip()).resolve() != ROOT.resolve():
            return None
        return set(r.stdout.splitlines())
    except Exception:
        return None


@check("CITATIONS")
def _():
    bad, ext_skipped, n = [], 0, 0
    tracked = git_tracked() if HAS_SOURCE else None
    for rel, d in DATA.items():
        for where, f, lines, needle in iter_cites(d, rel):
            n += 1
            if f.startswith("design-repo/"):
                path = REPO / f[len("design-repo/"):]
            else:
                if not HAS_SOURCE:
                    ext_skipped += 1
                    continue
                path = ROOT / f
                if tracked is not None and f not in tracked:
                    bad.append(f"{where}: {f} is not tracked in git (citations must point at tracked files)")
                    continue
            if not path.is_file():
                bad.append(f"{where}: missing file {f}")
                continue
            a, b = (int(x) for x in lines.split("-"))
            ls = path.read_text(errors="ignore").split("\n")
            if a < 1 or b < a or b > len(ls):
                bad.append(f"{where}: {f}:{lines} out of range (file has {len(ls)} lines)")
            elif not any(needle in l for l in ls[a - 1:b]):
                bad.append(f"{where}: {f}:{lines} does not contain '{needle[:50]}'")
    st = "FAIL" if bad else ("WARN" if ext_skipped else "PASS")
    rec("CITATIONS", st, f"{n} citations, {n - ext_skipped} resolved" + (f", {ext_skipped} external skipped (no sibling source tree)" if ext_skipped else "") + (f"; {bad[:4]}" if bad else ""))


def excerpt_vars():
    txt = (REPO / "extraction/excerpts/original-css-tokens.css").read_text()
    blocks, cur = {}, None
    for line in txt.split("\n"):
        m = re.match(r"/\* (\S+) @ \d+ \*/", line)
        if m:
            cur = m.group(1); continue
        if cur and line and not line.startswith("/*"):
            body = line[line.index("{") + 1:line.rindex("}")]
            blocks[cur] = {k.strip(): v.strip() for k, v in (x.split(":", 1) for x in body.split(";") if x.startswith("--") and ":" in x)}
            blocks[cur + "#raw"] = line
            cur = None
    return blocks, txt


@check("EXCERPT_PINS")
def _():
    mv = load("extraction/measured-values.json")
    bad = []
    blocks, txt = excerpt_vars()
    for rel, meta in mv["excerpts"].items():
        if hashlib.sha256((REPO / rel).read_bytes()).hexdigest() != meta["sha256"]:
            bad.append(f"{rel}: sha256 differs from pin")
        if HAS_SOURCE:
            srcf = (ROOT / meta["sourceFile"]).read_text()
            for b in meta["blocks"]:
                raw = blocks.get(b["block"] + "#raw", "")
                if srcf[b["byteOffset"]:b["byteOffset"] + b["length"]] != raw:
                    bad.append(f"{rel}: block {b['block']} no longer matches {meta['sourceFile']} at {b['byteOffset']}")
    # every excerpt reference names a var that exists in that block
    n = 0
    def walk(o):
        nonlocal n
        if isinstance(o, dict):
            if "excerpt" in o and "var" in o:
                n += 1
                if o["var"] not in blocks.get(o["block"], {}):
                    bad.append(f"excerpt ref {o['block']}:{o['var']} not found")
            for v in o.values():
                walk(v)
        elif isinstance(o, list):
            for v in o:
                walk(v)
    for d in DATA.values():
        walk(d)
    rec("EXCERPT_PINS", "FAIL" if bad else "PASS", f"sha256 pin ok, {n} excerpt refs resolve" + ("" if HAS_SOURCE else " (source re-match skipped: standalone)") + (f"; {bad[:3]}" if bad else ""))


def css_resolve(val, vars_):
    for _ in range(4):
        val = re.sub(r"var\((--[\w-]+)\)", lambda m: vars_.get(m.group(1), m.group(0)), val)
    return val


@check("TOKEN_CATALOG_DRIFT")
def _():
    blocks, _ = excerpt_vars()
    color = load("tokens/00-foundation/color.json")["tokens"]
    cat = load("tokens/llm/token-catalog.json")
    probs = []
    for tid, t in color.items():
        var = t.get("cssVar")
        if not var:
            continue
        for th in ("light", "dark"):
            vs = dict(blocks["theme"]); vs.update(blocks["light"])
            if th == "dark":
                vs.update(blocks["dark"])
            raw = vs.get(var)
            if raw is None and var == "--background-1":
                raw = vs.get("--background-1")
            if raw is None:
                probs.append(f"{tid}: {var} absent from excerpt"); continue
            want = css_resolve(raw, vs)
            if want != t[th]:
                probs.append(f"{tid}.{th}: {t[th]} != excerpt {want}")
    for tid, t in color.items():
        c = cat["tokens"].get(tid)
        if c and (c.get("light"), c.get("dark")) != (t["light"], t["dark"]):
            probs.append(f"catalog {tid} != color.json")
    typ = load("tokens/00-foundation/typography.json")
    for tid, t in typ["fontSize"].items():
        if blocks["theme"].get("--text-" + tid.split(".", 1)[1]) != t["value"] or cat["tokens"][tid]["value"] != t["value"]:
            probs.append(f"{tid} drift")
    for th in ("light", "dark"):
        res = load(f"tokens/themes/{th}.json")["resolved"]
        for k, v in res.items():
            if cat["tokens"].get(k, {}).get(th) != v:
                probs.append(f"themes/{th}.{k} != catalog")
    if cat["count"] != len(cat["tokens"]):
        probs.append("catalog count field drift")
    pol = load("tokens/llm/token-policy.json")
    real_cats = {t["category"] for t in cat["tokens"].values()}
    for f, s in pol["styleFields"].items():
        if s["category"] not in real_cats:
            probs.append(f"policy styleFields.{f}.category '{s['category']}' not a catalog category")
        for t in s.get("allowedTokens", []):
            if t not in cat["tokens"]:
                probs.append(f"policy allows unknown token {t}")
    if sorted(pol["catalogCategories"]) != sorted(real_cats):
        probs.append("policy catalogCategories != catalog categories")
    # every token referenced from semantic / component layers exists
    for sid, ref in load("tokens/10-semantic/semantic.json")["tokens"].items():
        if "ref" in ref and ref["ref"] not in cat["tokens"]:
            probs.append(f"semantic {sid} -> unknown {ref['ref']}")
    rec("TOKEN_CATALOG_DRIFT", "FAIL" if probs else "PASS", f"{cat['count']} catalog tokens re-derived against the pinned excerpt" + (f"; {probs[:4]}" if probs else ""))


@check("MANIFEST_COUNTS")
def _():
    want = {"sections": len(SECTIONS), "primitives": len(list((REPO / "primitives").glob("*.json"))), "components": len(list((REPO / "components").glob("*.json"))),
            "templates": len(TEMPLATES), "routes": len(ROUTES), "tokens": load("tokens/llm/token-catalog.json")["count"], "assetRoles": len(ROLES),
            "examplePageSpecs": len(list((REPO / "schema/examples").glob("*.json"))), "motionPatterns": len(load("tokens/00-foundation/motion-patterns.json")["patterns"]),
            "graphRules": len(load("compatibility/graph.json")["rules"]), "retrievalIneligibleSections": sum(1 for c in SECTIONS.values() if not c["retrievalEligible"])}
    got = MAN.get("counts", {})
    diff = {k: (got.get(k), v) for k, v in want.items() if got.get(k) != v}
    rec("MANIFEST_COUNTS", "FAIL" if diff else "PASS", f"{want}" if not diff else f"manifest vs disk: {diff}")


@check("ENTRY_POINTS")
def _():
    ep = MAN.get("entryPoints", {})
    vals = list(ep.values()) if isinstance(ep, dict) else ep
    bad = [v for v in vals if v.startswith("..") or v.startswith("/") or not (REPO / v).exists()]
    need = ["tokens/llm/token-catalog.json", "tokens/llm/token-policy.json", "tokens/llm/component-allowlist.json", "tokens/00-foundation/motion-patterns.json"]
    miss = [n for n in need if n not in vals]
    rec("ENTRY_POINTS", "FAIL" if bad or miss else "PASS", f"{len(vals)} entry points inside the package" + (f"; bad={bad} missing={miss}" if bad or miss else ""))


@check("TEMPLATES_ROUTES")
def _():
    probs = []
    seen = {}
    for r in ROUTES:
        if r["route"] in seen:
            probs.append(f"route {r['route']} mapped twice")
        seen[r["route"]] = r["template"]
        if r["template"] not in TEMPLATES:
            probs.append(f"{r['route']} -> unknown template")
    for tid, t in TEMPLATES.items():
        if sorted(t["routes"]) != sorted(k for k, v in seen.items() if v == tid):
            probs.append(f"{tid}.routes {t['routes']} != routes.json")
        for nd in t["nodes"]:
            c = SECTIONS.get(nd["section"])
            if not c:
                probs.append(f"{tid} uses unknown section {nd['section']}")
            elif tid not in c["templates"]:
                probs.append(f"{nd['section']}.templates lacks {tid}")
            elif nd.get("variant") and nd["variant"] not in c["variants"]:
                probs.append(f"{tid}: unknown variant {nd['variant']}")
    for sid, c in SECTIONS.items():
        for tid in c["templates"]:
            if sid not in [n["section"] for n in TEMPLATES[tid]["nodes"]]:
                probs.append(f"{sid} claims {tid} but is not in its nodes")
    if HAS_SOURCE and (ROOT / "ia.json").is_file():
        ia = json.loads((ROOT / "ia.json").read_text())
        ia_routes = {r for t in ia["templates"] for r in t["routes"]}
        ia_routes = {("/*" if r.startswith("/<") else r) for r in ia_routes}
        if ia_routes != set(seen):
            probs.append(f"ia.json routes {sorted(ia_routes)} != routes.json {sorted(seen)}")
    rec("TEMPLATES_ROUTES", "FAIL" if probs else "PASS", f"{len(ROUTES)} routes -> {len(TEMPLATES)} templates, 1:1" + ("" if HAS_SOURCE else " (ia.json reconciliation skipped: standalone)") + (f"; {probs[:4]}" if probs else ""))


@check("GRAPH_VALIDATOR_AGREEMENT")
def _():
    g = {r["id"]: r["severity"] for r in load("compatibility/graph.json")["rules"]}
    probs = [f"{k}: graph={g.get(k)} validator={SV.RULES.get(k)}" for k in set(g) | set(SV.RULES) if g.get(k) != SV.RULES.get(k)]
    src = (REPO / "schema/semantic_validate.py").read_text()
    probs += [f"{k} never raised in validator" for k in SV.RULES if src.count(f'"{k}"') < 2]
    rec("GRAPH_VALIDATOR_AGREEMENT", "FAIL" if probs else "PASS", f"{len(g)} rules agree" + (f"; {probs[:4]}" if probs else ""))


@check("ASSET_PINS")
def _():
    probs = []
    if PINNED_AVAILABILITY != SV.PINNED_AVAILABILITY:
        probs.append("verify_all and semantic_validate pins differ")
    if PINNED_GENERATION_POLICY != SV.PINNED_GENERATION_POLICY:
        probs.append("generation-policy pins differ between verify_all and semantic_validate")
    if set(ROLES) != set(PINNED_AVAILABILITY):
        probs.append(f"roles not pinned: {sorted(set(ROLES) ^ set(PINNED_AVAILABILITY))}")
    for r, e in ROLES.items():
        if e["availability"] != PINNED_AVAILABILITY.get(r):
            probs.append(f"{r}: registry {e['availability']} != pin {PINNED_AVAILABILITY.get(r)}")
        if r in PINNED_GENERATION_POLICY and e["generationPolicy"] != PINNED_GENERATION_POLICY[r]:
            probs.append(f"{r}: generationPolicy {e['generationPolicy']} != pinned {PINNED_GENERATION_POLICY[r]}")
        if e["availability"] != "generation-safe":
            subs = e.get("generationSafeSubstitutes") or []
            if not subs or any(PINNED_AVAILABILITY.get(s) != "generation-safe" for s in subs):
                probs.append(f"{r}: substitutes must be generation-safe roles")
    for sid, c in SECTIONS.items():
        for r in c["assets"]["generatedAssetRoles"]:
            if PINNED_AVAILABILITY.get(r) != "generation-safe":
                probs.append(f"{sid}: generatedAssetRoles contains {r}")
        for r in c["assets"]["referenceAssetRoles"]:
            if r not in ROLES:
                probs.append(f"{sid}: unknown role {r}")
    rec("ASSET_PINS", "FAIL" if probs else "PASS", f"{len(ROLES)} roles pinned (availability + 4 pinned generation policies)" + (f"; {probs[:4]}" if probs else ""))


@check("RETRIEVAL_PINS")
def _():
    probs = []
    if RETRIEVAL_INELIGIBLE != SV.RETRIEVAL_INELIGIBLE:
        probs.append("verify_all and semantic_validate retrieval pins differ")
    for sid, c in SECTIONS.items():
        pinned = sid in RETRIEVAL_INELIGIBLE
        if c["retrievalEligible"] == pinned:
            probs.append(f"{sid}: retrievalEligible={c['retrievalEligible']} contradicts pin")
        if not c["retrievalEligible"] and len(c.get("retrievalIneligibleReason", "")) < 30:
            probs.append(f"{sid}: reason < 30 chars")
        if (RUNTIME_NAME.search(sid) or RUNTIME_NAME.search(c["title"])) and not pinned and sid not in RUNTIME_NAME_EXEMPT:
            probs.append(f"{sid} looks like runtime UI but is not pinned ineligible")
        if ALLOW["sections"].get(sid, {}).get("retrievalEligible") != (not pinned):
            probs.append(f"allowlist {sid}.retrievalEligible contradicts pin")
    rec("RETRIEVAL_PINS", "FAIL" if probs else "PASS", f"{len(RETRIEVAL_INELIGIBLE)} runtime/utility sections pinned ineligible" + (f"; {probs[:4]}" if probs else ""))


@check("MOTION_PATTERNS")
def _():
    pats = load("tokens/00-foundation/motion-patterns.json")["patterns"]
    probs = []
    for sid, c in SECTIONS.items():
        for m in c["motion"]["allowedPatterns"]:
            if m not in pats:
                probs.append(f"{sid}: unknown pattern {m}")
            elif c["motion"]["reducedMotionFallback"].get(m) != pats[m]["reducedMotionFallback"]:
                probs.append(f"{sid}: fallback for {m} differs from motion-patterns.json")
    rec("MOTION_PATTERNS", "FAIL" if probs else "PASS", f"{len(pats)} patterns, every section fallback const-locked" + (f"; {probs[:3]}" if probs else ""))


@check("WRAPPER_GATE")
def _():
    e, w = wrapper_gate.run()
    rec("WRAPPER_GATE", "FAIL" if e else ("WARN" if w else "PASS"), f"{len(e)} errors, {len(w)} warnings" + (f"; {e[:3]}" if e else f"; {w[:2]}" if w else ""))


@check("POLICY_HASH")
def _():
    v = policy_hash.compute()
    dp = load("policy/design-policy.json")
    probs = []
    if MAN.get("designPolicy", {}).get("contentHash") != v:
        probs.append("manifest designPolicy.contentHash drift")
    if dp.get("contentHash") != v:
        probs.append("policy/design-policy.json contentHash drift")
    if dp.get("enforcedBy") != policy_hash.ENFORCED_BY:
        probs.append("enforcedBy list != policy_hash.ENFORCED_BY")
    if dp["approval"]["status"] != "defined-pending-architecture-review" and not dp["approval"].get("decidedBy"):
        probs.append("approval changed without a recorded human decision")
    for k in ("policyId", "policyVersion", "commonIrVersion", "enforcementMode", "domain"):
        if MAN["designPolicy"].get(k) != dp.get(k):
            probs.append(f"manifest designPolicy.{k} != policy file")
    if MAN.get("category") != dp["classification"]["category"]:
        probs.append("manifest category != policy classification")
    rec("POLICY_HASH", "FAIL" if probs else "PASS", f"{v[:23]}..." + (f"; {probs}" if probs else ""))


@check("SOURCE_IDENTITY")
def _():
    reg = load("policy/source-identity.json")
    need = ["brand", "person", "project", "copy", "cta", "url", "asset"]
    empty = [k for k in need if not reg["patterns"].get(k)]
    if empty or not reg["copyFingerprints"]["hashes"]:
        rec("SOURCE_IDENTITY", "FAIL", f"empty categories {empty}"); return
    if not HAS_SOURCE:
        rec("SOURCE_IDENTITY", "WARN", "standalone: registry present but not re-derived (no sibling source)"); return
    r = subprocess.run([sys.executable, str(REPO / "extraction/derive_source_identity.py"), "--check"], capture_output=True, text=True)
    rec("SOURCE_IDENTITY", "PASS" if r.returncode == 0 else "FAIL", r.stdout.strip())


@check("PARITY_EVIDENCE")
def _():
    p = REPO / "extraction/parity/parity-results.json"
    if not p.exists():
        rec("PARITY_EVIDENCE", "WARN", "parity not measured (no parity-results.json)"); return
    pr = json.loads(p.read_text())
    exc = load("extraction/measured-values.json")["parity"]["exceptions"]
    probs = []
    keys = {(e["route"], e["viewport"], e["section"], e.get("index")) for e in exc}
    for b in pr["summary"]["belowGate"]:
        if (b["route"], b["viewport"], b["id"], b["index"]) not in keys:
            probs.append(f"below gate without exception: {b['route']} {b['viewport']} {b['id']}#{b['index']} {b['matchRatio']}")
    for e in exc:
        if e.get("status") != "pending human approval" and not e.get("approvedBy"):
            probs.append(f"exception {e['section']} has status {e.get('status')}")
        if e.get("approvedBy") and re.search(r"claude|agent|assistant|automated", str(e["approvedBy"]), re.I):
            probs.append(f"exception {e['section']} self-approved by {e['approvedBy']}")
    rp = pr["reproducibility"]
    # a section whose gate outcome flips between runs, or that moves by > 0.10, means the harness is broken (R12);
    # smaller over-tolerance deltas with a consistent gate outcome are recorded residual variance (WARN, reported)
    if rp.get("gateFlips"):
        probs.append(f"gate outcome differs between runs: {[(f['route'], f['viewport'], f['id']) for f in rp['gateFlips']][:3]}")
    if rp.get("maxRunDelta") is not None and rp["maxRunDelta"] > 0.10:
        probs.append(f"run-to-run delta {rp['maxRunDelta']} > 0.10: harness not deterministic")
    status = "FAIL" if probs else ("PASS" if rp.get("ok") is True else "WARN")
    rec("PARITY_EVIDENCE", status, f"{pr['summary']['sections']} sections, mean {pr['summary']['meanMatchRatio']}, below gate {len(pr['summary']['belowGate'])} (all with pending exceptions: {not probs}); reproducibility: {rp.get('status')}" + (f"; {probs[:3]}" if probs else ""))


@check("HYGIENE")
def _():
    junk = [str(p.relative_to(REPO)) for p in REPO.rglob("*") if p.name in (".DS_Store", "Thumbs.db", "desktop.ini") or "__MACOSX" in p.parts or "__pycache__" in p.parts or p.suffix == ".pyc"]
    abs_ = [str(p.relative_to(REPO)) for p in REPO.rglob("*") if p.is_file() and p.suffix in (".json", ".md", ".py", ".mjs", ".css")
            and ABS_PATH.search(p.read_text(errors="ignore"))]
    lc = "\n".join((REPO / f).read_text().lower() for f in ("README.md", "registry.manifest.json", "policy/design-policy.json"))
    probs = (["junk: " + str(junk[:3])] if junk else []) + (["absolute paths: " + str(abs_[:3])] if abs_ else [])
    other = "s" + "aas"  # the one category whose wording a portfolio repo must not carry (assembled to avoid self-match)
    if MAN.get("category") != other and other in lc:
        probs.append("category wording not supported by evidence in README/manifest/policy")
    # __pycache__ created by importing the validator in-process is cleaned at exit; see bottom of file
    rec("HYGIENE", "FAIL" if probs else "PASS", "no junk files, no absolute machine paths" + (f"; {probs}" if probs else ""))


def main():
    for n, s, d in results:
        print(f"{s:4}  {n:26} {d}")
    f = sum(1 for _, s, _ in results if s == "FAIL")
    w = sum(1 for _, s, _ in results if s == "WARN")
    print(f"\nverify_all: {len(results) - f - w} pass, {w} warn, {f} fail  (source tree {'present' if HAS_SOURCE else 'ABSENT - standalone mode'})")
    return 1 if f else 0


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    rc = main()
    sys.exit(rc)
