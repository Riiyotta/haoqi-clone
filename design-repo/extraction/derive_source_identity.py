#!/usr/bin/env python3
"""Derive the source-identity registry (policy/source-identity.json) from the REAL clone source.

    python3 extraction/derive_source_identity.py            # rewrite policy/source-identity.json
    python3 extraction/derive_source_identity.py --check    # exit 1 if the committed registry drifted

Run from anywhere; the project root is the parent of design-repo/. It needs the sibling clone source
(src/, public/, CLONE_SPEC*.md) and is therefore a build-time tool: verify_all.py calls --check only when that
source tree is present and degrades to a WARN otherwise.

What it produces (all used by schema/semantic_validate.py in `generated` mode):
  * named patterns (brand / person / project / organization / cta / copy / url / email / asset), each with
    the tracked files it was found in. Curated names are kept ONLY if they really occur in tracked source;
    copy phrases are extracted automatically from the rendered-text props of the home components.
  * copy fingerprints: truncated sha256 of every 6-word (Latin) / 8-character (CJK) shingle of all source copy
    (home components + article content JSON). Hashes only, so the registry does not republish the copy.
"""
import argparse, hashlib, json, re, sys, unicodedata
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parent
ROOT = REPO.parent
OUT = REPO / "policy" / "source-identity.json"
LATIN_N, CJK_N = 6, 8

# Curated identity names. Each must be FOUND in tracked source (evidence recorded) or the run fails.
CURATED = {
    "brand": ["haoqi.design", "haoqi", "HAOQI©"],
    "person": ["Haoqi Wen", "wenhaoqi", "wenhaoqiasd", "curiosity.wen@gmail.com", "curiosity.wen"],
    "project": ["Reunimos", "reunimos.cc", "Inspire Mono", "InspireMono", "Wasm design utils", "wasm_design_utils",
                "@wenhaoqi/wasm_design_utils", "VectorSymbols", "DarkSide", "aDrive", "阿里云盘", "alipan",
                "Shore Icon", "Teambition", "FoF: See Hear Touch", "FoF: Design System", "See Hear Touch"],
    "organization": ["Alibaba", "100offer", "TikTok", "Friends of Figma", "friends.figma.com"],
    # source-specific calls to action (conversion copy), matched as phrases
    "cta": ["Let's create something extraordinary", "下载 InspireMono.zip"],
    # distinctive short taglines that the automatic extractor would drop (< 3 words) but that are brand motifs
    "copy": ["I bring craft & taste to digital work", "craft & taste", "Future-first always", "Innovate with purpose",
             "Innovate with a human touch", "Building tomorrow's digital products", "Independent by design & engineering",
             "Clarity first. Delight second", "Ship in small loops", "Aim for long arcs"],
}
SEARCH = ["src", "CLONE_SPEC.md", "CLONE_SPEC_PAGES.md", "index.html", "ia.json", "IA.md"]
HOME_COPY_FILES = ["src/components/Hero.jsx", "src/components/About.jsx", "src/components/Innovate.jsx",
                   "src/components/Footer.jsx", "src/components/Header.jsx"]
# third-party infrastructure that is not source identity (library CDNs, weather APIs, svg namespaces)
URL_IGNORE = re.compile(r"gstatic\.com|w3\.org|open-meteo\.com|qweather\.com|example\.|github\.com/pmndrs|threejs\.org")


def norm(s):
    s = unicodedata.normalize("NFKC", s).lower().replace("’", "'").replace("‘", "'")
    return re.sub(r"\s+", " ", s).strip()


def loose(s):
    """Punctuation-insensitive form used for copy/CTA phrase matching (& == and)."""
    s = norm(s).replace("&", " and ")
    return re.sub(r"\s+", " ", re.sub(r"[^0-9a-z\u3400-\u9fff]+", " ", s)).strip()


def files():
    for rel in SEARCH:
        p = ROOT / rel
        if p.is_file():
            yield p
        elif p.is_dir():
            for f in sorted(p.rglob("*")):
                if f.is_file() and f.suffix in (".js", ".jsx", ".json", ".css", ".html", ".md"):
                    yield f


