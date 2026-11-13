# Live-vs-clone parity harness (R12)

1. `capture.mjs` opens the clone (its PRODUCTION build: `npx vite build --outDir <scratch>` + `npx vite preview --outDir <scratch> --port 5193`;
   the dev server's HMR client reloads the page whenever its websocket drops, which corrupted captures under load) and the live site in identical browser contexts (Chromium + SwiftShader, light scheme,
   same viewport), reaches every section by setting the scroll container's `scrollTop` to the same offsets (taken from
   the clone's measured geometry), and screenshots the viewport. Output goes to a scratch dir outside the repo.
2. `compare.py` crops each screenshot to the rows each section occupies and scores
   `matchRatio` = share of pixels whose max |RGB diff| <= 24 (gate: >= 0.80 per section) plus a mean-abs-diff similarity.

Capture state, identical on both sides:
- virtual animation time: rAF / performance.now / Date replaced by an init script; every frame advances exactly 1/60 s
  and Date is pinned to 2026-11-12T02:00:00Z (status-row clock). Frames run freely while the page loads (freezing
  them during load stalled the WebGL page), the pump is frozen right after `load` + fonts, then both sides are
  advanced to the same ABSOLUTE frame (400) plus 600 settle frames, and 120 frames after every scroll, and the page is
  screenshotted while frozen, so every capture happens at an identical virtual time on both sides. What still differs is
  where inside the load phase components mounted (`loadFrames` is recorded per side), which only moves time-driven
  layers (sticker spawn/fall, model float), never scroll state.
- a 3 s real-time wait before each screenshot lets the scramble text (a real 40 ms interval) finish on both sides.
- Chromium runs with `--disable-gpu-vsync --disable-frame-rate-limit` (rAF otherwise follows the display link and
  throttles to <1 fps when the display sleeps); frame count, not rate, decides state.
- renderer: SwiftShader by default; `PARITY_ANGLE=<backend>` (e.g. metal) uses the hardware GPU. Both sides always
  share one renderer; the recorded run used the value shown in parity-results.json -> captureState.
- Math.random seeded; both weather endpoints aborted (no temperature on either side); no pointer, no clicks, no
  consent banner exists on the site; finite CSS animations completed by the screenshot call.
- Not masked: the WebGL backdrop's time/asset-load-driven regions (sticker spawn frame, bokeh noise). They are
  scored as they are and any section below the gate is diagnosed and recorded as an exception pending human approval.

Why not Playwright's fake clock: tried first; the live bundle never reached `load`/settled under it (its timer chains
starve the fake clock), so the harness drives animation frames itself instead.

Only `parity-results.json` (scores + geometry, no images, no copy) is tracked.
