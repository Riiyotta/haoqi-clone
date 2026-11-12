#!/usr/bin/env python3
"""Semantic validator for PageSpecs: everything Draft-07 cannot express.

    python3 schema/semantic_validate.py <pagespec.json> [...]      # exit 1 on any error

Layers: (1) Draft-07 against schema/pagespec.schema.json, (2) template/route/composition rules,
(3) compatibility-graph rules, (4) word budgets, (5) motion fallbacks, (6) asset roles + availability pins,
(7) retrieval-eligibility pins, (8) token policy, (9) generated-mode leakage rules (GENERATED_MODE_*).
Every rule id in RULES must also appear in compatibility/graph.json (verify_all.py checks agreement).
Standard library + jsonschema only; the repo root is derived from this file's location.
"""
import hashlib, json, math, re, sys, unicodedata
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent


def _load(rel):
    return json.loads((REPO / rel).read_text())


# ---------------------------------------------------------------- pins (independent of the registries)
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
# roles whose exact policy value matters more than enum membership (a real person, a live third-party product, a trademark)
PINNED_GENERATION_POLICY = {"owner-portrait": "must-not-fabricate-likeness", "live-site-embed": "must-not-embed-live-third-party",
                            "source-wordmark": "must-not-reuse-or-imitate", "owner-signature": "must-not-reuse-or-imitate"}
RETRIEVAL_INELIGIBLE = {"shell.status-row", "shell.scroll-progress", "shell.transition-mask", "shell.mobile-menu", "shell.hint-panel",
                        "effect.pointer-trail", "overlay.image-lightbox"}
RESERVED_HOST = re.compile(r"(^|\.)(example|invalid)$|^example\.(com|org|net)$")
REF_SCHEMES = ("generated:", "user-supplied:", "placeholder:", "glyph:")

RULES = {
    "SCHEMA": "error", "TEMPLATE_SEQUENCE": "error", "TEMPLATE_MISSING_REQUIRED": "error", "ROUTE_TEMPLATE": "error",
    "REFERENCE_COMPOSITION": "error", "ONE_HERO": "error", "HOME_ROUTE_ONLY": "error", "ONE_PER_PAGE": "error",
    "FIRST_IN_FLOW": "error", "LAST_IN_FLOW": "error", "LAYER_ORDER": "error", "STATEMENT_STAGES_CONTIGUOUS": "error",
    "TOC_REQUIRES_HEADINGS": "error", "LIGHTBOX_REQUIRES_FIGURES": "error", "NO_ADJACENT_SAME_CATEGORY": "warn",
    "MAX_WORDS": "error", "MOTION_FALLBACK": "error", "ASSET_ROLE_SECTION": "error", "ASSET_AVAILABILITY_PIN": "error",
    "RETRIEVAL_INELIGIBLE_PINNED": "error", "RETRIEVAL_CONTENT_MARKED_INELIGIBLE": "error",
    "TOKEN_UNKNOWN": "error", "TOKEN_RAW_COLOR": "error", "TOKEN_ARBITRARY_SPACING": "error", "TOKEN_UNSUPPORTED_FONT": "error",
    "TOKEN_FIELD_CATEGORY": "error", "TOKEN_THEME_MISMATCH": "error", "TOKEN_SCENE_SCOPE": "error", "TOKEN_ON_ACCENT_PAIRING": "error",
    "GENERATED_MODE_BRAND": "error", "GENERATED_MODE_PERSON": "error", "GENERATED_MODE_URL": "error", "GENERATED_MODE_STORE": "error",
    "GENERATED_MODE_COPY": "error", "GENERATED_MODE_CTA": "error", "GENERATED_MODE_ASSET": "error", "GENERATED_MODE_RATING": "error",
}

CJK = re.compile(r"[㐀-鿿]")
LAT = re.compile(r"[A-Za-z0-9]+(?:['’\-.][A-Za-z0-9]+)*")


def words(t):
    """Latin word tokens + ceil(CJK characters / 2) (two Han characters ~ one word)."""
    return len(LAT.findall(t)) + math.ceil(len(CJK.findall(t)) / 2)


def norm(s):
    s = unicodedata.normalize("NFKC", s).lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", s).strip()


def loose(s):
    s = norm(s).replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^0-9a-z㐀-鿿]+", " ", s)).strip()


