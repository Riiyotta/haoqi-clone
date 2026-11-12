#!/usr/bin/env python3
"""Adversarial suite: every mutation must be REJECTED with the expected rule; every control must PASS.

    python3 schema/tests/adversarial_test.py      # exit 1 on any miss

Covers schema layer, template/route/structure, word budgets, motion, assets/availability, retrieval pins (R8),
token policy (R10), generated-mode leakage (R2/R5: brand, logo, store mark/URL, rating, person, URL, copy, CTA,
proprietary media) and the wrapper gate (R9, evaluated in-process on mutated measurements).
"""
import copy, json, sys
from pathlib import Path

sys.dont_write_bytecode = True
REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "schema")); sys.path.insert(0, str(REPO / "extraction"))
import semantic_validate as SV  # noqa: E402
import wrapper_gate as WG  # noqa: E402

EX = {p.stem.replace(".pagespec", ""): json.loads(p.read_text()) for p in sorted((REPO / "schema/examples").glob("*.json"))}
results = []


def idx(spec, section, variant=None):
    for i, n in enumerate(spec["nodes"]):
        if n["section"] == section and (variant is None or n.get("variant") == variant):
            return i
    raise KeyError(section)


def node(spec, section, variant=None):
    return spec["nodes"][idx(spec, section, variant)]


def case(name, base, fn, rule):
    s = copy.deepcopy(EX[base])
    fn(s)
    e, w = SV.validate(s)
    rules = {x["rule"] for x in e}
    ok = rule in rules
    results.append((ok, f"REJECT  {name:58} expect {rule:34} got {sorted(rules)[:4] if not ok else 'ok'}"))


def control(name, spec):
    e, w = SV.validate(spec)
    results.append((not e, f"CONTROL {name:58} {'passes' if not e else [x['rule'] for x in e]}"))


GH, GA, RH, RA = "generated.home", "generated.article", "reference.home", "reference.article"
# ---------------- controls
for k, v in EX.items():
    control(f"example {k}", v)
control("schema/example.pagespec.json", json.loads((REPO / "schema/example.pagespec.json").read_text()))

