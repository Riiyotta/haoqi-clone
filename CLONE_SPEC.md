Source: https://haoqi.design/

# CLONE_SPEC — haoqi.design (home `/`)

Measured with local Playwright (Chromium, 1440x900 and 390x844) plus a read of the production bundles saved in
`_reference/HAOQI©2026_files/`. Numbers come from computed layout or the bundle source. Anything I could not confirm is listed under **Open questions** at the end.
All GLSL is copied verbatim into **`SHADERS.md`**, and sections below refer to it by letter (A–J).

Bundle map (prettier-formatted copies were used for reading):
- `4d3f3b68dbbde33a.js` holds the home page component (`fB`), the whole R3F scene (`cV`), the hyper-space text section, the signature SVG and the ring SVG.
- `2689132c4e070b68.js` holds the shell: header/HUD (module 88106), ScrambleText (71358), grid overlay (13717), scroll progress bar (72443), work list (45556), footer (28192), theme (90975), sound/fonts (23525), pointer (16265), toggles (95428/96716), weather (50620) and the arrow-fullscreen store (1111).
- `3c6cc5b2fcccdee5.js` holds the Lenis wrapper (95212), the scroll bus (90270/29680) and the entry/route/menu dot-iris transition canvas (34841).
- `d59f7a97fb1c563f.js` holds `WORK_ITEMS` (83039) and the passcode label helpers (28116).
- `1098c2541054fc77.js` bundles three.js **r184**, **Lenis 1.3.23**, `customCubic` (29090) and postprocessing.

Screenshots (1440x900 unless noted) are in
`/private/tmp/claude-504/-Users-riyaghosh-portfolio-haoqi/4d002147-def2-4274-8452-e19efcf61dbe/scratchpad/recon3/`.
Each `sNNNNN.png` is named after the `.lenis` scrollTop it was taken at, every 450 px from 0 to 11419. The folder also has `load-0..7.png`, `zoom-cream.png`, `hover-mid.png`, `m-top.png` and `m-menu.png` (390x844, menu mid-transition).

---

## 1. Scroll mechanics

- **Library:** Lenis 1.3.23 through `lenis/react` `<ReactLenis>`. It only runs on `/`; other routes use a plain overflow div. Options:
  ```js
  { lerp: 0.1, smoothWheel: true, syncTouch: true, anchors: true, autoRaf: false }
  ```
  Every other option keeps the Lenis default: `wheelMultiplier 1`, `touchMultiplier 1`, `syncTouchLerp 0.075`, `touchInertiaExponent 1.7`, `duration`/`easing` unset (lerp mode), `orientation vertical`, `overscroll true`, `infinite false`.
  `autoRaf: false`: `lenis.raf(t)` is driven from R3F's frame loop through `addEffect` (`o.j` in the bundle), not Lenis's own rAF.
- **DOM structure:**
  `div.fixed.inset-0.w-full.h-full` > `div.w-full.h-full.overflow-y-auto.overscroll-contain.no-scrollbar.lenis` (the wrapper, also the scroll container) > content.
  `body` is `height:100%; overflow:hidden`, so `document.scrollHeight` is 900 and all scrolling happens inside `.lenis`.
- **Total length at 1440x900:** `.lenis.scrollHeight` = **12319**, clientHeight 900, so max scrollTop (`limit`) = **11419**. At 390x844, scrollHeight = 11301.
- **Scroll bus (module 90270):** each Lenis `scroll` event stores `{scrollTop, limit, progress = scrollTop/limit, velocity, direction, viewportHeight}` in a module-level store. React subscribers use `useSyncExternalStore`. The WebGL side reads `scrollEnv.getScrollTopPx()`, which returns Lenis's *animated* scroll.
- **Keyboard:** `T` smooth-scrolls to top and `B` to bottom (`lenis.scrollTo(edge, {force:true})`). `L`/`D`/`A` set the theme and `S` toggles sound (see §6). Keys are ignored when a modifier is held or focus is in an input.
- **Hash/anchor navigation:** WORK and CONTACT call `lenis.scrollTo('#selected-work' | '#contact', {lerp: 0.1})`.
  From another route, the target is stored in `sessionStorage['hq:pendingScrollAnchor']`, the app navigates to `/`, and on mount it runs `lenis.resize()` then `scrollTo(anchor, {lerp: 0.1, force: true})` after a rAF.
  A URL hash on load scrolls to `el.top - 96` with `immediate: true`.
- **Scroll restoration:** `history.scrollRestoration = 'manual'`. The page scrolls to 0 on load and on `pageshow` when `persisted` is true.

## 2. Section layout (`.lenis` content, document Y at 1440x900)

| # | Element | top | height | Notes |
|---|---|---|---|---|
| 0 | **banner** `div.grid.grid-cols-12.grid-rows-[auto_1fr].px-4.lg:px-14.py-18.lg:py-24.h-dvh.lg:h-screen` | 0 | 900 | Hero copy. Section name `"banner"` |
| 1 | **about** `div.grid.grid-cols-12.px-4.lg:px-14.py-18.lg:py-24.lg:pb-28` | 900 | 687 | Signature SVG plus an `aspect-square` placeholder; the photo `/img/m3.png` is drawn in WebGL |
| 2 | **`section#selected-work`** | 1587 | 2632 | 11 cards (one passcode card hidden). Each card image is a WebGL layer synced to a DOM placeholder |
| 3 | **hyper-space** `div.relative` with inline `height: 8*innerHeight` | 4219 | 7200 | Sticky inner `div.top-0.sticky.grid.grid-cols-12.grid-rows-6` with `min-height: innerHeight` |
| 4 | **`footer#contact`** `h-dvh lg:h-screen` | 11419 | 900 | |
| 5 | `div.top-0.left-0.-z-1.fixed.w-full.h-dvh.lg:h-screen` | — | — | Contains the R3F `<Canvas>` (the scene) |