def shingles(text, ln, cn):
    t = norm(text)
    out = set()
    ws = re.findall(r"[a-z0-9][a-z0-9'&+\-.@/]*", t)
    for i in range(len(ws) - ln + 1):
        out.add(" ".join(ws[i:i + ln]))
    cjk = "".join(ch for ch in t if "㐀" <= ch <= "鿿")
    for i in range(len(cjk) - cn + 1):
        out.add(cjk[i:i + cn])
    return out


class Ctx:
    def __init__(self):
        self.sections = {p.stem: json.loads(p.read_text()) for p in sorted((REPO / "sections").glob("*.json"))}
        self.templates = _load("templates/templates.json")["templates"]
        self.routes = {r["route"]: r for r in _load("templates/routes.json")["routes"]}
        self.roles = _load("assets/asset-roles.json")["roles"]
        self.patterns = _load("tokens/00-foundation/motion-patterns.json")["patterns"]
        self.catalog = _load("tokens/llm/token-catalog.json")["tokens"]
        self.policy = _load("tokens/llm/token-policy.json")
        self.identity = _load("policy/source-identity.json")
        self.schema = _load("schema/pagespec.schema.json")
        fp = self.identity["copyFingerprints"]
        self.fp = set(fp["hashes"]); self.fp_ln = fp["latinShingleWords"]; self.fp_cn = fp["cjkShingleChars"]


_CTX = None


def ctx():
    global _CTX
    if _CTX is None:
        _CTX = Ctx()
    return _CTX