def text_of_node(n, out):
    if isinstance(n, str):
        out.append(n)
    elif isinstance(n, list) and n:
        tag = n[0]
        if tag == "$h":
            kids = n[3:]
        elif tag == "$a":
            kids = n[2:]
        elif tag == "$img":
            a = n[1] or {}
            out.extend(v for k, v in a.items() if k in ("alt", "title") and isinstance(v, str))
            kids = []
        elif tag == "$pre":
            a = n[1] or {}
            out.append("\n".join("".join(t[0] for t in line) for line in a.get("lines", [])))
            kids = []
        elif tag == "$footer":
            kids = []
        else:
            a = n[1] if len(n) > 1 and isinstance(n[1], dict) else {}
            out.extend(v for k, v in (a or {}).items() if k in ("title", "alt") and isinstance(v, str))
            kids = n[2:]
        for k in kids:
            text_of_node(k, out)


def home_copy(only=None):
    """Rendered-text props/literals of the home components (ScrambleText text=, StaggerText text=, arrays, JSX text)."""
    phrases = []
    for rel in ([only] if only else HOME_COPY_FILES):
        s = (ROOT / rel).read_text()
        phrases += re.findall(r'\btext="([^"]+)"', s)
        phrases += [m for m in re.findall(r"\btext=\{`([^`$]+)", s)]
        for arr in re.findall(r"const (?:PRIMARY|SECONDARY|END|BIO_PARTS) = \[(.*?)\]\n", s, re.S):
            phrases += re.findall(r"""['"]([^'"]{2,})['"]""", arr)
        phrases += [t.strip() for t in re.findall(r"<span>([^<>{}]+)</span>", s)]
        phrases += [t for t in re.findall(r"\{'([^']+)'\}", s)]
    return [p for p in phrases if re.search(r"[A-Za-z]", p)]


def shingles(text):
    t = norm(text)
    out = set()
    words = re.findall(r"[a-z0-9][a-z0-9'&+\-.@/]*", t)
    for i in range(len(words) - LATIN_N + 1):
        out.add(" ".join(words[i:i + LATIN_N]))
    cjk = "".join(ch for ch in t if "㐀" <= ch <= "鿿")
    for i in range(len(cjk) - CJK_N + 1):
        out.add(cjk[i:i + CJK_N])
    return out


def h(s):
    return hashlib.sha256(s.encode("utf-8")).hexdigest()[:16]