Work cards at 1440 (document top / height / left / width):
- Reunimos: 1683 / 537 / 499 / 885
- Inspire Mono and Wasm: 2332 / 350, at left 56 and 720, width 553
- VectorSymbols and DarkSide: 2792 / 253, at left 609 and 1052, width 332
- aDrive, Shore Icon and Teambition: 3156 / 492, at left 56, 499 and 941, width 332
- FoF See Hear Touch and FoF Design System: 3759 / 364, at left 609 and 1052, width 332

The work grid `rowGap` = `gridClientWidth / 12` px, set from JS with a ResizeObserver. Each card's aspect-ratio comes from the loaded image's `naturalWidth / naturalHeight`, falling back to `1 / 1`.

## 3. Scene timeline (scrollTop in `.lenis` px at 1440x900; vh = 900)

Two global scalars drive almost everything:

**sP ("scene progress", 0..1)**, recomputed on every Lenis scroll:
```
bannerFactor = clamp((vh - (banner.y - t + banner.h)) / (vh - 0.25*vh), 0, 1)   // = t/675 for this layout
footerFactor = clamp((footer.y - t) / vh, 0, 1)                                 // = (11419 - t)/900
sP = bannerFactor * footerFactor
```
- sP = 0 at t = 0 and reaches 1 at t ≥ **675**.
- It stays 1 until t = **10519**, then falls back to 0 at t = 11419.
- sP drives the cream dot overlay opacity (B), camera distance, and render throttling.

**arrowFullscreen progress (0..1)** is the damped scale of the giant hyper-space cursor (`uStripeReveal`). When it is ≥ **0.5**, `useArrowFullscreenPastThreshold()` returns true and the header and hyper-space text switch from `text-l1` to `text-white`, using `transition-colors duration-300 ease-out`.

| Range (scrollTop) | State | HTML | WebGL |
|---|---|---|---|
| **0** | **Hero** (`s00000.png`) | Banner copy (§4.1), header HUD, grid overlay | Blue bokeh light-streak background (A), glass **hello** model, small glass blue **cursor** bottom-right, falling **stickers**, lens flare + fluid post. Dot overlay opacity 0 |
| 0 → 675 | **Hero → cream** | Banner scrolls away | Dot overlay (B) radius grows with sP: cream `#FBFAF4` dots of 4 px cells cover the bokeh into a solid cream with a faint 4 px grid (aliasing at cell edges = the "fine grid texture"). Camera z goes from 24 to 32 via `lerp(24, 32, sP)`. hello rotates Y 4° → 90° and drifts up at 0.72× scroll. Cursor spins Y 0° → 720° |
| ≥ ~610 (sP ≥ 0.9) | **Solid mode** | — | Lens flare off. Lime pointer trail turns on (not drawn in the hero). Fluid displacement off. At sP ≥ 0.985: bokeh pre-passes, stickers and the glass refraction FBO are skipped |
| 900 → 1587 | **About** (`s00897.png`) | Signature draws in (IntersectionObserver threshold 0.15), intro paragraphs | `/img/m3.png` layer: negative→positive reveal over 0.8 s when it enters the viewport |
| 1587 → 4219 | **Selected work** (`s01350`…`s03601`) | Cards: name/year/type rows, CODING PROJECT tag | One WebGL image layer per card (F): polarity reveal on enter, dotted hover wipe, velocity "curl" |
| ~2839 → | **Giant cursor appears** | — | Hyper-space cursor mesh (E) is mounted while the hyper-space section intersects with rootMargin 480 px, and is visible once `section.top < 900 + 480` |
| 3889 → 4789 | **Cursor zoom** (`s04050.png`) | "INNOVATE WITH PURPOSE" fades in per character at t ≥ 4039 (= 4219 − 0.2·900) | Cursor rises with the section top + 120 px until it reaches viewport centre at t = 3889, then stays there. Scale grows from 0.1 to the full-screen scale with `smoothstep(clamp((450 − (top + 120))/900))`, damped with λ = 32. Y spin goes 0 → 180° over the first 40 % of growth. Stripe reveal goes blue `#009dff` → black, and `iTime` ramps the warp speed |
| ~4500 | **Warp tunnel** (`s04500`, `s06300`) | Text goes white (threshold 0.5) | Cursor covers the screen; its shader paints radial warp lines (E). `iTime = 2*clamp((900 − top)/(900 + 7200))` runs from t = 3319 to t = 11419 |
| 4219 → 6018 | seg0-primary | "Innovate / with / purpose" | Warp |
| 6019 → 7818 | seg0-secondary | "Innovate / with a / human touch" (line 0 keeps its key, so "Innovate" stays; lines 1–2 re-stagger) | Warp |
| 7819 → 9618 | seg1 (`s09000.png`) | 4 floating sentence pairs + lime ring SVG (7 ellipses), progress = (t − 7819)/1800 | Warp, denser |
| 9619 → 11418 | end (`s09900.png`) | "FUTURE-FIRST / ALWAYS" (IntersectionObserver threshold 0.35, `once: false`) | — |
| 9949 → 10849 | **Cursor shrink** | Text turns back to `text-l1` once the reveal drops below 0.5 | Scale lerps from the full-screen scale to 0.1 with `1 − smoothstep(top, D, N)`, where D = −6630 and N = −5730. Spin goes 180° → 360° over the last 40 % of the shrink. Cursor stays centred, then scrolls up with the section bottom − 120 |
| 10519 → 11419 | **Back to blue** (`s10800.png`) | — | sP falls, the dot overlay dissolves, and the bokeh background and stickers return |
| 11419 (end) | **Footer / contact** (`s11419.png`) | "LET'S  CREATE / SOMETHING / EXTRAORDINARY", email, socials. HUD bottom-left switches to `HAOQI (C) 2026` when near the bottom (`limit − scrollTop ≤ 0.5·vh`) | Glass **cnt.gltf** ("CRAFT & TASTE" 3D lettering) rotates X −180° → 0° as the footer enters (t 10519 → 11419). Stickers, flare and bokeh are active again |

