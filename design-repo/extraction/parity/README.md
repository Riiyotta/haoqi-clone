# Live-vs-clone parity harness (R12)

1. `capture.mjs` opens the clone and the live site in identical browser contexts (Chromium + SwiftShader, light scheme,
   same viewport), reaches every section by setting the scroll container's `scrollTop` to the same offsets (taken from
   the clone's measured geometry), and screenshots the viewport. Output goes to a scratch dir outside the repo.
2. `compare.py` crops each screenshot to the rows each section occupies and scores
   `matchRatio` = share of pixels whose max |RGB diff| <= 24 (gate: >= 0.80 per section) plus a mean-abs-diff similarity.

Capture state, identical on both sides:
- virtual animation time: rAF / performance.now / Date replaced by an init script; every frame advances exactly 1/60 s
  and the frame pump is frozen at an exact frame count before each screenshot (600 frames settle after load, 120 frames
  after each scroll); Date pinned to 2026-11-12T02:00:00Z (status-row clock).
- Math.random seeded; both weather endpoints aborted (no temperature on either side); no pointer, no clicks, no
  consent banner exists on the site; finite CSS animations completed by the screenshot call.
- Not masked: the WebGL backdrop's time/asset-load-driven regions (sticker spawn frame, bokeh noise). They are
  scored as they are and any section below the gate is diagnosed and recorded as an exception pending human approval.

Why not Playwright's fake clock: tried first; the live bundle never reached `load`/settled under it (its timer chains
starve the fake clock), so the harness drives animation frames itself instead.

Only `parity-results.json` (scores + geometry, no images, no copy) is tracked.
