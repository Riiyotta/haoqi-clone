# Changelog

`repositoryVersion` is documentation-only (hand-maintained here); `allowlistVersion` and `pageSpecVersion` are
machine-checked by `extraction/verify_all.py`.

## 1.0.2 - 2026-11-13

- Parity variance isolated further: comparing each side with ITSELF between run 1 and run 2 (same virtual frame)
  gives live 0.944 / 0.938 / 0.949 and clone 0.991 / 0.975 / 0.979 on the home hero 1440 / hero 390 / contact 390
  (DOM-stage control: 0.999 / 1.000). The WebGL opener/closer is nondeterministic per frame on both sides, more so on
  the original; the live-vs-clone "NOT reproducible" outcome stands and is inherited from the source page.
- Runs 3 + 4 not started (precondition - the frozen-load validation agreeing - not met).

## 1.0.1 - 2026-11-13

Parity phase 2 (second run, harness unchanged except a page-kind guard that alters no capture state).
- Run 1 vs run 2: 85/88 sections agree within 0.01; outcome **NOT reproducible: runs disagree**, max delta 0.0261,
  no section changes its gate outcome. Over tolerance: home hero 1440 (0.9743 / 0.9631), home hero 390 (0.9443 / 0.9649),
  home contact 390 (0.9505 / 0.9766), all WebGL-driven.
- Load-timing hypothesis tested and refuted (two extra frozen-load runs still differ by up to 0.031); source of the
  in-frame WebGL variance not yet isolated - follow-up.
- /reunimos 1440 live third-party iframe below the gate in both runs (0.6154 / 0.6171): exception pending human approval.
- verify_all PARITY_EVIDENCE: a gate flip between runs or a delta > 0.10 FAILs (broken harness); smaller over-tolerance
  deltas with a consistent gate outcome WARN and are reported.
- compare.py records withinTolerance / overTolerance / gateFlips; harness asserts page kind per route.

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