Hyper-space stage formula (from the code):
```
segH = section.h / 8
segmentIndex = clamp(floor(max(0, t - section.y) / segH), 0, 7)
stages: [0, 1] seg0-primary, [2, 3] seg0-secondary, [4, 5] seg1, [6, 7] end
```
- seg0 reveal (`play`) turns true when `t - y ≥ -0.2*segH` and false below that; each re-entry increments a stagger generation.
- seg1 ring progress = `clamp((t − y − 4*segH) / (6*segH − 4*segH), 0, 1)`.

## 4. HTML layer: JS-driven motion only (static styles come from the compiled CSS)

### 4.1 ScrambleText (`71358`, used for nearly every text)
Props and defaults: `startDelayMs 0`, `letterDelayMs 80`, `reverse false`, `scrambleColors true`, and `colors { light: ['#c0fe04', '#607F02'], dark: ['#c0fe04', '#DFFF81'] }`.

- **Start trigger:** `useHasEnteredViewport({threshold: 0.1, once: true})` must be true, and `allowScrambleLines` must be true. The route controller sets that flag after the transition reveals, with a 100 ms delay in the reveal phase.
- **Tick:** a single shared `setInterval` at **40 ms** drives all instances.
- **Per character** (index i in reading order, or reversed when `reverse`):
  - Let `n = i*letterDelay` and `V = elapsed − startDelay`. The character is hidden (`opacity: 0`) while `V < n`.
  - While `n ≤ V < n + 4*letterDelay`, it shows a **random char** from `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*+-=?/<>[]{}`, re-rolled every tick.
  - That random char is coloured `colors[min(1, floor((V − n)/(2*letterDelay)))]`: lime `#c0fe04` for the first half, then `#607F02` (light) or `#DFFF81` (dark). With `scrambleColors: false` there is no colour change.
  - After that the real character shows. Spaces are never scrambled.
- **Done:** total time = `startDelay + (len − 1)*letterDelay + 4*letterDelay`, after which the element renders plain text.
- **Before start:** the whole span is `opacity: 0`.
- Runs once per mount. There is **no hover re-scramble**; text only re-scrambles when the component remounts (theme/sound toggles do this by changing `key`).

Usages:
- Header logo "haoqi" + ".design": startDelay 300, letterDelay 80 (default), no colours.
- WORK / CONTACT: 300, 80, no colours.
- Hero "I bring" / "craft & taste" / "to digital work": startDelay 300 / 500 / 700, letterDelay 80, colours on.
- "Design &" / "Engineering" / "Thinking in systems. Designing with care.": 300, 10.
- Hero bio: 300, 10, with a slot part (below).
- Clock line, `Haoqi (c) YEAR` and the coords readout: 300, **40**, no colours.
- Footer "Let's" / "Create" (reverse) / "Something" / "Extraordinary" (reverse): 300, 80.
- Email and social links: 300, 80.

Hero bio text:
- "I'm Haoqi Wen, leading Design Engineering and AI exploration at " + **slot** + ", engineering, and AI at scale. Outside work, I build design tools for team efficiency."
- When locked, the slot is "■■■■■■": 6 spans, class `inline-block min-w-[0.62em] text-center text-l1 tabular-nums`, `role=button`; clicking goes to `/unlock/2026?return=/`.
- When unlocked, the slot is "TikTok", and long-press 500 ms or right-click relocks.

### 4.2 Hyper-space stagger text (`fr`, "HyperSpaceStaggerText")
- Each character is a `span.hsst-char` with `opacity: +!play`. Animation `hsstFadeIn` or `hsstFadeOut`, `0.23s linear forwards`.
- Delay = `(perCharDelay[i] + groupDelayMs) / 1000` s, where `groupDelayMs = 100 * lineIndex`.
- Per-char delays are deterministic. Seed = FNV-1a 32-bit (`0x811c9dc5`, multiplier `0x1000193`) of the text, or of `text + "\0out"` for the out-delays. The PRNG is mulberry32 (`+0x6d2b79f5`).
  ```
  delay_i = min(290, (i/(n-1))*290*0.7 + rand()*290*0.35)    // ms
  ```