def strings(o, path="$"):
    if isinstance(o, str):
        yield path, o
    elif isinstance(o, dict):
        for k, v in o.items():
            yield from strings(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from strings(v, f"{path}[{i}]")


def asset_refs(o, path="$"):
    if isinstance(o, dict):
        if "role" in o and "ref" in o:
            yield path, o
        for k, v in o.items():
            yield from asset_refs(v, f"{path}.{k}")
    elif isinstance(o, list):
        for i, v in enumerate(o):
            yield from asset_refs(v, f"{path}[{i}]")


def word_budgets(value, schema, path, out, defs):
    if "$ref" in schema:
        schema = defs[schema["$ref"].split("/")[-1]]
    if isinstance(value, str) and "maxWords" in schema:
        n = words(value)
        if n > schema["maxWords"]:
            out.append((path, n, schema["maxWords"]))
    elif isinstance(value, dict):
        if "oneOf" in schema:
            for alt in schema["oneOf"]:
                kp = alt.get("properties", {}).get("kind", {}).get("const")
                if kp is None or kp == value.get("kind"):
                    word_budgets(value, alt, path, out, defs); return
        for k, v in value.items():
            if k in schema.get("properties", {}):
                word_budgets(v, schema["properties"][k], f"{path}.{k}", out, defs)
    elif isinstance(value, list) and "items" in schema:
        for i, v in enumerate(value):
            word_budgets(v, schema["items"], f"{path}[{i}]", out, defs)


def validate(spec):
    """Return (errors, warnings): lists of {rule, path, message}."""
    c = ctx()
    errs, warns = [], []

    def add(rule, path, msg):
        (errs if RULES[rule] == "error" else warns).append({"rule": rule, "path": path, "message": msg})

    # ---- (1) Draft-07
    try:
        from jsonschema import Draft7Validator
        se = sorted(Draft7Validator(c.schema).iter_errors(spec), key=lambda e: list(e.path))
        for e in se:
            add("SCHEMA", "$" + "".join(f"[{p}]" if isinstance(p, int) else f".{p}" for p in e.path), e.message[:300])
    except ImportError:
        add("SCHEMA", "$", "jsonschema is not installed (pip install jsonschema)")
    if errs:
        return errs, warns
    mode, tid, route, theme = spec["mode"], spec["template"], spec["route"], spec["theme"]
    nodes = spec["nodes"]
    tpl = c.templates[tid]
    key = lambda n: n["section"] + (":" + n["variant"] if n.get("variant") else "")

    # ---- (2) template sequence (cross-reference the declared template's real node list)
    i = 0
    for t in tpl["nodes"]:
        cnt = 0
        while i < len(nodes) and nodes[i]["section"] == t["section"] and (t.get("variant") is None or nodes[i].get("variant") == t["variant"]):
            cnt += 1; i += 1
            if not t["repeatable"]:
                break
        if t["required"] and cnt == 0:
            add("TEMPLATE_MISSING_REQUIRED", "$.nodes", f"{tid} requires {t['section']}{':' + t['variant'] if t.get('variant') else ''} at this position")
    if i < len(nodes):
        add("TEMPLATE_SEQUENCE", f"$.nodes[{i}]", f"node {key(nodes[i])} is not allowed here by {tid} (unknown to the template, repeated, or out of order)")
    if not re.match(tpl["routePattern"], route):
        add("ROUTE_TEMPLATE", "$.route", f"route {route} does not match {tid} pattern {tpl['routePattern']}")
    if tid == "template.not-found" and route in c.routes:
        add("ROUTE_TEMPLATE", "$.route", f"{route} is a real route; the not-found template is for unknown paths")
    if tid != "template.not-found" and route in c.routes and c.routes[route]["template"] != tid:
        add("ROUTE_TEMPLATE", "$.route", f"{route} is served by {c.routes[route]['template']}, not {tid}")
    if mode == "reference":
        r = c.routes.get(route) or (c.routes["/*"] if tid == "template.not-found" else None)
        if r is None:
            add("ROUTE_TEMPLATE", "$.route", f"reference PageSpec route {route} is not a route the source serves")
        elif [key(n) for n in nodes] != r["composition"]:
            add("REFERENCE_COMPOSITION", "$.nodes", f"reference PageSpec for {r['route']} must reproduce the measured composition {r['composition']}")

    # ---- (3) compatibility rules
    cats = [c.sections[n["section"]]["category"] for n in nodes]
    layers = [c.sections[n["section"]]["layer"] for n in nodes]
    inflow = [k for k, l in enumerate(layers) if l == "in-flow"]
    if cats.count("HERO") > 1:
        add("ONE_HERO", "$.nodes", "at most one HERO per page")
    for k, n in enumerate(nodes):
        cons = c.sections[n["section"]]["constraints"]
        if cons.get("homeOnly") or n["section"] in ("hero.banner",) or n["section"].startswith("statement."):
            if tid != "template.home" or route != "/":
                add("HOME_ROUTE_ONLY", f"$.nodes[{k}]", f"{n['section']} only exists on the home route")
        if cons.get("mustBeFirstInFlow") and inflow and inflow[0] != k:
            add("FIRST_IN_FLOW", f"$.nodes[{k}]", f"{n['section']} must be the first in-flow section")
        if cons.get("mustBeLastInFlow") and inflow and inflow[-1] != k:
            add("LAST_IN_FLOW", f"$.nodes[{k}]", f"{n['section']} must be the last in-flow section")
    seen = {}
    for k, n in enumerate(nodes):
        kk = key(n)
        seen[kk] = seen.get(kk, 0) + 1
        cons = c.sections[n["section"]]["constraints"]
        mx = 1 if cons.get("onePerPage") else cons.get("maxPerPage")
        if mx is not None and n.get("variant") is None and seen[kk] > mx:
            add("ONE_PER_PAGE", f"$.nodes[{k}]", f"{kk} may appear at most {mx}x")
        if n.get("variant") and seen[kk] > 1:
            add("ONE_PER_PAGE", f"$.nodes[{k}]", f"{kk} (section, variant) may appear once")
    if inflow and any(l != "in-flow" for l in layers[inflow[0]:]):
        add("LAYER_ORDER", "$.nodes", "shell/backdrop/overlay nodes must precede all in-flow nodes")
    st = [k for k, n in enumerate(nodes) if n["section"].startswith("statement.")]
    if st:
        order = [key(nodes[k]) for k in st]
        want = ["statement.stage-headline:primary", "statement.stage-headline:secondary", "statement.stage-sentences", "statement.stage-headline:closing"]
        if st != list(range(st[0], st[0] + len(st))) or order != want:
            add("STATEMENT_STAGES_CONTIGUOUS", f"$.nodes[{st[0]}]", f"statement stages share one sticky 8-viewport container: exactly {want}, contiguous")
    secs = [n["section"] for n in nodes]
    if "article.toc" in secs and "article.chapter" not in secs:
        add("TOC_REQUIRES_HEADINGS", "$.nodes", "article.toc needs at least one article.chapter (headings)")
    has_fig = any(b.get("kind") == "figure" for n in nodes if n["section"] == "article.chapter" for b in n["content"]["blocks"]) or "article.image-grid" in secs
    if ("overlay.image-lightbox" in secs) != has_fig and tid == "template.article":
        add("LIGHTBOX_REQUIRES_FIGURES", "$.nodes", "overlay.image-lightbox is present exactly when the article has zoomable figures")
    exc = {"STATEMENT", "ARTICLE", "SHELL"}
    for a, b in zip(inflow, inflow[1:]):
        if cats[a] == cats[b] and cats[a] not in exc:
            add("NO_ADJACENT_SAME_CATEGORY", f"$.nodes[{b}]", f"two adjacent {cats[a]} sections")

    defs = c.schema["definitions"]
    for k, n in enumerate(nodes):
        con = c.sections[n["section"]]
        p = f"$.nodes[{k}]"
        # ---- (4) word budgets
        over = []
        word_budgets(n["content"], con["contentSchema"], p + ".content", over, defs)
        for path, got, mx in over:
            add("MAX_WORDS", path, f"{got} words > budget {mx}")
        # ---- (5) motion
        m = n["motion"]
        if m["pattern"] not in con["motion"]["allowedPatterns"] or m["reducedMotionFallback"] != c.patterns[m["pattern"]]["reducedMotionFallback"]:
            add("MOTION_FALLBACK", p + ".motion", f"{n['section']}: pattern/fallback not allowed")
        # ---- (7) retrieval pins
        if "retrievalEligible" in n:
            if n["section"] in RETRIEVAL_INELIGIBLE and n["retrievalEligible"]:
                add("RETRIEVAL_INELIGIBLE_PINNED", p, f"{n['section']} is runtime/utility UI and is pinned retrievalEligible=false")
            if n["section"] not in RETRIEVAL_INELIGIBLE and n["retrievalEligible"] is False:
                add("RETRIEVAL_CONTENT_MARKED_INELIGIBLE", p, f"{n['section']} is a content section; it cannot be marked ineligible")
        # ---- (6) assets
        allowed = set(con["assets"]["referenceAssetRoles"]) | set(con["assets"]["generatedAssetRoles"])
        for ap, a in asset_refs(n, p):
            role = a["role"]
            if role not in allowed:
                add("ASSET_ROLE_SECTION", ap, f"role {role} is not used by {n['section']}")
            if c.roles.get(role, {}).get("availability") != PINNED_AVAILABILITY.get(role):
                add("ASSET_AVAILABILITY_PIN", ap, f"registry availability for {role} differs from the pinned value {PINNED_AVAILABILITY.get(role)}")
            if mode == "generated":
                if PINNED_AVAILABILITY.get(role) != "generation-safe" or role not in con["assets"]["generatedAssetRoles"]:
                    add("GENERATED_MODE_ASSET", ap, f"role {role} is not generation-safe for {n['section']} (substitutes: {c.roles.get(role, {}).get('generationSafeSubstitutes')})")
                ref = a["ref"]
                host = re.match(r"^https://([^/]+)/", ref)
                if not (ref.startswith(REF_SCHEMES) or (host and RESERVED_HOST.search(host.group(1)))):
                    add("GENERATED_MODE_ASSET", ap + ".ref", "generated asset refs must be generated:/user-supplied:/placeholder:/glyph: or a reserved .example URL")
        # ---- (8) tokens
        for f, tok in n.get("style", {}).items():
            fp = f"{p}.style.{f}"
            spec_f = c.policy["styleFields"][f]
            if re.search(r"#[0-9a-fA-F]{3,8}\b|\b(rgba?|hsla?|lab|lch|oklch)\(", tok):
                add("TOKEN_RAW_COLOR", fp, "raw colour value; use a catalog token"); continue
            if re.search(r"\d(px|rem|em|vh|vw|%)", tok):
                add("TOKEN_ARBITRARY_SPACING", fp, "raw length; use a spacing/radius token"); continue
            t = c.catalog.get(tok)
            if t is None:
                if f == "font":
                    add("TOKEN_UNSUPPORTED_FONT", fp, f"{tok} is not an approved font family")
                else:
                    add("TOKEN_UNKNOWN", fp, f"{tok} is not in tokens/llm/token-catalog.json")
                continue
            ok_cat = t["category"] == spec_f["category"] and (tok in spec_f.get("allowedTokens", []) or any(tok.startswith(x) for x in spec_f.get("allowedPrefixes", [])))
            if not ok_cat:
                add("TOKEN_FIELD_CATEGORY", fp, f"{tok} ({t['category']}) is not allowed for style.{f}")
            ths = t.get("themes")
            if ths and not all(x in ths for x in (["light", "dark"] if theme == "system" else [theme])):
                add("TOKEN_THEME_MISMATCH", fp, f"{tok} is only valid for {ths}, page theme is {theme}")
            if t.get("scope") == "scene" and con["category"] != "BACKDROP":
                add("TOKEN_SCENE_SCOPE", fp, f"{tok} is a WebGL scene colour (BACKDROP only)")
        st_ = n.get("style", {})
        if st_.get("text") == "text.on-accent" and st_.get("surface") != "accent.selection":
            add("TOKEN_ON_ACCENT_PAIRING", p + ".style", "text.on-accent requires surface accent.selection")

    # ---- (9) generated mode: nothing identifying or reproducing the source
    if mode == "generated":
        pats = c.identity["patterns"]
        if PINNED_AVAILABILITY.get(spec["brand"]["markRole"]) != "generation-safe":
            add("GENERATED_MODE_BRAND", "$.brand.markRole", f"{spec['brand']['markRole']} is not a generation-safe brand mark")
        allstr = list(strings(spec))
        for path, s in allstr:
            ns, ls = norm(s), loose(s)
            for cat_, rule in (("brand", "GENERATED_MODE_BRAND"), ("project", "GENERATED_MODE_BRAND"), ("organization", "GENERATED_MODE_BRAND"),
                               ("person", "GENERATED_MODE_PERSON"), ("email", "GENERATED_MODE_PERSON")):
                for x in pats[cat_]:
                    if norm(x["pattern"]) in ns:
                        add(rule, path, f"source {cat_} '{x['pattern']}'")
            for x in pats["cta"]:
                if loose(x["pattern"]) and loose(x["pattern"]) in ls:
                    add("GENERATED_MODE_CTA", path, f"source call-to-action '{x['pattern']}'")
            for x in pats["copy"]:
                lp = loose(x["pattern"])
                if lp and lp in ls:
                    add("GENERATED_MODE_COPY", path, f"source copy '{x['pattern'][:60]}'")
            for x in pats["asset"]:
                if x["pattern"] in s:
                    add("GENERATED_MODE_ASSET", path, f"source asset path {x['pattern']}")
            for u in re.findall(r"(?:https?://|mailto:)[^\s\"'<>]+|[\w.+-]+@[\w-]+(?:\.[\w-]+)+", s):
                host = re.sub(r"^(https?://|mailto:)", "", u).split("/")[0].split("@")[-1].lower()
                if re.search(r"figma\.com/community/plugin|\.zip$|npmjs\.com/package", u):
                    add("GENERATED_MODE_STORE", path, f"store/download listing link {u}")
                if not RESERVED_HOST.search(host):
                    add("GENERATED_MODE_URL", path, f"{u}: generated pages may only link to relative routes or reserved .example/.invalid hosts")
            for x in pats["host"]:
                if norm(x["pattern"]) in ns and not RESERVED_HOST.search(x["pattern"]):
                    add("GENERATED_MODE_URL", path, f"source host {x['pattern']}")
            if re.search(r"[★⭐]{3,}|\b[0-5](?:\.\d)?\s*/\s*5\b|\bout of 5\b|\b\d+(?:\.\d)?\s*stars?\b", s, re.I):
                add("GENERATED_MODE_RATING", path, "rating/review content: the source has none and no section supports it")
        # copy fingerprints per string and per node (joined)
        texts = [(p_, s) for p_, s in allstr]
        for k, n in enumerate(nodes):
            texts.append((f"$.nodes[{k}].content(joined)", " ".join(s for _, s in strings(n["content"]))))
            joined = loose(" ".join(s for _, s in strings(n["content"])))
            for cat_, rule in (("copy", "GENERATED_MODE_COPY"), ("cta", "GENERATED_MODE_CTA")):
                for x in pats[cat_]:
                    lp = loose(x["pattern"])
                    if lp and len(lp.split()) >= 2 and lp in joined and not any(lp in loose(s) for _, s in strings(n["content"])):
                        add(rule, f"$.nodes[{k}].content", f"source {cat_} across lines '{x['pattern'][:60]}'")
        for path, s in texts:
            hits = [h for h in (hashlib.sha256(x.encode()).hexdigest()[:16] for x in shingles(s, c.fp_ln, c.fp_cn)) if h in c.fp]
            if hits:
                add("GENERATED_MODE_COPY", path, f"{len(hits)} shingle(s) identical to source copy (fingerprint match)")
    return errs, warns


def main(argv):
    rc = 0
    for f in argv:
        spec = json.loads(Path(f).read_text())
        e, w = validate(spec)
        print(f"{f}: {len(e)} error(s), {len(w)} warning(s)")
        for x in e + w:
            print(f"  [{RULES[x['rule']]}] {x['rule']} {x['path']}: {x['message']}")
        rc |= bool(e)
    return rc


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