# ---------------- schema layer (R1 + closed objects)
case("invalid mode value", GH, lambda s: s.__setitem__("mode", "remix"), "SCHEMA")
case("mode missing", GH, lambda s: s.pop("mode"), "SCHEMA")
case("unknown template", GH, lambda s: s.__setitem__("template", "template.pricing"), "SCHEMA")
case("invented section type", GH, lambda s: s["nodes"].insert(9, {"section": "features.grid", "content": {}, "motion": {"pattern": "none", "reducedMotionFallback": "none"}}), "SCHEMA")
case("missing reducedMotionFallback", GH, lambda s: node(s, "hero.banner")["motion"].pop("reducedMotionFallback"), "SCHEMA")
case("wrong fallback for pattern", GH, lambda s: node(s, "hero.banner")["motion"].__setitem__("reducedMotionFallback", "none"), "SCHEMA")
case("invented motion field", GH, lambda s: node(s, "hero.banner")["motion"].__setitem__("bounce", 3), "SCHEMA")
case("extra content field", GH, lambda s: node(s, "hero.banner")["content"].__setitem__("subtitle", "x"), "SCHEMA")
case("rating field (no section supports it)", GH, lambda s: node(s, "contact.footer-cta")["content"].__setitem__("rating", 5), "SCHEMA")
case("invented asset role", GH, lambda s: node(s, "intro.about")["assets"][0].__setitem__("role", "stock-photo"), "SCHEMA")
case("variant missing on stage headline", GH, lambda s: node(s, "statement.stage-headline", "primary").pop("variant"), "SCHEMA")
# ---------------- structure / template cross-reference
case("duplicate hero", GH, lambda s: s["nodes"].insert(idx(s, "hero.banner"), copy.deepcopy(node(s, "hero.banner"))), "TEMPLATE_SEQUENCE")
case("remove mandatory contact CTA", GH, lambda s: s["nodes"].pop(idx(s, "contact.footer-cta")), "TEMPLATE_MISSING_REQUIRED")
case("reorder: about before hero", GH, lambda s: s["nodes"].insert(idx(s, "hero.banner"), s["nodes"].pop(idx(s, "intro.about"))), "TEMPLATE_SEQUENCE")
case("stage order swapped", GH, lambda s: (lambda a, b: s["nodes"].__setitem__(slice(a, b + 1), s["nodes"][a:b + 1][::-1]))(idx(s, "statement.stage-headline", "primary"), idx(s, "statement.stage-headline", "secondary")), "TEMPLATE_SEQUENCE")
case("home nodes declared as article template", GH, lambda s: s.__setitem__("template", "template.article"), "TEMPLATE_SEQUENCE")
case("hero inserted on article", GA, lambda s: s["nodes"].insert(idx(s, "article.header"), copy.deepcopy(EX[GH]["nodes"][idx(EX[GH], "hero.banner")])), "HOME_ROUTE_ONLY")
case("meta-footer not last", GA, lambda s: s["nodes"].insert(idx(s, "article.header"), s["nodes"].pop(idx(s, "article.meta-footer"))), "LAST_IN_FLOW")
case("toc without chapters", GA, lambda s: [s["nodes"].pop(idx(s, "article.chapter")) for _ in range(2)], "TOC_REQUIRES_HEADINGS")
case("lightbox without figures", RA, lambda s: s["nodes"].insert(idx(s, "article.header"), {"section": "overlay.image-lightbox", "content": {}, "motion": {"pattern": "lightbox-flip", "reducedMotionFallback": "instant-open"}}), "LIGHTBOX_REQUIRES_FIGURES")
case("home template on non-home route", GH, lambda s: s.__setitem__("route", "/about"), "ROUTE_TEMPLATE")
case("not-found template on a real route", "generated.not-found", lambda s: s.__setitem__("route", "/adrive"), "ROUTE_TEMPLATE")
case("reference article for unknown route", RA, lambda s: s.__setitem__("route", "/made-up"), "ROUTE_TEMPLATE")
case("reference composition differs from measured", RA, lambda s: s["nodes"].pop(idx(s, "article.intro")), "REFERENCE_COMPOSITION")
case("maxWords overflow (hero bio)", GH, lambda s: node(s, "hero.banner")["content"].__setitem__("bio", "word " * 40), "MAX_WORDS")
case("maxWords overflow (chapter paragraph)", GA, lambda s: node(s, "article.chapter")["content"]["blocks"][0].__setitem__("text", "word " * 90), "MAX_WORDS")
# ---------------- R8 retrieval eligibility
case("runtime overlay flipped eligible (node)", GH, lambda s: node(s, "shell.transition-mask").__setitem__("retrievalEligible", True), "RETRIEVAL_INELIGIBLE_PINNED")
case("content section marked ineligible (node)", GH, lambda s: node(s, "hero.banner").__setitem__("retrievalEligible", False), "RETRIEVAL_CONTENT_MARKED_INELIGIBLE")
# ---------------- R10 token policy
case("unknown token", GH, lambda s: node(s, "hero.banner")["style"].__setitem__("text", "text.brand-pink"), "TOKEN_UNKNOWN")
case("raw hex colour", GH, lambda s: node(s, "hero.banner")["style"].__setitem__("text", "#ff0066"), "TOKEN_RAW_COLOR")
case("raw rgba colour", GH, lambda s: node(s, "contact.footer-cta")["style"].__setitem__("text", "rgba(0,0,0,.5)"), "TOKEN_RAW_COLOR")
case("arbitrary spacing", GH, lambda s: node(s, "shell.header-nav")["style"].__setitem__("font", "13px"), "TOKEN_ARBITRARY_SPACING")
case("unsupported font", GH, lambda s: node(s, "shell.header-nav")["style"].__setitem__("font", "font.comic-sans"), "TOKEN_UNSUPPORTED_FONT")
case("token in wrong field category", GH, lambda s: node(s, "hero.banner")["style"].__setitem__("text", "surface.page"), "TOKEN_FIELD_CATEGORY")
case("theme/token mismatch (light-only token, dark page)", GH, lambda s: (s.__setitem__("theme", "dark"), node(s, "backdrop.webgl-scene")["style"].__setitem__("surface", "color.scene.bokeh-background-light")), "TOKEN_THEME_MISMATCH")
case("scene colour outside backdrop", GH, lambda s: node(s, "shell.hint-panel")["style"].__setitem__("surface", "color.scene.accent-blue"), "TOKEN_FIELD_CATEGORY")
case("on-accent text without accent surface", GH, lambda s: node(s, "hero.banner")["style"].__setitem__("text", "text.on-accent"), "TOKEN_ON_ACCENT_PAIRING")
# ---------------- R2/R5 generated-mode leakage
case("brand name in brand.name", GH, lambda s: s["brand"].__setitem__("name", "HAOQI.DESIGN"), "GENERATED_MODE_BRAND")
case("brand in header label", GH, lambda s: node(s, "shell.header-nav")["content"].__setitem__("brandLabel", "haoqi.design"), "GENERATED_MODE_BRAND")
case("logo leakage: source wordmark role as mark", GH, lambda s: s["brand"].__setitem__("markRole", "source-wordmark"), "GENERATED_MODE_BRAND")
case("logo leakage: wordmark asset", GH, lambda s: node(s, "shell.header-nav")["assets"][0].update(role="source-wordmark", ref="/icon.svg"), "GENERATED_MODE_ASSET")
case("project name leakage", GH, lambda s: node(s, "work.selected-grid")["content"]["items"][0].__setitem__("title", "Inspire Mono"), "GENERATED_MODE_BRAND")
case("store URL leakage (plugin listing)", GH, lambda s: node(s, "work.selected-grid")["content"]["items"][2].__setitem__("href", "https://www.figma.com/community/plugin/986289377230504703/darkside"), "GENERATED_MODE_STORE")
case("store mark leakage (download archive)", GA, lambda s: node(s, "article.download-cta")["assets"][0].update(role="downloadable-archive", ref="/fonts/InspireMono.zip"), "GENERATED_MODE_ASSET")
case("rating leakage in copy", GH, lambda s: node(s, "intro.about")["content"]["statements"].__setitem__(1, "Clients rate my work 4.9/5 ★★★★★ across forty projects."), "GENERATED_MODE_RATING")
case("person name leakage", GH, lambda s: node(s, "hero.banner")["content"].__setitem__("bio", "I'm Haoqi Wen, an interface designer drawing type tools."), "GENERATED_MODE_PERSON")
case("person email leakage", GH, lambda s: node(s, "contact.footer-cta")["content"].__setitem__("email", "curiosity.wen@gmail.com"), "GENERATED_MODE_PERSON")
case("person handle leakage", GH, lambda s: node(s, "contact.footer-cta")["content"]["socials"][0].__setitem__("href", "https://twitter.com/wenhaoqi"), "GENERATED_MODE_PERSON")
case("person photo leakage", GH, lambda s: node(s, "intro.about")["assets"][0].update(role="owner-portrait", ref="/img/m3.png"), "GENERATED_MODE_ASSET")
case("source URL leakage", GH, lambda s: node(s, "intro.about")["content"]["links"][0].__setitem__("href", "https://reunimos.cc"), "GENERATED_MODE_URL")
case("non-reserved external URL", GH, lambda s: node(s, "intro.about")["content"]["links"][0].__setitem__("href", "https://acme-studio.com/"), "GENERATED_MODE_URL")
case("source copy leakage (tagline)", GH, lambda s: node(s, "statement.stage-headline", "primary")["content"].__setitem__("lines", ["Innovate", "with", "purpose"]), "GENERATED_MODE_COPY")
case("source copy leakage (headline across lines)", GH, lambda s: node(s, "hero.banner")["content"].__setitem__("headlineLines", ["I bring", "craft & taste", "to digital work"]), "GENERATED_MODE_COPY")
case("source copy leakage (article text fingerprint)", GA, lambda s: node(s, "article.intro")["content"].__setitem__("paragraphs", [EX[RA]["nodes"][idx(EX[RA], "article.intro")]["content"]["paragraphs"][1]]), "GENERATED_MODE_COPY")
case("source CTA leakage", GH, lambda s: node(s, "contact.footer-cta")["content"].__setitem__("headlineWords", ["Let's", "Create", "Something", "Extraordinary"]), "GENERATED_MODE_CTA")
case("proprietary media: project screenshot", GH, lambda s: node(s, "work.selected-grid")["assets"][0].update(role="project-thumbnail", ref="/work/reunimos01.png"), "GENERATED_MODE_ASSET")
case("proprietary media: glass model", GH, lambda s: node(s, "backdrop.webgl-scene")["assets"][0].update(role="glass-3d-model", ref="/model/hello.gltf"), "GENERATED_MODE_ASSET")
case("proprietary media: source path under safe role", GH, lambda s: node(s, "backdrop.webgl-scene")["assets"][3].__setitem__("ref", "/sticker_img/s_01.png"), "GENERATED_MODE_ASSET")
case("live third-party embed", GA, lambda s: s["nodes"].insert(idx(s, "article.download-cta"), {"section": "article.live-embed", "content": {"title": "Preview", "heightPx": 600}, "assets": [{"slot": "embed", "role": "live-site-embed", "ref": "https://www.reunimos.cc"}], "motion": {"pattern": "none", "reducedMotionFallback": "none"}}), "GENERATED_MODE_ASSET")
case("asset role not used by the section", GH, lambda s: node(s, "intro.about")["assets"][0].__setitem__("role", "generated-sticker"), "ASSET_ROLE_SECTION")
case("generated ref with arbitrary scheme", GH, lambda s: node(s, "intro.about")["assets"][0].__setitem__("ref", "https://cdn.somewhere.net/p.png"), "GENERATED_MODE_ASSET")