- Keyframes (in the CSS):
  - `hsstFadeIn`: 0% → 0, 32% → .22, 62% → .55, 100% → 1
  - `hsstFadeOut`: 0% → 1, 38% → .62, 72% → .28, 100% → 0
- Typography:
  - seg0/end lines: `font-bold text-[7.2svw] lg:text-[6.8svw] uppercase leading-none`, `font-variation-settings: "wdth" 120`, centred in a 12×6 grid.
  - seg1 sentences: `font-medium text-[5.6svw] lg:text-3xl leading-tight p-2`, placed at col/row:
    - lg:col-start 7, row 2: "Building tomorrow's / digital products."
    - lg:col-start 9, row 3: "Independent by / design & engineering."
    - lg:col-start 2, row 4: "Clarity first. / Delight second."
    - lg:col-start 4, row 5: "Ship in small loops. / Aim for long arcs."
    - All are col-span 4 on lg.

### 4.3 Ring SVG in seg1 (`c7`)
- A 344×344 SVG, centred absolutely, `z-0`. Clip polygon `20,22 324,22 324,322 20,322`.
- 7 `<ellipse>` elements: `stroke #C0FE04`, width 2, `vector-effect: non-scaling-stroke`.
- `totalDist = 945` (enterSpan 300, cycleDist 300, exitSpan 345). `r = progress*945`. Phase 0 is enter (r ≤ 300), phase 1 is cycle (≤ 600), phase 2 is exit.
- Each ellipse k sits at local offset `l`:
  - enter: `i − (min(floor(i/50), 6) − k)*50`, visible only if `i ≥ 50k`
  - cycle: `((i + 50k) mod 300)`
  - exit: `i + 50k`
- Geometry: `cx = 172`, `cy = 22 + l`, `rx = sqrt(150² − (l − 150)²)`, `ry = 0.1*rx`. The ellipse is hidden when `l` is outside (0, 300) or duplicates another ellipse's `l` within 0.5.

### 4.4 Signature SVG (`fC`, about section)
- `viewBox 0 0 320 154`, `stroke #C0FE04`, 4 paths in order (path strings in the bundle; widths 4, 4, 4, 5).
- Class `-top-1/32 -left-1/12 absolute w-3/4 pointer-events-none`.
- Per path: `len = getTotalLength()`, `dur = len/720` s, delay starts at **0.5 s** and accumulates `dur + 0.03` s per path. `stroke-dasharray = stroke-dashoffset = len`.
- When `.is-drawing` is set: `svg-sign-show 0s linear var(--path-delay) forwards` (opacity 0 → 1) plus `svg-sign-draw var(--path-dur) cubic-bezier(0.65,0,0.35,1) var(--path-delay) forwards` (dashoffset → 0).
- Trigger: IntersectionObserver `{threshold: 0.15, rootMargin: '0px 0px -8% 0px', once: false}`. Leaving removes the class and resets it; re-entering redraws. Reduced motion shows it static.

### 4.5 Header / HUD (module 88106)
- **Header:** `header.z-50.fixed.inset-0.flex.flex-col.justify-between.font-mono-2.pointer-events-none`, coloured `text-l1`, or `text-white` past the arrow threshold.
- **Top row:** `px-4 lg:px-14 py-4 lg:py-7 text-base`.
  - Logo link: `p-2 font-sans font-bold uppercase`, `font-variation-settings: "wght" 700, "wdth" 120`, with the dotted border.
  - Nav: `hidden lg:flex ... gap-x-3 gap-y-2 basis-1/2 xl:basis-1/3`, containing WORK, CONTACT, `THEME[L|D|A]` and `SOUND[x]`, each `p-2 uppercase` with the dotted border.
- **Dotted border (all HUD buttons):** a `::before` overlay at `inset-0`, `border-2 border-dotted border-transparent`, `transition-colors duration-200`. On `lg:hover` the border becomes `l1`, or `white` when past the arrow threshold.
- **Bottom row:**
  - Left: `GMT+8 CN HH:MM` plus ` NN°C` (desktop) or `HH:MM NN°C` (mobile).
    - The clock uses the local `Date` and refreshes every 60 s.
    - Temperature comes from QWeather `https://devapi.qweather.com/v7/weather/now?location=101020100&key=…` (Shanghai), field `now.temp`. The full key is in the bundle.
    - Near the bottom of `/` (`limit − scrollTop ≤ 0.5·vh`), the left text is replaced by `Haoqi (c) {year}`.
  - Centre: `lg:fixed lg:bottom-7 lg:left-1/2 -translate-x-1/2 p-2`, text `${x4} X ${y4} Y`. Here `x = round(pointer.x * innerWidth)` and `y = round((1 − pointer.yUp) * innerHeight)`, each zero-padded to 4 digits; the default (no pointer) is 0720 X 0450 Y. Click scrolls smoothly to the top. It re-renders on every pointer change; ScrambleText has already settled by then, so updates are plain text.
  - Right: **RotatingGlobe**, a 48×24 SVG: ellipse rx 22 ry 11, equator `M2 12H46`, stroke `currentColor` width 1.
    - It fades in with opacity 300 ms ease after a 600 ms delay once in view.
    - 6 copies of the meridian half-arc `M24 23C11.8497 23 2 18.0751 2 12C2 5.92487 11.8497 1 24 1` each carry `<animateTransform type="scale" values="1 1;-1 1" dur="2600ms" calcMode="spline" keySplines="0.42 0 0.58 1" repeatCount="indefinite">`, staggered by `begin = -(2600*i/6) ms`.