def derive():
    corpus = {str(f.relative_to(ROOT)): f.read_text(errors="ignore") for f in files()}
    # rendered text of each home component, joined in source order: multi-line headings become one phrase
    for rel in HOME_COPY_FILES:
        corpus[rel + "#rendered-text"] = " ".join(home_copy(rel))
    lc = {k: v.lower() for k, v in corpus.items()}
    patterns, missing = {}, []
    for cat, names in CURATED.items():
        patterns[cat] = []
        for name in names:
            ev = [{"file": k, "count": v.count(name.lower())} for k, v in lc.items() if name.lower() in v]
            if not ev and cat in ("copy", "cta"):
                ev = [{"file": k, "count": 1, "match": "punctuation-insensitive"} for k, v in corpus.items() if loose(name) in loose(v)]
            if not ev:
                missing.append(f"{cat}:{name}")
                continue
            patterns[cat].append({"pattern": name, "evidence": ev[:4]})
    # automatic: home copy phrases (>= 3 alphanumeric words) and joined multi-line headings
    copy_auto = []
    for p in home_copy():
        if len(re.findall(r"[A-Za-z0-9]{2,}", p)) >= 3 and loose(p) not in {loose(x["pattern"]) for x in patterns["copy"] + copy_auto}:
            copy_auto.append({"pattern": p.strip(), "evidence": [{"file": k, "count": 1} for k in HOME_COPY_FILES if p in corpus.get(k, "")][:2]})
    patterns["copy"] += copy_auto
    # URLs + emails in source (non-infrastructure), and every public/ asset path
    urls = set()
    for k, v in corpus.items():
        if not k.startswith("src/"):
            continue
        for u in re.findall(r"https?://[^\s\"'`)<>\]\\]+", v):
            if not URL_IGNORE.search(u):
                urls.add(u.rstrip("/.,"))
    hosts = sorted({re.sub(r"^https?://(www\.)?", "", u).split("/")[0] for u in urls})
    patterns["url"] = [{"pattern": u, "evidence": [{"file": k, "count": v.count(u)} for k, v in corpus.items() if u in v][:2]} for u in sorted(urls)]
    patterns["host"] = [{"pattern": hh, "evidence": []} for hh in hosts]
    emails = sorted({e for k, v in corpus.items() if k.startswith("src/") for e in re.findall(r"[\w.+-]+@[\w-]+\.[a-z]{2,}\b", v) if not e.endswith((".png", ".js"))})
    patterns["email"] = [{"pattern": e, "evidence": []} for e in emails if "@" in e and not e.startswith("@")]
    pub = ROOT / "public"
    assets = sorted("/" + str(p.relative_to(pub)) for p in pub.rglob("*") if p.is_file() and p.name not in (".DS_Store",)) if pub.is_dir() else []
    patterns["asset"] = [{"pattern": a, "evidence": []} for a in assets]
    # fingerprints of all source copy
    texts = list(home_copy())
    for f in sorted((ROOT / "src/pages/content").glob("*.json")):
        d = json.loads(f.read_text())
        buf = []
        for n in d.get("nodes", []):
            text_of_node(n, buf)
        texts.append(d.get("title", ""))
        texts.append(" ".join(buf))
    sh = set()
    for t in texts:
        sh |= shingles(t)
    reg = {
        "$comment": "GENERATED by extraction/derive_source_identity.py from the tracked clone source. Do not hand-edit; re-run the script (verify_all.py --check compares).",
        "registryVersion": "1.0.0",
        "source": "local study clone of a live personal portfolio (see README)",
        "matching": {"normalisation": "NFKC, lower-case, curly quotes -> straight, whitespace collapsed",
                     "patterns": "case-insensitive substring match on normalised text for every string value of a generated PageSpec (text, href, src, alt, labels, brand); copy and cta phrases match punctuation-insensitively (& == and), also against a node's joined text",
                     "fingerprints": f"sha256(shingle)[:16] for every {LATIN_N}-word Latin shingle and {CJK_N}-char CJK shingle; any hit in a generated PageSpec = GENERATED_MODE_COPY"},
        "patterns": patterns,
        "copyFingerprints": {"latinShingleWords": LATIN_N, "cjkShingleChars": CJK_N, "count": len(sh), "hashes": sorted(h(s) for s in sh)},
    }
    return reg, missing


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true")
    a = ap.parse_args()
    if not (ROOT / "src").is_dir():
        print("WARN: no sibling clone source (../src) - cannot derive; committed registry kept")
        return 0
    reg, missing = derive()
    if missing:
        print("FAIL: curated identity names not found in tracked source:", missing)
        return 1
    txt = json.dumps(reg, indent=1, ensure_ascii=False) + "\n"
    if a.check:
        cur = OUT.read_text() if OUT.exists() else ""
        if cur != txt:
            print("FAIL: policy/source-identity.json is out of date with the clone source (re-run derive_source_identity.py)")
            return 1
        print(f"ok: source-identity registry matches source ({sum(len(v) for v in reg['patterns'].values())} patterns, {reg['copyFingerprints']['count']} fingerprints)")
        return 0
    OUT.write_text(txt)
    print(f"wrote {OUT.relative_to(REPO)}: {sum(len(v) for v in reg['patterns'].values())} patterns, {reg['copyFingerprints']['count']} fingerprints")
    return 0


if __name__ == "__main__":
    sys.exit(main())