# ---------------- R9 wrapper gate (mutated measurements, evaluated in-process)
def gate(name, mut, expect_error=True, needle=None):
    mv = json.loads((REPO / "extraction/measured-values.json").read_text())
    wl = json.loads((REPO / "extraction/wrapper-gate-whitelist.json").read_text())
    secs = {p.stem: json.loads(p.read_text()) for p in (REPO / "sections").glob("*.json")}
    routes = json.loads((REPO / "templates/routes.json").read_text())["routes"]
    mut(mv, wl)
    e, w = WG.evaluate(mv, wl, secs, routes)
    hit = (any(needle in x for x in e) if expect_error else (not e and any(needle in x for x in w)))
    results.append((hit, f"GATE    {name:58} expect {'error' if expect_error else 'warn'} {needle:24} got {'ok' if hit else (e[:2] or w[:2])}"))


def hero(mv):
    return mv["sectionHeights"]["pages"]["/"]["sections"][0]


gate("HERO 1900px warns (not an error)", lambda mv, wl: hero(mv).__setitem__("heightPx", 1900), False, "WRAPPER_GATE_WARN")
gate("HERO 3100px fails", lambda mv, wl: hero(mv).__setitem__("heightPx", 3100), True, "WRAPPER_GATE")
gate("majority share fails", lambda mv, wl: mv["sectionHeights"]["pages"]["/adrive"]["sections"][3].__setitem__("heightPx", 8000), True, "WRAPPER_GATE")
gate("whitelist without justification", lambda mv, wl: wl["entries"][0].__setitem__("justification", "ok"), True, "WHITELIST_NO_JUSTIFICATION")
gate("whitelist agent reviewer unlabelled", lambda mv, wl: wl["entries"][0].__setitem__("reviewedBy", "build agent"), True, "WHITELIST_AGENT_UNLABELLED")
gate("whitelist over cap", lambda mv, wl: wl["entries"][0].__setitem__("maxHeightPx", 1500), True, "WHITELIST_OVER_CAP")
gate("missing measurement", lambda mv, wl: mv["sectionHeights"]["pages"].pop("/teambition"), True, "MISSING_MEASUREMENT")
gate("measured at wrong viewport", lambda mv, wl: mv["sectionHeights"].__setitem__("viewport", "390x844"), True, "WRONG_VIEWPORT")
gate("threshold edited in JSON only", lambda mv, wl: mv["sectionHeights"]["thresholds"].__setitem__("shareFail", 0.9), True, "THRESHOLD_DRIFT")
gate("undecomposed statement wrapper (7200px, 58%) + share 0.62", lambda mv, wl: mv["sectionHeights"]["pages"]["/"]["sections"][3].__setitem__("heightPx", 0.62 * mv["sectionHeights"]["pages"]["/"]["pageHeight"]), True, "WRAPPER_GATE")

bad = [m for ok, m in results if not ok]
for ok, m in results:
    print(("ok   " if ok else "MISS ") + m)
n_rej = sum(1 for _, m in results if m.startswith(("REJECT", "GATE")))
n_ctl = sum(1 for _, m in results if m.startswith("CONTROL"))
print(f"\nadversarial: {len(results) - len(bad)}/{len(results)} as expected ({n_rej} mutations rejected-or-flagged, {n_ctl} controls)")
sys.exit(1 if bad else 0)