- **Hint panel:** hovering THEME, SOUND or the coords opens it (pointer-enter count > 0). It is a framer-motion fade at opacity 0.4 s with ease `[0.25, 1, 0.5, 1]`, positioned `top-24`, right-aligned, `bg-be p-2 font-mono-2`.
  - Text: "Press [L] for light mode, [D] for dark mode, [A] for auto mode, or click THEME. Press [S] to pause or resume background music, or click SOUND; your choice is saved in this browser. [T] scroll to top, [B] scroll to bottom." (letterDelay 10, startDelay 0).
  - Below that: browser name and `W × H`.
- **Scroll progress bar (72443, desktop only):** `fixed right-0 top-1/2 -translate-y-1/2 w-14 px-3 h-50 z-30`, containing a 32×200 SVG.
  - Track: `M 16 6 V 194`, stroke-width 6, round caps, opacity 0.2.
  - Thumb: path `M 16 c V c+l`, where `l = max(20, 188*clientH/scrollH)` and `c = 6 + progress*(188 − l)`.
  - Visibility: it shows for 3 s on mount, then for 2 s after any scroll, with `transition-opacity duration-500`. Hover keeps it visible.
  - Interaction: click jumps there (non-immediate), and dragging the thumb scrolls with `immediate`.
  - Mobile replaces it with a circular "scroll to top" ring: 24 px, r = 12, dash = 2π·12, `scale-50 → scale-100` once scrollTop ≥ 36, `0.66s ease-66`.
- **Grid overlay (13717):** `fixed inset-0 z-20 pointer-events-none mix-blend-difference` SVG, hidden while the home loader is gating.
  - Gutter n = 16 below 1024 px width, else 56. Columns: 2 if width < 1280, else 3, giving 3 or 4 vertical lines at `round(n + i/cols*(W − 2n)) + .5`.
  - Rows: `h = H/3 − 12`. Vertical segments cover y 0..h, h+24..2h+24 and 2h+48..H, leaving 24 px gaps at the two horizontal lines `y = h + 12` and `y = 2h + 36`.
  - Horizontal lines leave a 12 px gap on each side of every column line.
  - Lines: stroke `rgba(255,255,255,0.1)`, width 1.
  - "+" marks at each intersection (±6 px): stroke `#FFFFFF`, opacity 0.4.
- **Mobile hamburger** (below 1024 px): a 24×24 box with 4 bars, `h-0.5 bg-l1` (or `bg-white` past the threshold), `transition-all duration-[1200ms] ease-66`.
  - Two horizontal bars sit at top-1.5 and bottom-1.5. Two diagonal bars (`rotate-45` / `-rotate-45`, top-2.75 / bottom-2.75) form the X.
  - Bar widths animate between `w-6` and `w-0` with `delay-150` crossovers.
  - The open menu is a full-screen `font-mono-2 text-[10svw]` list: Home (startDelay 300), Work (400), Contact (500).
  - The bottom row then shows THEME and SOUND.
  - Opening and closing runs the dot-iris transition (§7).

### 4.6 Theme and sound
- **Theme (90975):** state is `light`, `dark` or `system` (default `system`), stored in `localStorage.theme`.
  - The resolved theme is set as a class on `<html>` (`light` or `dark`). `system` follows `prefers-color-scheme` live.
  - Clicking cycles light → dark → system. The label is `THEME[L]`, `THEME[D]` or `THEME[A]`; it re-scrambles with startDelay 100 after a click (600 default, 300 in the header).
  - Keys: L / D / A.
  - Effects on WebGL: bokeh palette (A1/A6), dot overlay colour (`#0F1111` dark / `#FBFAF4` light), glass params, flare tail colour, transition mask colour.
