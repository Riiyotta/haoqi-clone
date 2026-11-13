# haoqi portfolio design-repo

AI-ready design contract extracted from the local study clone of a live personal portfolio
(https://haoqi.design, a designer's own site). It describes what the site renders and how it behaves - tokens,
section contracts, page shapes, motion, asset roles - as JSON + JSON Schema + validators, so a model can compose
new pages in this design language without reusing the owner's identity, copy or media.

Status: `design-review-pending`, `productionApproved: false`. Category `portfolio` (evidence in
`policy/design-policy.json`), bound to `n0-design-constraints-common` 0.1.0 with a local extension;
approval `defined-pending-architecture-review`, `architectureDecisionRecorded: false` until the owner records a decision.

## Real person, real content

Everything the source shows - name, photo, handwritten signature, wordmark, project names and screenshots, 3D models,
stickers, music, the font download, all copy, social and email links - belongs to the site's owner or the third parties
shown. **`reference` mode** PageSpecs describe the source faithfully (evidence only). **`generated` mode** PageSpecs are
checked by `schema/semantic_validate.py` against `policy/source-identity.json` (patterns derived from the tracked clone
source plus hashed 6-word / 8-character copy fingerprints) and the pinned asset availability: no source brand, person,
project, URL, store/download link, copy, call-to-action, rating or proprietary media may appear. Do not publish this
repository; keep it private.

## Contents (recomputed from disk by `extraction/verify_all.py` MANIFEST_COUNTS)

| | count |
|---|---|
| section contracts (`sections/`) | 25 (7 pinned `retrievalEligible: false`: effect.pointer-trail, overlay.image-lightbox, shell.hint-panel, shell.mobile-menu, shell.scroll-progress, shell.status-row, shell.transition-mask) |
| primitives / components | 10 / 8 |
| templates / routes | 3 / 8 (home `/`, 6 project articles, not-found `/*`) |
| approved tokens (`tokens/llm/token-catalog.json`) | 133 |
| asset roles (`assets/asset-roles.json`) | 25 |
| motion patterns | 17 |
| compatibility rules (graph = validator) | 37 |
| example PageSpecs (`schema/examples/`) | 6 (reference + generated for each of home, article, not-found) |

Layout: `tokens/` (00-foundation, 10-semantic, 20-component, 30-layout, themes, llm), `primitives/`, `components/`,
`sections/`, `templates/`, `compatibility/`, `schema/` (PageSpec schema built from the contracts by
`schema/build_schema.py`, section-contract schema, semantic validator, adversarial tests), `assets/`, `policy/`,
`extraction/` (measurements, citations, gates, drift proofs, parity harness). `registry.manifest.json` lists every entry point.

## Key modelling decisions

- **Sections are semantic units.** The home statement wrapper (one sticky container, 8 viewports = 7200 px at 1440x900)
  is four content stages, modelled as `statement.stage-headline` (variants primary / secondary / closing) and
  `statement.stage-sentences`, 1800 px each. Long articles are cut into heading-bounded `article.chapter` sections
  (largest: 4383 px = 39.7% of /adrive). The only gate hit is `/inspire_mono` `article.image-grid` (67.1%: one gallery
  of 15 slides with no internal boundary), whitelisted as an agent attestation, not a human sign-off.
- **Runtime UI is retrieval-ineligible** (pinned in code): status row, scroll progress, transition mask + loader,
  mobile menu, hint panel, pointer trail, image lightbox.
- **Tokens** come from the original compiled stylesheet's custom properties, excerpted verbatim into
  `extraction/excerpts/original-css-tokens.css` (sha256-pinned) and re-derived by verify_all on every run.
- **Deliberately excluded:** `/2026` and `/unlock/*` (passcode-protected on the original). `/reunimos` embeds a live
  third-party product (blocked for generation). The clone's weather line uses keyless Open-Meteo instead of the
  original's keyed QWeather (deviation). `/inspire_mono` offers `/fonts/InspireMono.zip` (blocked for generation).

## Verify

Requirements: Python 3 with `jsonschema` (Draft-07); Pillow + numpy only for parity scoring; Node + Playwright only to
re-measure. No absolute paths: the browser automation package comes from the `PLAYWRIGHT_MODULE` env var.

```bash
python3 extraction/verify_all.py          # all checks (WARNs instead of failing when used standalone)
python3 schema/tests/adversarial_test.py  # every mutation rejected, every control passes
python3 extraction/prove_drift.py         # every check is proven to catch an injected defect
python3 extraction/wrapper_gate.py        # R9 gate on measured heights
python3 schema/semantic_validate.py schema/examples/*.json
```

Clone build (from the project root, in a fresh `git clone`): `npm ci && npx vite build`.
Re-measure: `PLAYWRIGHT_MODULE=<path> BASE_URL=http://localhost:5192 VIEWPORTS=1440x900,390x844 node extraction/measure_sections.mjs`.
After any change to the clone's `src/`: `python3 extraction/repoint_citations.py --write`, re-run
`extraction/derive_source_identity.py`, re-measure, `extraction/policy_hash.py --write`, bump the version, note it in the CHANGELOG.

## Clone parity (R12, live vs clone)

Harness: `extraction/parity/capture.mjs` + `compare.py` (details and capture state in `extraction/parity/README.md`).
Live screenshots are not committed; `extraction/parity/parity-results.json` holds the scores.

Metric: share of pixels with max |RGB diff| <= 24 over the rows each section occupies; gate >= 0.8 per section.
**Sections scored: 88, mean 0.994, below gate: 1.** Reproducibility: **NOT reproducible: runs disagree** (max per-section delta between runs 0.0261, tolerance 0.01).

| route | viewport | section | matchRatio | min over offsets | run 2 |
|---|---|---|---|---|---|
| / | 1440x900 | hero.banner | 0.974 | 0.974 | 0.963 |
| / | 1440x900 | intro.about | 0.998 | 0.998 | 0.999 |
| / | 1440x900 | work.selected-grid | 0.999 | 0.998 | 0.999 |
| / | 1440x900 | statement.stage-headline:primary | 0.998 | 0.995 | 0.998 |
| / | 1440x900 | statement.stage-headline:secondary | 1.000 | 1.000 | 1.000 |
| / | 1440x900 | statement.stage-sentences | 1.000 | 1.000 | 1.000 |
| / | 1440x900 | statement.stage-headline:closing | 1.000 | 1.000 | 0.999 |
| / | 1440x900 | contact.footer-cta | 0.971 | 0.971 | 0.964 |
| /reunimos | 1440x900 | article.header | 1.000 | 1.000 | 1.000 |
| /reunimos | 1440x900 | article.intro | 1.000 | 1.000 | 1.000 |
| /reunimos | 1440x900 | article.live-embed | 0.615 | 0.590 | 0.617 |
| /reunimos | 1440x900 | article.meta-footer | 0.999 | 0.999 | 1.000 |
| /inspire_mono | 1440x900 | article.header | 1.000 | 1.000 | 1.000 |
| /inspire_mono | 1440x900 | article.intro | 1.000 | 1.000 | 1.000 |
| /inspire_mono | 1440x900 | article.download-cta | 1.000 | 1.000 | 1.000 |
| /inspire_mono | 1440x900 | article.image-grid | 1.000 | 0.999 | 1.000 |
| /inspire_mono | 1440x900 | article.meta-footer | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 1440x900 | article.header | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 1440x900 | article.intro | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 1440x900 | article.chapter #2 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 1440x900 | article.chapter #3 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 1440x900 | article.chapter #4 | 1.000 | 0.998 | 1.000 |
| /wasm_design_utils | 1440x900 | article.chapter #5 | 1.000 | 0.999 | 1.000 |
| /wasm_design_utils | 1440x900 | article.chapter #6 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 1440x900 | article.chapter #7 | 0.999 | 0.998 | 0.999 |
| /wasm_design_utils | 1440x900 | article.chapter #8 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 1440x900 | article.meta-footer | 1.000 | 0.999 | 0.999 |
| /adrive | 1440x900 | article.header | 1.000 | 1.000 | 1.000 |
| /adrive | 1440x900 | article.intro | 1.000 | 1.000 | 1.000 |
| /adrive | 1440x900 | article.chapter #2 | 1.000 | 1.000 | 1.000 |
| /adrive | 1440x900 | article.chapter #3 | 1.000 | 1.000 | 1.000 |
| /adrive | 1440x900 | article.chapter #4 | 1.000 | 1.000 | 1.000 |
| /adrive | 1440x900 | article.meta-footer | 1.000 | 1.000 | 1.000 |
| /shore_icon | 1440x900 | article.header | 1.000 | 1.000 | 1.000 |
| /shore_icon | 1440x900 | article.intro | 1.000 | 1.000 | 1.000 |
| /shore_icon | 1440x900 | article.chapter #2 | 1.000 | 1.000 | 1.000 |
| /shore_icon | 1440x900 | article.chapter #3 | 1.000 | 0.999 | 1.000 |
| /shore_icon | 1440x900 | article.chapter #4 | 1.000 | 0.999 | 1.000 |
| /shore_icon | 1440x900 | article.chapter #5 | 1.000 | 0.999 | 1.000 |
| /shore_icon | 1440x900 | article.meta-footer | 0.999 | 0.997 | 0.998 |
| /teambition | 1440x900 | article.header | 1.000 | 1.000 | 1.000 |
| /teambition | 1440x900 | article.intro | 1.000 | 1.000 | 1.000 |
| /teambition | 1440x900 | article.meta-footer | 1.000 | 1.000 | 1.000 |
| /__not_found_probe__ | 1440x900 | error.not-found | 1.000 | 1.000 | 1.000 |
| / | 390x844 | hero.banner | 0.944 | 0.944 | 0.965 |
| / | 390x844 | intro.about | 0.999 | 0.999 | 1.000 |
| / | 390x844 | work.selected-grid | 0.999 | 0.999 | 1.000 |
| / | 390x844 | statement.stage-headline:primary | 1.000 | 0.999 | 1.000 |
| / | 390x844 | statement.stage-headline:secondary | 1.000 | 1.000 | 1.000 |
| / | 390x844 | statement.stage-sentences | 1.000 | 1.000 | 1.000 |
| / | 390x844 | statement.stage-headline:closing | 1.000 | 1.000 | 1.000 |
| / | 390x844 | contact.footer-cta | 0.951 | 0.951 | 0.977 |
| /reunimos | 390x844 | article.header | 1.000 | 1.000 | 1.000 |
| /reunimos | 390x844 | article.intro | 1.000 | 1.000 | 1.000 |
| /reunimos | 390x844 | article.live-embed | 1.000 | 1.000 | 1.000 |
| /reunimos | 390x844 | article.meta-footer | 1.000 | 1.000 | 1.000 |
| /inspire_mono | 390x844 | article.header | 1.000 | 1.000 | 1.000 |
| /inspire_mono | 390x844 | article.intro | 1.000 | 1.000 | 1.000 |
| /inspire_mono | 390x844 | article.download-cta | 1.000 | 1.000 | 1.000 |
| /inspire_mono | 390x844 | article.image-grid | 1.000 | 1.000 | 1.000 |
| /inspire_mono | 390x844 | article.meta-footer | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 390x844 | article.header | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 390x844 | article.intro | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 390x844 | article.chapter #2 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 390x844 | article.chapter #3 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 390x844 | article.chapter #4 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 390x844 | article.chapter #5 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 390x844 | article.chapter #6 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 390x844 | article.chapter #7 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 390x844 | article.chapter #8 | 1.000 | 1.000 | 1.000 |
| /wasm_design_utils | 390x844 | article.meta-footer | 1.000 | 1.000 | 1.000 |
| /adrive | 390x844 | article.header | 1.000 | 1.000 | 1.000 |
| /adrive | 390x844 | article.intro | 1.000 | 1.000 | 1.000 |
| /adrive | 390x844 | article.chapter #2 | 1.000 | 1.000 | 1.000 |
| /adrive | 390x844 | article.chapter #3 | 1.000 | 1.000 | 1.000 |
| /adrive | 390x844 | article.chapter #4 | 1.000 | 1.000 | 1.000 |
| /adrive | 390x844 | article.meta-footer | 1.000 | 1.000 | 1.000 |
| /shore_icon | 390x844 | article.header | 1.000 | 1.000 | 1.000 |
| /shore_icon | 390x844 | article.intro | 1.000 | 1.000 | 1.000 |
| /shore_icon | 390x844 | article.chapter #2 | 1.000 | 1.000 | 1.000 |
| /shore_icon | 390x844 | article.chapter #3 | 1.000 | 1.000 | 1.000 |
| /shore_icon | 390x844 | article.chapter #4 | 1.000 | 1.000 | 1.000 |
| /shore_icon | 390x844 | article.chapter #5 | 1.000 | 1.000 | 1.000 |
| /shore_icon | 390x844 | article.meta-footer | 1.000 | 1.000 | 1.000 |
| /teambition | 390x844 | article.header | 1.000 | 1.000 | 1.000 |
| /teambition | 390x844 | article.intro | 1.000 | 1.000 | 1.000 |
| /teambition | 390x844 | article.meta-footer | 1.000 | 1.000 | 1.000 |
| /__not_found_probe__ | 390x844 | error.not-found | 1.000 | 1.000 | 1.000 |

Exceptions (status `pending human approval`, `approvedBy: null` - an agent never approves its own exception):

- /reunimos 1440x900 article.live-embed: 0.6154 - The section is a live third-party product (https://www.reunimos.cc) loaded in an iframe on both sides. At the same virtual frame the clone-side iframe had painted the product's sign-in screen while the live-side iframe was still blank (white); frame, size, radius and ring match. The embedded page is not part of the clone and loads on its own network timing. Below the gate in both runs (run 1 0.6154, run 2 0.6171); the same section scores 1.0 / 1.0 at 390x844, where both iframes had painted. Not masked, not copied.

Reproducibility (two runs, unchanged harness): 85/88 sections within 0.01; over tolerance: / 1440x900 hero.banner: run1 0.9743, run2 0.9631 (delta 0.0112); / 390x844 hero.banner: run1 0.9443, run2 0.9649 (delta 0.0206); / 390x844 contact.footer-cta: run1 0.9505, run2 0.9766 (delta 0.0261). Gate outcome identical in both runs. All three over-tolerance sections are the WebGL opener/closer of the home page (bokeh streaks, falling stickers, glass models); every DOM-only section, every article and every statement stage agrees within 0.001-0.0005. Both runs captured at identical virtual frame schedules. First hypothesis - asset load timing during the free-running load phase - was TESTED AND REFUTED: two extra home-only runs with frames frozen from the start until network idle (and the clone served by the harness itself) still differed by 0.031 (hero 1440), 0.024 (hero 390) and 0.018 (contact 1440). The remaining nondeterminism lies inside the WebGL frame itself (not controlled by frame count) and is not yet isolated; the gate outcome never changes between runs and no section moves by more than 0.03.
