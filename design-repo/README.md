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

Not measured yet.