- **Sound (23525):** `/bgm.mp3` is fetched as a blob and played by `new Audio`: `loop = true`, `volume = 0.35`. The setting defaults to on (`localStorage.sound` = `on` | `off`).
  - Because of autoplay policy, playback is attempted immediately and retried on the first `pointerdown`.
  - Label: `SOUND[x]`, where x cycles `| / - \` every **130 ms** while playing and is `·` when paused. letterDelay 80; it remounts and re-scrambles on toggle. Key: `S`.
- **Fonts:** loaded with the `FontFace` API in this order:
  - `tiktok` from `/fonts/TikTokSans.ttf`, weight 100–900
  - `mono` from `/fonts/GeistMono[wght].ttf`, weight 100–900
  - `tronica-mono` from `/fonts/DepartureMono-Regular.otf`, weight 400
  - All use `display: block`. Content stays `invisible` until `fontsReady`.

## 5. WebGL scene (`cV`, main canvas)

- **Canvas:** `<Canvas dpr={[1, 2]}>` with the default frameloop ("always"), mounted inside `fixed top-0 left-0 -z-1 w-full h-dvh lg:h-screen`.
- **Camera (`sx` = drei-style PerspectiveCamera, makeDefault):** initial position `[0, 0, 22]`.
  - The **horizontal** FOV is fixed: 60° at width ≥ 1024, else 38°. Vertical fov = `2·atan(tan(hfov/2)/aspect)`.
  - Each frame: `A = lerp(24, 32, sP)` and `z = lerp(A + 8, A, customCubic(k))`, where k ramps 0 → 1 over **1.2 s** once all assets are ready (intro dolly-in). `customCubic` = `cubic-bezier(0.66, 0, 0.01, 1)`, the same as CSS `--cubic-66`.
  - Mouse parallax (desktop only), with `ex = (0.5 − uv.x)*2` and `ey = (0.5 − uv.y)*2`:
    - offset `m = (ex*1.4, ey*1.4*0.6, 0)` and `lookAt` target `(−m.x*0.12, −m.y*0.12, 0)`
    - both are lerped per frame by 0.18 while the pointer is inside, or 0.05 after it leaves
    - camera.xy = base + m
  - Mobile: no parallax, `lookAt(0, 0, 0)`.
- **Section registry:** the names `banner`, each work href, `hyper-space` and `footer` map to DOM rects, which are re-measured on resize, font load and ResizeObserver.
- **Render throttling** (`sF`): with s = sP, the scene renders every 4th frame if s > 0.75, every 2nd if s > 0.5, else every frame. On mobile the glass FBO renders every 3rd frame. The bokeh pre-passes run every `max(sF, 2)` frames.

Render order and layers:
1. **Bokeh background (A, `sV`/`sz`).** Five ping-pong passes (vignette → swirl → sine → shatter → bokeh) into two RTs at **0.3× canvas size** (no depth), then the output shader (A6) on a fullscreen clip-space plane at `renderOrder -10`.
   - Skipped when sP ≥ 0.98.
   - Palettes:
     - light: bg `#ffead6`, vignette `#6196ff`, output `#acffb9`, outputMix .65, edge −.16
     - dark: bg `#2c4bd5`, vignette `#00000d`, output `#00344C`, outputMix .95, edge −.82
   - Colours lerp at 0.1 per frame on theme change.
   - Mouse: `uMousePos` lerps toward the pointer uv at 0.1 per frame, or back to the centre at 0.05 when outside; on mobile it is fixed at (0.5, −0.1).
   - `uPos` for vignette, shatter and bokeh is fixed at **(0.5, −0.1)**.
2. **Glass refraction FBO (`cu`).** Every throttled frame, while `banner` or `footer` is in the viewport and sP < ~0.985, the scene is rendered with `camera.layers.mask = 1` (everything except glass layer 10) into a **half-res** RT (0.5·w·dpr × 0.5·h·dpr, depth on). That texture is the glass `uTexture`.
3. **Glass models (`cp`, shader D, layer 10).** Loaded with GLTFLoader + DRACO (decoder `https://www.gstatic.com/draco/versioned/decoders/1.5.5/`). All meshes are merged (`mergeGeometries`) and re-centred on their bbox centre.
   - **Nested groups:** `group(position, visible)` › `group(rotationAxisTilt)` › `group(rotation, animated)` › `group(−tilt)` › `mesh(scale)`.
   - **Visibility:** only while the owning section is in the viewport.
   - **Y position** (`scrollSyncedWorldY`):
     ```
     y = (0.5 − sectionCenterDocY/vh)*worldH + (scrollTop/vh)*worldH*syncFactor
         + modelPosition.y + float
     ```
     where worldH = viewport height at the model's z, and float (desktop only) = `0.18*sin(1.2t) + 0.06*sin(0.6t)`.
   - **Rotation:**
     ```
     entry = clamp((t + vh − section.top)/vh, 0, 1)
     after = clamp(entry_raw − 1, 0, 1)
     target = lerp(lerp(before, rotation, entry), afterRotation, after)
     ```
     It is damped with `MathUtils.damp(λ = 6)`. No mouse tilt is applied to the models; the mouse moves the **light** (next item) and the camera parallax.
   - **Light:** `uLight = (x, y, lightZ 0.5)`. (x, y) orbit at radius √(4² + 9²) toward the pointer's angle on the z = 0 plane, damped by `1 − exp(−6·dt)`. The default angle is `atan2(9, 4)`.
   - **Instances:**

     | model | position | scale | rotation (deg) | before → after | syncFactor | section | tint A/B (light; dark) |
     |---|---|---|---|---|---|---|---|
     | `model/hello.gltf` | [−0.1, 0, 2] | 22 (19 on mobile) | [0, 4, 0] | before [0, 240, 0], after [0, 90, 0] | 0.72 | banner | theme tint (below) |
     | `model/cursor.glb` | [11.6, −4.2, −3] (mobile [6.6, −5.6, −3]) | 0.1 | [0, 0, 0], axis tilt [0, 0, 45] | after [0, 720, 0] | 0.72 | banner | `#009dff`/`#009dff`; `#64c3ff`/`#64c3ff` |
     | `model/cnt.gltf` | [0, 0, 0] | 19 | [0, 0, 0] | before [−180, 0, 0] | 1 | footer | `#FFFFFF`/`#009dff`; `#8e9dc4`/`#64c3ff` |

   - **Glass params (leva defaults):**
     - Shared: refractPower .72, chromaticAberration .14, specularStrength 1.2, loop 3 (capped at 2 on mobile; `uRgbRefraction = loop ≤ 3`), fresnelSideDir (−1, 1, −1).
     - **Light theme:** shininess 120, diffuseness .1, fresnelPower 1, fresnelStrength .24, brightness .78, contrast .9, gamma 1, saturation 1.2, tintMix 1, tint A `#009dff`, tint B `#ffffff`, thicknessMinAlpha 1, thicknessMaxAlpha .92.
     - **Dark theme:** shininess 100, diffuseness .05, fresnelPower 3, fresnelStrength .72, brightness .6, contrast .98, gamma 1, saturation 1.2, tintMix 1, tint A `#64c3ff`, tint B `#8e9dc4`, thicknessMinAlpha 1, thicknessMaxAlpha .4.
     - Fixed IORs: R 1.15, Y 1.16, G 1.18, C 1.22, B 1.22, P 1.22. `uTintLocalYRange` = the model's bbox Y range; `uTintEnabled` = 1.
