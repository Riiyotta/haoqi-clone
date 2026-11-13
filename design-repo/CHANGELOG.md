# Changelog

`repositoryVersion` is documentation-only (hand-maintained here); `allowlistVersion` and `pageSpecVersion` are
machine-checked by `extraction/verify_all.py`.

## 1.0.0 - 2026-11-12

Initial build (Situation A) from the local clone (commit b2be9df) with every baseline requirement R1-R16 in the first pass.

- Tokens from the original stylesheet's custom properties (verbatim sha256-pinned excerpt), typography/spacing/radius/
  breakpoint/elevation/motion foundations, semantic roles, light + dark themes, LLM token catalog + policy.
- 25 section contracts with `source` (provenance) / `semantic` (taxonomy) split, `retrievalEligible` (7 runtime/utility
  sections pinned false), closed content schemas with word budgets, const-locked reduced-motion fallbacks, structured
  responsive notes, asset roles and needle-checked citations.
- ia.json used as first draft and corrected: `statement.hyper-space` decomposed into its 4 real scroll stages;
  `article.body` decomposed into heading-bounded chapters + live embed / download CTA / image grid; mobile menu,
  hint panel, lightbox and pointer trail split out as runtime UI.
- 3 templates, 8 routes (1:1 with ia.json), measured compositions; PageSpec schema generated from the contracts.
- `mode: reference | generated`; generated-mode leakage rules backed by `policy/source-identity.json`
  (derived from the tracked source; copy as hashed shingles); 25 asset roles with pinned availability.
- Measured section heights at 1440x900 and 390x844 (clone and live identical within 1 px); wrapper gate with one
  agent-attested whitelist entry (/inspire_mono image grid).
- Category `portfolio`, generic common policy binding with local extension, policy content hash.
- Live-vs-clone parity (R12), phase 1 = ONE run, flagged "single-run — second run pending": 16 route/viewport pairs
  (8 routes x 1440x900 + 390x844), 88 sections, mean matchRatio 0.9936, 1 section below the 0.80 gate
  (/reunimos 1440 live third-party iframe embed, 0.6154 - exception pending human approval, approvedBy null).
  Harness: deterministic virtual animation frames (rAF/performance.now/Date replaced, both sides aligned to the same
  absolute frame and frozen for each screenshot), seeded Math.random, weather aborted, vsync/frame cap disabled,
  clone served from its production build (the dev server's HMR client reloads pages when its websocket drops),
  resumable per (route, viewport, side) unit with retries, browser relaunch on failure and a single-writer lock.
- IR: none generated (not requested).