4. **Stickers (`ul`, shader C).**
   - Textures: the 12 `/sticker_img/s_XX.png` files are packed into one canvas atlas (power-of-two size, 2 px padding).
   - Spawn: 12 particles at x ± 32/2, y = 24 + rand·24, z = rand(±2) − 6. Fall speed 1.8·(0.6..1.4) units/s; wind `sin(t·0.3 + phase)·(0.3 + rand·1.8)`.
   - Motion and fade: rotation speed ±0.8 rad/s, scale 1.4·aspect. Fade-in over the first 5 % of the 48-unit fall and fade-out over the last 10 %. They respawn with a 0.04–0.08 s stagger, avoiding duplicate textures.
   - **Click** (desktop; pointer moved < 4 px and held < 600 ms; no text selection; not in solid mode) spawns a burst of 12 at the clicked point on z = 0, emitted 0.04–0.08 s apart (max 384 live one-shots).
   - Skipped when sP is in refractive-opaque mode.
5. **Dot overlay (B, `s1`, renderOrder 10):** cream dots, opacity = sP, 4 px cells, radius 0.9·sP.
6. **Image layers (F, `cw`, renderOrder 20):** one fullscreen-quad material per DOM placeholder: `about` (`/img/m3.png`) plus every work item (`imageUrl`, `hoverImageUrl`).
   - **Rect:** `uRect = (left/W, 1 − (top + h)/H, w/W, h/H)` from the cached DOM rect, updated by the scroll delta each frame and fully re-measured every 12 frames.
   - **Visible range:** within ±0.25·vh of the viewport.
   - **Polarity reveal:** while in view, `p = min(1, p + dt/0.8)` and `uPolarityPositive = easeInOutCubic(p)`, so the image fades from an inverted negative to the true colours. It resets to 0 when out of view. Reduced motion sets it to 1.
   - **Hover:** pointerenter on the card's parent `<a>` ramps h over **0.42 s**, and `uHoverRevealProgress = 0.5 − 0.5·cos(π·h)`. This is an 18 px square-dot wipe from the centre to `hoverImageUrl`.
   - **Curl:** scroll speed is converted to `clamp(|Δscroll|/dt/800, 0, 1)`, smoothed (attack τ .025 s, release .175 s) and multiplied by **0.06**, then fed to `uCurlStrength` (barrel-squeeze of x by y).
   - Textures: sRGB, clamp, anisotropy min(8, max) (4 on mobile), mipmaps unless a hover image exists.
7. **Hyper-space cursor (E, `cx`, renderOrder 12).** Uses `model/cursor.glb`, centred, rest scale 0.1, axis tilt [0, 0, 45], `scaleSpinDegrees` 180, refMarginPx 120, scaleSmoothing 32.
   - Peak scale = `hypot(viewportW, viewportH at z = 0) * 1.64 / boundingRadius`. The ellipse full math is in §3.
   - Writes `arrowFullscreenProgressStore.setDampedScaleT(reveal)`.
   - Mounted only while the hyper-space section intersects with rootMargin `480px 0px`.
8. **Post (`cG`, EffectComposer: multisampling 0, UnsignedByteType, renderPriority 998).**
   - **LensFlarePass (I):** flare RT at 0.5×, recomputed every 2nd frame. Enabled only when banner or footer is in view and not in solid mode.
   - **FluidPushPass (H):** sim resolution 160 on the short side, 4 pressure iterations, dissipation 3, curl 0, splat radius .003, splat force 3000, displacement 1, chromatic boost .5. The **fluid** is enabled only when on desktop, motion is allowed, not in solid mode, and the pointer moved in the last **600 ms**. Pointer delta decays ×0.9 per frame when the pointer is idle or outside.
   - **Lime pointer trail** (in the H7 display shader): enabled only in solid mode (sP ≥ 0.9 on, ≤ 0.82 off).
     - It is a **16 CSS-px** cell, `#c0fe04`, dot radius .8, snapped to the 16 px grid, with a 14-cell trail.
     - When the pointer moves into a new cell, the trail shifts. Strength decays with `damp(λ = 2)`.
     - This is the "lime square cursor follower"; it is **WebGL, not DOM**.
9. **Loading gate:** progress = (models ready [hello, h_star, cnt] + image textures ready) / total. Models count as ready after 5 frames.
   - The entry loader bar (`3c6cc` `b`): 140×6 px, rounded, `bg-l3` track, `bg-l1` fill, width transition `520ms cubic-bezier(.22,1,.36,1)`.
   - It shows `50% fonts + 50% assets`. At 100 %: wait 250 ms → fade the bar (opacity `250ms cubic-bezier(.25,1,.5,1)`) → after another 250 ms start the reveal.

## 6. Interactions / links
- **WORK** → `lenis.scrollTo('#selected-work', {lerp: .1})`. **CONTACT** → `#contact`. The logo on `/` scrolls to 0 with lerp .1. The coords readout scrolls to top (smooth).
- **Internal card links:** `/reunimos`, `/inspire_mono`, `/wasm_design_utils`, `/adrive`, `/shore_icon`, `/teambition`. They use the custom Link, which runs a route transition: dot-iris cover, then `router.push`, then reveal.
- **External cards** (`target=_blank`): VectorSymbols `https://www.figma.com/community/plugin/1255914175202017737/vectorsymbols`, DarkSide `https://www.figma.com/community/plugin/986289377230504703/darkside`, FoF See Hear Touch `https://friends.figma.com/events/details/figma-shanghai-presents-see-hear-touch/`, FoF Design System `https://friends.figma.com/events/details/figma-shanghai-presents-design-system/`.
- **Passcode card:** `/2026` ("TikTok", `/work/tt01.png`/`tt02.png`) is hidden unless unlocked. It is not in the saved DOM and its assets were **not** downloaded.
- **Card markup:** `a.group.block.space-y-3.p-2`, containing:
  - the image placeholder; when `codingProject`, it holds an `absolute top-0 right-0 bg-selection px-1 font-mono-2 text-black text-xs uppercase` "Coding Project" tag
  - a row `flex justify-between text-xs lg:text-sm uppercase`: name, then year (font-mono-2, tabular-nums) and, unless type is `post`, `type ↗` (lg only)
- **Card hover** is only the WebGL dot-wipe image swap; the DOM has no hover style.
- **Footer links** (`font-mono-2 text-sm lg:text-base`, dotted border): `mailto:curiosity.wen@gmail.com`, `https://twitter.com/wenhaoqi`, `https://www.figma.com/@wenhaoqi`, `https://github.com/wenhaoqiasd`.
- **Bio inline links:** reunimos™ `https://reunimos.cc`, aDrive `https://www.alipan.com/`, Teambition `https://www.teambition.com/`. Each is underlined with `underline-offset-[0.08em]` and `decoration-(--label-3)`, changing to `--label-1` on hover over 150 ms ease-out.

## 7. Dot-iris transition canvas (`3c6cc` 34841)
- A separate `<Canvas>` (`frameloop="demand"`, `dpr [1, 2]`, `alpha`, no AA/depth/stencil), class `z-30 fixed inset-0 pointer-events-none`. It is mounted during entry, route changes and the mobile menu, and unmounted when idle.
- A fullscreen plane (J) draws the theme surface colour (`#efede7` light / `#191b1b` dark) with a radial hole. `uHoleRadius = lerp(R, 0, p)` where `R = sqrt(max(a, 1/a)² + 1)`.
- `p` animates toward `open ? 1 : 0` over **0.8 s** with customCubic; the last 8 % fills the pinhole.
- An EffectComposer `MaskedDotsEffect` (pixelSize 16·dpr) converts the mask alpha to dot size, giving a halftone iris.
- Sequences:
  - Entry: starts covered (`initialProgress = 1`), then reveals (opens the hole) once fonts and heavy assets are ready.
  - Route: covers, then push, then waits for load, then reveals.
  - Mobile menu: covers while open (`m-menu.png`).

## 8. Mobile (390x844)
- `useIsMobile` = width < 1024.
- **Camera:** hfov 38°.
- **Models:** hello scale 19, cursor at [6.6, −5.6, −3], no model float, no camera parallax, the glass light does not follow the pointer, glass loop ≤ 2.
- **Effects:** no fluid, no sticker click bursts. The flare streak scale is ×2. Bokeh mouse is fixed at (0.5, −0.1).
- **Hero order:** headline first (`order-1`), meta block `order-2` with only the bio (`mt-auto`); "Design & Engineering" and the "Thinking…" line are `hidden lg:block`.
- **Grid overlay:** gutter 16, 2 columns.
- **HUD:** nav is replaced by the hamburger; the bottom row shows `HH:MM NN°C`; the coords readout and globe are hidden; the progress bar is replaced by the circular to-top button.
- Total scroll height is 11301 (hyper-space = 8·844).

## Open questions / not determined
1. **Model internals:** I did not inspect GLTF node structure, vertex counts or embedded materials, because every mesh is merged and rendered with the custom glass shader, so the source materials are ignored.
2. **hello rotation:** the `beforeRotation [0, 240, 0]` for hello is never visible on `/`. The banner's entry factor is always 1 at load, so it starts at [0, 4, 0]; the camera dolly is the only intro motion.
3. **Leva values:** the controls (`sh`/`l$` = leva `useControls`/`folder`; panel rendered `hidden`) may have been tuned live on the site. I used the **defaults in code** above.
4. **Weather:** the QWeather request needs that API key. Without it, only `GMT+8 CN HH:MM` shows.
5. **Headless rendering:** screenshots were taken with SwiftShader, so flare and bokeh intensity may differ slightly from a GPU render. The hover screenshot did not capture the dot-wipe mid-state (`hover-mid.png` shows only the lime pointer cell).
6. **Unread shader internals:** I did not read the internals of the bokeh pre-pass shaders (A1–A5) beyond their uniforms. They are copied verbatim, so porting them as-is should give a match.
