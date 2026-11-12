Source: https://haoqi.design/

# CLONE_SPEC_PAGES: haoqi.design project subpages

Pages covered: `/reunimos`, `/inspire_mono`, `/wasm_design_utils`, `/adrive`, `/shore_icon`, `/teambition`, plus the 404 page. `/2026` and `/unlock/*` are out of scope.

This spec extends `CLONE_SPEC.md` (home `/`). Anything shared with home (the header/HUD in §4.5, ScrambleText in §4.1, theme/sound in §4.6, the dot-iris transition in §7) is not repeated; only the differences are listed.

**How this was measured.** Local Playwright 1.63 (Chromium with SwiftShader) at 1440x900, 390x844 and 1920x1080, light theme (`prefers-color-scheme: light`, `THEME[A]`). Numbers come from `getComputedStyle`/`getBoundingClientRect` after ScrambleText settled, or from the production bundles. "y" values are document Y inside the scroll container (i.e. `rect.top + scroller.scrollTop`).

**Files**
- `_reference/pages/<slug>.html`: cleaned, settled scroll-container HTML (TOC `<nav>`, if any, plus `<article>`) for each page at 1440x900. `_reference/pages/404.html` is the not-found page.
- `_reference/pages/4d1355f59cfb8a8f.js` and `5a5e6e9b81eb690e.js`: the two JS chunks that only load on subpages. Prettified copies are in `scratchpad/pretty-pages/`, along with prettified copies of the home-chunk files `7cc1924554447827.js`, `ee513d663d42744e.js` and `1552c7742c37f06d.js` that had not been prettified before.
- Screenshots are in `/private/tmp/claude-504/-Users-riyaghosh-portfolio-haoqi/4d002147-def2-4274-8452-e19efcf61dbe/scratchpad/recon-pages/`:
  - `d-<slug>-sNN.png` (1440, one per viewport of scroll) and `m-<slug>-sNN.png` (390)
  - `x-<slug>-top.png` (1920, shows the TOC)
  - `trans/` (home→subpage and subpage→home frames)
  - `misc/` (lightbox in light/dark, dark theme page, mobile menu on a subpage)

**Bundle map (subpage-only code)**
| Chunk | Module | Export | Purpose |
|---|---|---|---|
| `4d1355f59cfb8a8f.js` | 54450 | `ArticleFooter` | "Metadata" + "Links" box |
| | 71289 | `MdxA` | Link renderer (internal links use the transition Link) |
| | 46318 | `MdxImg` | Figure + zoomable image + lightbox, with inlined `@wenhaoqi/wasm_design_utils@0.2.0` (extract-colors + OKLCH WASM, base64-inlined) |
| | 93325 | `MdxPre` | Code block. Bundles prism-react-renderer with a patched `prismjs@1.29.0` and all its themes; the default theme `An` = vsDark is used |
| `5a5e6e9b81eb690e.js` | 31250 | `MdxH1..MdxH6`, `MDX_HEADING_ANCHOR_OFFSET_PX = 96`, `scrollToMdxAnchorTarget` | Headings |
| | 78825 | `MdxTableOfContents` | Left-hand table of contents |

The page component, the title block, the intro wrapper, the image grid and the download button are **server components** (RSC). They exist only as HTML in the payload and are not in any client JS chunk, so the markup in `_reference/pages/*.html` is the source of truth for them.

**CSS.** Subpages load **no extra CSS chunk**. The only stylesheet is `/_next/static/chunks/635eb04122aa774f.css`, which is byte-identical to `src/styles/original.css` (checked with `cmp`). I collected all 310 distinct class tokens used on the six pages, the 404 page and the TOC, then checked each one (`CSS.escape`d) against `original.css`. **Every Tailwind class is present.** The only 28 "missing" tokens are Prism token classes (`token`, `keyword`, `punctuation`, `language-js`, etc.), which have no CSS rules on the original either; their colours come from inline styles (§1.7.8).

Relevant non-utility rules already in `original.css`:
```css
iframe{max-width:100%;box-shadow:0 0 0 1px var(--line);background-color:rgba(var(--label-d),.05);border:0;border-radius:var(--radius-xl)!important}
[data-mdx-image-grid]{grid-template-columns:repeat(var(--mdx-image-grid-cols,1),minmax(0,1fr))}
@media (min-width:1024px){[data-mdx-image-grid]{grid-template-columns:repeat(var(--mdx-image-grid-cols-lg,2),minmax(0,1fr))}}
/* --code-* vars per theme (light :root / .dark), with lab() overrides in @supports */
```

---

## 1. Shared subpage template

### 1.1 Shell, scroll container, and the absence of WebGL
- **Scroll wrapper (`3c6cc` module 95212).** The wrapper `div.fixed.inset-0.w-full.h-full` picks its child by `pathname === "/"`. On `/` the child is `<ReactLenis>`; on **every other route** it is a plain `div.w-full.h-full.overflow-y-auto.overscroll-contain.no-scrollbar`.
  - The plain div is registered as `scrollEnv` container (`setContainerEl`), and **no Lenis runs**. Scrolling is native, the scrollbar is hidden, and `touch-action: pan-y` comes from `.no-scrollbar`.
  - `scrollEnv.lenisScrollTo(n, opts)` falls back to `container.scrollTo({top:n, behavior: opts.immediate ? 'auto' : 'smooth'})`. String targets such as `'#contact'` are ignored when Lenis is absent.
  - `scrollToEdge` (`T`/`B` keys, coords click) uses `container.scrollTo({behavior:'smooth'})`.
- **Scroll restoration:** the same effect as on home. `history.scrollRestoration='manual'`. When the container element changes (e.g. `/` → subpage swaps the Lenis wrapper for the plain div), and there is no hash, it does `scrollTo(0)` and repeats it in the next rAF. It also does this on `pageshow` when `persisted`.
- **Hash on load:** after two rAFs, it scrolls to `el.top − container.top + scrollTop − 96` with `immediate`. Measured: loading `/adrive#ads-架构` puts the heading at viewport y = 96.0.
- **No WebGL or canvas on subpages.**
  - After the entry or route transition finishes, `document.querySelectorAll('canvas').length === 0`. The dot-iris canvas exists only while a transition runs.
  - The home R3F scene is part of the home page component, so it **unmounts** on navigating away.
  - There is no background canvas and no image shader; images are plain `<img>`.
- **Grid overlay (13717) is not rendered on subpages.** No fixed `mix-blend-difference` SVG exists. The only fixed SVGs are the globe, the progress bar and the mobile to-top ring.
- **Body:** `background: rgb(var(--background-deep))`, which is `#FBFAF4` light (rgb 251,250,244) or `#0F1111` dark. Default text is `--label-1`.
- **Fonts-ready gate (82536):** content is wrapped in `div` with `invisible pointer-events-none select-none` + `aria-hidden` until `fontsReady`, the same as on home.

### 1.2 Header / HUD on subpages (module 88106, same component as home)
The header DOM is identical to home (full captured markup in `scratchpad/recon2/reunimos.html`). The differences are behavioural:
- **Logo** `a[href="/"]` is the transition Link (80894) and runs the route transition to `/`. Home then starts at scrollTop 0. The `x === pathname` short-circuit (`lenisScrollTo(0)`) only applies on `/`.
- **WORK / CONTACT** (`<button>`s) call `ti(anchor)`:
  ```js
  setMenuOpen(false);
  pathname === "/" ? scrollEnv.lenisScrollTo(anchor, {lerp: .1})
                   : (sessionStorage.setItem("hq:pendingScrollAnchor", anchor), startNavigation("/"));
  ```
  The anchor is `#selected-work` or `#contact`. They are buttons, not `<a href="/#...">`. See §2.4 for the rest of the flow.
- **Bottom-left text** stays `GMT+8 CN HH:MM NN°C` (desktop) or `HH:MM NN°C` (mobile) at all scroll positions. The `Haoqi (c) YEAR` swap is gated on `"/" === pathname && useNearBottom(.5)`, so it never appears on subpages (verified at page bottom).
- **Coords readout** (`0720 X 0450 Y` default) is present. Clicking it calls `scrollEnv.scrollToTop("smooth")`, which is native smooth scroll of the container.
- **Globe** is present.
- **Scroll progress bar (72443)** works on subpages. It listens to the container's native `scroll` event (`subscribeScrollTopPx` attaches to `getContainerEl()`). The thumb uses `container.scrollHeight/clientHeight`. Visibility: 3 s on mount, then 2 s after each scroll.
  - On `/teambition` at 1440x900, `scrollHeight == clientHeight` (900), so the page does not scroll.
- **Mobile to-top ring** appears once `scrollTop ≥ 36`, as on home.
- **Mobile menu** on a subpage (`misc/m-menu-sub.png`):
  - Same full-screen `text-[10svw]` list: HOME (Link to `/`, startDelay 300), WORK (400) and CONTACT (500). WORK/CONTACT use the same `ti()` pending-anchor flow.
  - The bottom row shows the clock, `THEME[A]` and `SOUND[x]`.
- The header persists across route changes because it is in the root layout. It does **not** re-scramble on navigation (confirmed in the transition frames). It only re-scrambles on theme/sound toggles (key remount), as on home.

### 1.3 DOM structure (exact classes)
```html
<div class="fixed inset-0 w-full h-full">
  <div class="w-full h-full overflow-y-auto overscroll-contain no-scrollbar">        <!-- scroll container -->
    <!-- only when the article has h1/h2/h3 with ids (wasm_design_utils, adrive, shore_icon) -->
    <nav aria-label="本页目录" class="pointer-events-auto fixed inset-y-0 left-0 z-20 hidden min-h-0 w-[320px] flex-col overflow-hidden 2xl:flex pl-14 pr-2">…</nav>   <!-- §1.8 -->
    <article data-mdx-article="true" class="mx-auto px-6 py-18 lg:py-24 w-full max-w-[880px] text-l1">
      <div class="space-y-4 [&_p]:text-sm [&_p]:text-l1 [&_p]:leading-relaxed lg:[&_p]:text-base [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:my-0 [&_ul]:space-y-0 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:my-0 [&_ol]:space-y-0 [&_li]:text-l1 [&_li]:leading-relaxed [&_li::marker]:text-[var(--selection-bg)] [&_blockquote]:border-l-4 [&_blockquote]:border-[var(--selection-bg)] [&_blockquote]:pl-4 [&_blockquote]:text-l2 [&_blockquote_p]:text-l2 [&_blockquote_li]:text-l2 [&_blockquote_strong]:text-l2 [&_blockquote_em]:text-l2 [&_blockquote_a]:!text-l2 [&_blockquote_a]:underline [&_blockquote_a]:underline-offset-4 [&_blockquote_a]:decoration-[color:var(--label-3)] [&_blockquote_a]:transition-colors [&_blockquote_a]:lg:hover:!text-l1 [&_blockquote_a]:lg:hover:decoration-[color:var(--label-2)] [&_:not(pre)>code]:rounded [&_:not(pre)>code]:bg-[rgba(var(--label-d),0.08)] [&_:not(pre)>code]:px-1.5 [&_:not(pre)>code]:py-0.5 [&_:not(pre)>code]:font-mono [&_:not(pre)>code]:text-[0.9em] [&_:not(pre)>code]:text-l1 [&_hr]:my-8 [&_hr]:h-px [&_hr]:w-full [&_hr]:border-0 [&_hr]:bg-line [&_u]:no-underline [&_u]:pb-[6px] [&_u]:[box-decoration-break:clone] [&_u]:[-webkit-box-decoration-break:clone] [&_u]:[background-image:radial-gradient(circle_at_center,var(--color-l2)_0.65px,transparent_0.7px)] [&_u]:[background-size:5px_3px] [&_u]:[background-repeat:repeat-x] [&_u]:[background-position:left_bottom]">
        <header class="pt-[10vh]">
          <h1 class="font-bold text-3xl! text-l1 lg:text-5xl! leading-tight tracking-tight" style="font-variation-settings:&quot;wdth&quot; 120">{title}</h1>
          <p class="mt-1 tabular-nums text-l2! text-sm! lg:text-base! leading-relaxed">{updated, "MMM DD, YYYY"}</p>
          <div class="mt-2 border-line border-b"></div>
          <p class="pt-3 text-l2! text-sm! lg:text-base! leading-relaxed">{years}</p>        <!-- omitted when no years (adrive) -->
        </header>
        <div class="[&_p+p]:mt-3 [&_p]:mb-0 text-l2 [&_p]:text-l2! text-sm lg:text-base leading-relaxed"><p>…intro…</p>…</div>
        …MDX body nodes (direct children: p, h1-h3, ul/ol, hr, span[data-mdx-figure], div[data-mdx-image-grid], div.group(code), a[download], iframe)…
        <footer data-mdx-footer="true" class="bg-[rgba(var(--label-d),0.03)] mt-16 p-4 lg:p-6 rounded-xl">…</footer>   <!-- §1.9 -->
      </div>
    </article>
  </div>
</div>
```
- Vertical margins between prose children **collapse** (normal block flow), so the gap is the max of the previous child's bottom margin and the next child's top margin. For example, intro mb 16 followed by MDX h1 mt 56 gives a 56 px gap.
- `space-y-4` (Tailwind v4) puts `margin-block-end: 16px` on every child except the last. A child's own `my-*` overrides it: figures and code blocks are `my-6` (24/24), `ul`/`ol` are `my-0`, so the paragraph after a list sits flush against it.
- `<title>` is the page title only, e.g. `Reunimos™` or `aDrive 阿里云盘`, with no site suffix. `<html lang="en">`.

### 1.4 Layout numbers
| | 1440x900 | 390x844 | 1920x1080 |
|---|---|---|---|
| article | x 280, width 880, padding 96/24 | x 0, width 390, padding 72/24 | x 520, width 880 |
| content column (prose) | x 304, width 832 | x 24, width 342 | x 544, width 832 |
| header `pt-[10vh]` | 90 px | 84.4 px | 108 px |
| h1 title top (doc y) | 186 | 156.4 | — |

Title block, desktop / mobile:
- **h1:** TikTok Sans (`tiktok`), bold 700, `font-variation-settings: "wdth" 120`. 48/60 px with letter-spacing −1.2 px (`text-5xl` + `leading-tight` 1.25, `tracking-tight` −0.025em) on desktop; 30/37.5 px with −0.75 px on mobile. Colour `--label-1`.
- **Date p:** `mt-1` (4 px), 16/26 desktop, 14/22.75 mobile, `--label-2` = `rgba(54,54,48,.6)` light, `tabular-nums`.
- **Divider:** `mt-2` (8 px), 1 px bottom border `--line` = `rgba(54,54,48,.1)` light.
- **Years p:** `pt-3` (12 px), the same type as the date.
- **header margin-bottom:** 16.
- At 1440, h1 y 186 h 60, date y 250 h 26, divider y 284, years y 285 h 38; the intro starts at y 339.

### 1.5 Body typography (computed)
| Role | Desktop (≥1024) | Mobile | Colour | Notes |
|---|---|---|---|---|
| Intro `p` (first `div` after header) | 16/26, w400 | 14/22.75 | `--label-2` | `p+p` margin-top 12, mb 0. Wrapper mb 16 |
| Body `p` | 16/26 | 14/22.75 | `--label-1` (#000 / #fff) | mb 16 |
| `li` | 16/26 at **both** widths | 16/26 | `--label-1` | Lists get no `text-sm` (only `p` does). `ul` disc / `ol` decimal, `padding-left` 20, `my-0`, marker colour `var(--selection-bg)` `#c0fe04` (lime) |
| `strong` | 700 | 700 | inherit | |
| inline `code` (`:not(pre)>code`) | Geist Mono (`mono`) 14.4/23.4 (0.9em) | 12.6/20.475 | `--label-1` on `rgba(label-d,.08)` | padding 2/6, radius 4 px |
| link (`MdxA`) | inherits size | | `--label-1` | `underline`, `text-underline-offset: 4px`, decoration colour `--label-3` (`rgba(54,54,48,.32)`). On `lg:hover` the decoration becomes `--label-2`. `transition-colors` 150 ms `cubic-bezier(.4,0,.2,1)` |
| `hr` | 1 px, `my-8` (32/32) | same | bg `--line` | |
| MDX h1 | 28/35, w600, ls −0.7, mt 56 | 24/30, ls −0.6, mt 48 | `--label-1` | `mb` 16 from space-y |
| MDX h2 | 24/30, ls −0.6, mt 48 | 20/25, ls −0.5, mt 40 | | |
| MDX h3 | 20/27.5, ls −0.5, mt 40 | 18/24.75, ls −0.45, mt 32 | | |
| MDX h4–h6 (unused) | h4 18/24.75 mt 32; h5 17px snug mt 28; h6 16 mt 24 | h4 16 mt 28; h5 14 mt 24; h6 14 uppercase tracking-wide mt 24 | | From the class table in 31250 |

Heading class (31250):
```
group relative scroll-mt-24 font-semibold tracking-tight text-l1 [&:first-child]:mt-0 + {
 1: "mt-12 text-2xl leading-tight lg:mt-14 lg:text-[28px]",
 2: "mt-10 text-xl leading-tight lg:mt-12 lg:text-2xl",
 3: "mt-8 text-lg leading-snug lg:mt-10 lg:text-xl",
 4: "mt-7 text-base leading-snug lg:mt-8 lg:text-lg",
 5: "mt-6 text-sm leading-snug lg:mt-7 lg:text-[17px]",
 6: "mt-6 text-sm leading-snug uppercase tracking-wide lg:mt-6 lg:text-base lg:normal-case lg:tracking-normal" }
```

**CJK handling.**
- There is no CJK webfont and no CJK-specific CSS. The stack is `"tiktok", sans-serif`, and Han glyphs fall back per character to the OS font. On macOS, `CSS.getPlatformFontsForNode` reports **PingFang SC** (Regular in body text, Semibold in headings/h1). Latin glyphs in the same run stay TikTok Sans.
- `letter-spacing` is `normal` for body text and `-0.025em` for headings, applied to CJK too. There is no `word-break`, `line-break` or `text-autospace` override, so the browser defaults apply.
- Body text uses full-width CJK punctuation (`：`, `，`, `「」`, `（）`) straight from the content.
- One paragraph in `/inspire_mono` contains a literal `\n` (MDX soft break). It renders as a single space because `white-space: normal`.

### 1.6 Colours (CSS vars from `original.css`)
| Token | Light | Dark |
|---|---|---|
| `--label-1` | `rgba(0,0,0,1)` | `rgba(255,255,255,1)` |
| `--label-2` | `rgba(54,54,48,.6)` | `rgba(230,232,232,.6)` |
| `--label-3` | `rgba(54,54,48,.32)` | `rgba(230,232,232,.32)` |
| `--label-4` | `rgba(54,54,48,.18)` | `rgba(230,232,232,.16)` |
| `--line` | `rgba(54,54,48,.1)` | `rgba(230,232,232,.08)` |
| `--background-1` (body) | `#FBFAF4` | `#0F1111` |
| `--selection-bg` | `#c0fe04` | same |
| code `--code-comment` / `string` / `number` / `keyword` / `function` / `tag` / `operator` | `rgba(label-d,.45)` / `#00784a` / `#8a6a00` / `#5e53e3` / `#0077bc` / `#c0434c` / `rgba(label-d,.75)` | `rgba(label-d,.5)` / `#80daac` / `#ebc669` / `#afb6ff` / `#8dcbff` / `#ffa3a3` / `rgba(label-d,.85)` |

Element backgrounds:
- Metadata box and code block: `rgba(label-d,.03)`, i.e. light `rgba(54,54,48,.03)`.
- Image: `rgba(label-d,.05)`.
- Inline code: `.08`.
- Download button: `--line`.

### 1.7 MDX components

#### 1.7.1 Headings (`MdxH1..6`, 31250)
- **id:** the explicit `id`, or a slug of the text:
  ```js
  text.trim().toLowerCase().replace(/[\s　]+/g,"-").replace(/[^\w一-鿿-]+/g,"").replace(/-{2,}/g,"-").replace(/^-+|-+$/g,"")
  ```
  CJK is kept: "三个模块，按需引入" → `三个模块按需引入`, "Next.js 注意" → `nextjs-注意`.
- **Markup:** `<hN id class> <a href="#{encodeURIComponent(id)}" aria-label="Copy link to {text}" class="relative inline-block text-inherit no-underline"><span aria-hidden="true" class="absolute top-0 right-full mr-2 hidden text-l3 opacity-0 transition-opacity select-none lg:inline lg:group-hover:opacity-100 lg:hover:text-l1">#</span>{text}</a></hN>`
- **Hover (≥1024 only):**
  - A `#` hangs in the left gutter, `right-full` + `mr-2`, in `--label-3` at the heading's size. At 1440 it sits at x 277.7 for h1 and x 280.3 for h2.
  - It fades in to opacity 1 on heading hover (150 ms) and turns `--label-1` when the `#` itself is hovered.
  - It is hidden below lg.
- **Click:** `preventDefault`, then `scrollToMdxAnchorTarget(el)`, which does `container.scrollTo(el.top − container.top + scrollTop − 96, smooth)` (Lenis `lerp .1` if Lenis existed). Then `history.replaceState(null,"","#id")` and `navigator.clipboard.writeText(origin+path+search+hash)` (errors swallowed).

#### 1.7.2 Links (`MdxA`, 71289)
Class: `text-[color:var(--label-1)] underline underline-offset-4 decoration-[color:var(--label-3)] transition-colors lg:hover:decoration-[color:var(--label-2)]`.
- `#…` → plain `<a>` whose click smooth-scrolls (same as headings) and calls `replaceState`.
- `//…` → `https:` + `target=_blank rel="noopener noreferrer"`.
- `http(s)://…` → `_blank`.
- `mailto:` / `tel:` → plain `<a>`.
- `/…` → the transition Link (80894), so a click runs the dot-iris route transition. Examples: `/reunimos` on the wasm page, `/stories/figma_and_me#vectors` on the shore page (that route 404s; see §5).
- Anything else → `_blank`.

#### 1.7.3 Images (`MdxImg` + zoomable image, 46318)
```html
<span data-mdx-figure="true" class="my-6 block w-full">
  <img src alt crossorigin="anonymous" loading="lazy" decoding="async"
       class="block w-full h-auto cursor-zoom-in select-none border border-line bg-[rgba(var(--label-d),0.05)]" style="opacity:1">
  <!-- only if the markdown image has a title (none of the six pages do): -->
  <span data-mdx-caption="true" class="mt-1.5 block text-center text-[14px] leading-relaxed text-l2">{title}</span>
</span>
```
- Width is 100% of the column with height auto, so the natural aspect is preserved. There is a 1 px `--line` border on all sides and `bg rgba(label-d,.05)` behind transparent or loading pixels.
- The `<img>` is a framer-motion `motion.img` with `layoutId="zoomable-image-{useId}"`. There is **no load/reveal animation**: images appear as decoded.
- The captions seen on `/adrive` and `/shore_icon` are **ordinary `<p>` paragraphs** after the figure, not `data-mdx-caption`. Their text often repeats the alt.
- **Lightbox** (click the image):
  - Portal to `document.body`: `motion.div.z-1000.fixed.inset-0.isolate.flex.justify-center.items-center.overflow-hidden.cursor-zoom-out` with `role=dialog aria-modal aria-label={alt}`. It contains:
    - a backdrop `motion.div.z-0.absolute.inset-0.backface-hidden` with opacity 0→1 over **0.25 s**, `backgroundColor = B`, and CSS `transition: background-color 500ms ease-out`;
    - `motion.img` with the **same layoutId**, class `z-10 relative max-w-[92vw] max-h-[92vh] object-contain pointer-events-none select-none backface-hidden`.
  - The in-flow image gets `style.opacity = 0` while open (verified), so the shared-layout animation "flies" the image to the centre. No MotionConfig is set, so framer's default layout transition applies: **0.45 s, ease `[0.4, 0, 0.1, 1]`** (bundle constant `tL` in `d59f7` near line 7147).
  - At 1440x900 the 2251×1621 image ends at x 145, y 36, 1149.8×828 (92vh).
  - While open, `container.style.overflow = "hidden"` (scroll lock) and a `keydown` Escape listener is active.
  - Close: click anywhere or press Esc. Exit is opacity 0 over 0.25 s, and the image flies back. On exit-complete the colour is reset to the default.
  - **Backdrop colour B:**
    1. Default `rgba(0,0,0,0.92)` light, `rgba(0,0,0,0.95)` dark.
    2. On `onLoad`/`onMouseEnter` (only if `matchMedia("(hover: hover) and (pointer: fine)")`), it precomputes from the image: WASM `extractColors(img, {pixels:12000, distance:.22, saturationDistance:.2, lightnessDistance:.2, hueDistance:1/12, crossOrigin:"anonymous"})` takes the dominant colour [0] (sort `(intensity+.1)*(.9−area)` desc). Then `rgb2oklch`, then `C = min(C, {light:.012, dark:.018})`, `L = {light:.8, dark:.17}`, keep h, then `oklch2rgb_abs`. The result is `rgba(R,G,B,{light:.92, dark:.95})`, cached per `theme:src`.
    3. Measured on `/adrive` ad1.jpg: light `rgba(197,187,190,0.92)`, dark `rgba(22,12,15,0.95)` (`misc/lightbox-450.png`, `misc/lightbox-dark.png`).
    4. A clone can import `@wenhaoqi/wasm_design_utils` (npm) or approximate the same maths in JS. The thresholds above are what matter.
  - The header (z-50) shows faintly through the translucent backdrop because the overlay is z-1000 but has alpha.

#### 1.7.4 Image grid (RSC, `/inspire_mono`)
`<div data-mdx-image-grid="true" class="my-6 grid w-full min-w-0 items-start gap-4 [&_[data-mdx-figure]]:my-0 [&_[data-mdx-figure]]:min-w-0" style="--mdx-image-grid-cols:1;--mdx-image-grid-cols-lg:2">` containing `span[data-mdx-figure]` children.
- Gap 16. Two columns of 408 px at ≥1024, one column of 342 px on mobile.

#### 1.7.5 Download button (RSC, `/inspire_mono`)
`<a href="/fonts/InspireMono.zip" download="InspireMono.zip" class="flex justify-center items-center bg-line lg:[@media(hover:hover)]:hover:bg-l3 my-6 px-5 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-b1 w-full min-w-0 h-[52px] font-sans font-medium text-l1 text-sm no-underline transition-[background-color,color] duration-300 ease-66 shrink-0"><p>下载 InspireMono.zip</p></a>`
- Full width, 52 px tall, a pill (radius 9999), bg `--line`.
- On hover (lg + hover-capable) the bg becomes `--label-3`, over 300 ms `cubic-bezier(.66,0,.01,1)`.
- The inner `<p>` gets the prose `p` rules: 16/26 w500 desktop, 14/22.75 mobile, `--label-1`. Text is centred.

#### 1.7.6 Code block (`MdxPre`, 93325)
```html
<div class="group my-6 overflow-hidden rounded-xl bg-[rgba(var(--label-d),0.03)]">
  <div class="flex items-center justify-between px-3 py-2 shadow-[inset_0_-1px_0_0_var(--line)] lg:px-4">
    <span class="px-1 font-mono text-xs tracking-wide text-(--label-3)">{Label}</span>
    <button type="button" aria-label="Copy code" class="{DOTTED_BORDER_BASE} cursor-pointer px-1 py-0.5 font-mono text-xs uppercase tracking-wide text-(--label-2) transition-colors lg:hover:text-(--label-1) focus-visible:text-(--label-1) focus-visible:outline-none focus-visible:before:border-l1">COPY</button>
  </div>
  <pre class="overflow-x-auto px-4 py-2 font-mono text-xs leading-relaxed text-(--label-1) lg:px-5 lg:py-2.5 lg:text-sm"><code class="language-{lang}">
    <div class="token-line? gap-4 grid grid-cols-[auto_1fr]" style="color:#9CDCFE">   <!-- one per line; class is overwritten to "gap-4 grid grid-cols-[auto_1fr]" -->
      <span aria-hidden="true" class="select-none text-right tabular-nums text-(--label-4)">{n}</span>
      <span>{token spans, each with inline style color}</span>
    </div>…
  </code></pre>
</div>
```
- **Header:** 36 px tall. Label and button use Geist Mono 12/16 with letter-spacing 0.3 px. The label is `--label-3`; COPY is `--label-2`, turning `--label-1` on hover, with a dotted 2 px border on hover (DOTTED_BORDER_BASE).
- **Label map:** `ts TypeScript, tsx TypeScript React, js JavaScript, jsx JavaScript React, py Python, sh Shell, bash Bash, zsh Zsh, json JSON, yml/yaml YAML, md Markdown, html HTML, css CSS, scss SCSS, sql SQL, text Plain Text`. Otherwise `lang.replace(/[-_]+/g," ")` title-cased, so `xml` → "Xml".
- **COPY:** `navigator.clipboard.writeText(code)` (trailing newline stripped). The label becomes **COPIED** and aria-label "Copied code" for **1200 ms** (verified).
- **pre:** 14/22.75 desktop with padding 10/20, 12/19.5 mobile with padding 8/16. `overflow-x: auto`. Long lines do **not** wrap; they scroll horizontally (`/shore_icon` XML).
- **Line layout:** grid `auto 1fr` with gap 16. Line numbers are right-aligned `--label-4`.
- **Tokenizer:** prism-react-renderer with a bundled Prism. Languages include markup/html/xml/svg, css, clike, javascript/js, jsx, tsx, typescript, json, python, go, rust, swift, kotlin, objectivec, c, cpp, graphql, markdown, sql, reason, coffee and flow. **There is no bash grammar**, so the Bash block renders as one plain token.
- **Token colour** is always set inline, overriding the theme colour:
  - comment / prolog / doctype → `var(--code-comment)`
  - string / char → `--code-string`
  - number / boolean / constant → `--code-number`
  - keyword / atrule / important → `--code-keyword`
  - function / class-name → `--code-function`
  - operator / punctuation → `--code-operator`
  - property / attr-name / tag → `--code-tag`
  - anything else → `var(--label-1)`
  - The line `div`'s `color:#9CDCFE` (vsDark plain) never shows because every token span overrides it. vsDark only sets colours, so no italics or bold leak through.
  - Empty-line tokens get `display:inline-block`.

#### 1.7.7 iframe (`/reunimos`)
Raw `<iframe width="840" height="600" src="https://www.reunimos.cc" title="Reunimos preview" allowfullscreen>` as a direct child of the prose.
- From the global rule: `max-width:100%` (832 desktop, 342 mobile) by 600 px, radius 12, `box-shadow: 0 0 0 1px var(--line)`, bg `rgba(label-d,.05)`, mb 16.
- Third-party content (reunimos.cc landing page) loads its own JS, CSS and fonts. It was not downloaded.

#### 1.7.8 Unused-but-styled
Blockquote, `<u>` (dotted underline, a radial-gradient 5×3 px repeat-x in `--color-l2`, `pb 6px`) and tables appear on none of the six pages. Their prose rules are in the class string above if needed.

### 1.8 Table of contents (`MdxTableOfContents`, 78825), visible only at ≥1536 px (`2xl:flex`)
- **Rendered when** the article has `h1, h2, h3` with ids. That applies to `/wasm_design_utils` (7 entries), `/adrive` (9) and `/shore_icon` (many); it is in the DOM but `display:none` below 1536.
- **Markup:**
  ```
  nav(fixed inset-y-0 left-0 z-20 w-[320px] flex-col overflow-hidden pl-14 pr-2)
    > div.flex.flex-col.flex-1.min-h-0.overflow-hidden
      > div.flex-1.min-h-0.overflow-y-auto.overscroll-y-contain.no-scrollbar
        > div.box-border.flex.min-h-full.flex-col.py-7
          > div.flex.min-h-0.flex-1.flex-col.justify-center.gap-1.p-2.text-sm.leading-snug.text-l2
            > a…
  ```
  The list is vertically centred in the viewport. At 1920x1080, `/adrive` links start at x 64, y 419, width 240, with a step of 27.3 px.
- **Link:** `block min-w-0 shrink-0 cursor-pointer truncate rounded-md py-0.5 transition-colors hover:text-l1` plus `text-l1` (active, `aria-current="location"`) or `text-l2`. Inline `padding-left` is 0/8/16 for h1/h2/h3. Type is 14/19.25. The label is the heading text with the `#` span removed and whitespace collapsed.
- **Active heading:** the last heading whose `getBoundingClientRect().top ≤ 96`, otherwise the first. It is recomputed on container scroll (passive), window resize, a ResizeObserver on the article, and once at 100 ms. Headings are re-collected on pathname change at 0 ms and 150 ms.
- **Click:** `preventDefault`, set active immediately, `scrollToMdxAnchorTarget` (smooth, −96), `replaceState(hash)`.

### 1.9 "Metadata" box (`ArticleFooter`, 54450)
```html
<footer data-mdx-footer="true" class="bg-[rgba(var(--label-d),0.03)] mt-16 p-4 lg:p-6 rounded-xl">
  <div class="mb-5 font-sans font-semibold text-l1 text-base">Metadata</div>
  <dl class="gap-x-6 gap-y-6 grid grid-cols-2 lg:grid-cols-3">
    <div class="flex flex-col gap-1.5"><dt class="font-sans font-semibold text-l1 text-sm">Last Updated</dt>
      <dd><ScrambleText text=… className="font-mono tabular-nums text-l2 text-sm" startDelayMs=300 scrambleColors=false/></dd></div>
    … Dimensions (startDelay 360) … Characters (startDelay 420) …
  </dl>
  <div class="my-6 border-line border-t border-dashed"></div>
  <div class="gap-x-6 gap-y-4 grid grid-cols-2 lg:grid-cols-3">
    <div class="hidden lg:block font-sans font-semibold text-l1 text-sm">Links</div>
    <div class="flex flex-col items-start gap-1 font-mono">  Home (Link "/") · Work (button) · Contact (button) </div>
    <div class="flex flex-col items-start gap-1 font-mono">  Twitter/X · GitHub · Figma (target=_blank rel="noopener noreferrer") </div>
  </div>
</footer>
```
- **Box:** margin-top 64, padding 24 desktop / 16 mobile, radius 12, bg `rgba(label-d,.03)`. Height 271 at 1440, 329 at 390.
- **Grid:** 3×245.3 px columns at 1440 with gap 24×24; 2×143 px at 390. On mobile, Characters wraps to row 2 and the "Links" label is hidden.
- **Type:**
  - "Metadata": 16/24 w600.
  - `dt`: 14/20 w600 `--label-1`.
  - `dd` values: Geist Mono 14/20 `--label-2`.
  - Dashed divider: 1 px `--line`, margin 24/24.
- **Link items:** `{DOTTED_BORDER_BASE} inline-block -mx-1 px-1 py-0.5 text-l2 lg:hover:text-l1 text-sm transition-colors`. That is Geist Mono 14/20 with padding 2/4, a dotted 2 px `--label-1` border on lg hover, and text `--label-2`→`--label-1`. Rows are 24 px with a 4 px gap.
  - URLs: `https://twitter.com/wenhaoqi`, `https://github.com/wenhaoqiasd`, `https://www.figma.com/@wenhaoqi`.
  - Each label is a ScrambleText (startDelay 300, letterDelay 80, no colours).
  - **Work/Contact:** `pathname==="/"` → `lenisScrollTo(anchor)`; otherwise `sessionStorage["hq:pendingScrollAnchor"]=anchor; startNavigation("/")`. This is the same as the header.
- **Last Updated:** the frontmatter `updated` value is parsed (`YYYYMMDD`, `YYYY-MM-DD` as a local date, or `Date.parse`) and formatted as `${MonShort} ${DD padded}, ${YYYY}`, e.g. `Jan 07, 2022`. If it is missing, "—".
- **Dimensions:** `${innerWidth}×${innerHeight}` (U+00D7) from the shared viewport store (90270 `useViewport`, updated on resize, orientationchange and visualViewport resize). It is **live**. Measured `1440×900`, `390×844`, `1920×1080`. The SSR snapshot is 1×1.
- **Characters:**
  - Computed in a `useLayoutEffect` keyed on pathname: clone the closest `[data-mdx-article]`, remove its `[data-mdx-footer]`, take `[...(textContent ?? "").trim()].length` (code points), and format with `toLocaleString("en-US")`. Null shows "—".
  - It counts **everything in the article's textContent**: the title, date and years, every heading's hidden `#`, the code-block labels ("Bash", "JavaScript"), "COPY", line numbers and code text.
  - Measured: reunimos **863**, inspire_mono **486**, wasm_design_utils **1,840**, adrive **1,602**, shore_icon **9,016**, teambition **243**. My own recount with the same algorithm matched all six.
  - A clone produces the same number only if its article DOM text is identical (same `#` spans, "COPY", line-number spans). Otherwise hard-code these values.

---

## 2. Motion on subpages

### 2.1 Entry and reveal
- **There are no entry, reveal or scroll-linked animations on the article content.**
  - The title, intro, body, images and code appear statically once the dot-iris reveal opens.
  - No IntersectionObserver fade-ins, no parallax, and no scroll listeners other than the TOC active tracker and the progress bar.
- **ScrambleText (71358) on subpages** runs only in:
  - **the header/HUD**, which has already settled when you arrive by route and only scrambles on a direct load (same delays as on home: logo/WORK/CONTACT 300 ms with letterDelay 80, clock 300 ms with letterDelay 40);
  - **the Metadata box**: Last Updated 300, Dimensions 360 and Characters 420 ms (letterDelay 80, `scrambleColors:false`), plus the Home/Work/Contact/Twitter/X/GitHub/Figma links (300 ms). They start when **both** of these hold:
    - the span has entered the viewport (`useHasEnteredViewport({threshold:.1, once:true})`), so on long pages the box scrambles when you scroll to it;
    - `allowScrambleLines === true`.
  - Before starting, each span is `opacity:0` (the box shows empty values).
- **`allowScrambleLines` timing (34841):**
  - It is set `false` at the moment of `router.push`.
  - It is set `true` 100 ms after a reveal phase begins, or immediately when idle.
  - On a direct load of a subpage, the per-route config makes `entryLoading` **disabled** for every route except `/`. So: the entry starts fully covered (`initialProgress=1`), switches immediately to reveal (no loader bar and no wait for heavy assets; fonts still gate visibility), and after 100 ms `allowScrambleLines=true`.

### 2.2 Hover and focus states (subpages)
| Element | Rest | Hover (lg unless noted) | Transition |
|---|---|---|---|
| Body link | decoration `--label-3` | decoration `--label-2` | colors 150 ms `cubic-bezier(.4,0,.2,1)` |
| Heading | `#` opacity 0 | heading hover → `#` opacity 1; `#` hover → `#` colour `--label-1` | opacity 150 ms |
| TOC link | `--label-2` | `--label-1` (any width ≥1536) | colors 150 ms |
| Footer links | text `--label-2`, transparent dotted border | text `--label-1`, 2 px dotted `--label-1` border (`::before`) | text 150 ms, border 200 ms |
| COPY button | `--label-2` | `--label-1` + dotted border; focus-visible same | 150 / 200 ms |
| Download pill | bg `--line` | bg `--label-3` (`@media(hover:hover)` and lg) | 300 ms `cubic-bezier(.66,0,.01,1)` |
| Image | `cursor: zoom-in` | precomputes the lightbox colour (fine pointer only); no visual change | — |
| Header/HUD | as on home (§4.5 of CLONE_SPEC.md) | | |

### 2.3 Route transition home → subpage (34841 controller, 80894 Link, 73475 context)
1. A card `<a href="/reunimos">` click (the custom Link) calls `preventDefault` and then `startNavigation(href)`. That resets `readyToLoadHeavy=false` and `heavyLoadProgress=0` and sets `targetHref`.
2. The controller (idle → `route:cover`) mounts the dot-iris `<Canvas>` (z-30) and animates `p 0→1` over **0.8 s** with `customCubic` = `cubic-bezier(.66,0,.01,1)`. The home WebGL scene keeps rendering underneath; the header (z-50) stays visible on top of the cover.
3. Cover `onComplete(true)` → `setAllowScrambleLines(false)` → `router.push(href)` (or `replace`) → phase `route:wait`. The home page unmounts, including its R3F canvas and Lenis, and the scroll wrapper swaps to the plain div. Since the container element changed, the restoration effect scrolls it to 0.
4. `route:wait` → `route:reveal` as soon as `pathname !== routeFromPath` and `coverDone`. Subpages have `routeLoading` disabled, so there is **no wait for assets**. The reveal runs `p 1→0` over 0.8 s. 100 ms after reveal starts, `allowScrambleLines=true`.
5. Reveal `onComplete(false)` → `idle`, `clearNavigation()`, and the canvas is unmounted (`canvas/set false`).

Total ≈ 1.6 s plus push latency. In headless SwiftShader the path changed about 1.3–2.0 s after the click, and the canvas was gone by about 2.9 s (`trans/h2s-*.png`).

### 2.4 Subpage → home (logo, footer Home, WORK, CONTACT)
- The sequence is the same as above: cover 0.8 s, then push `/`. For `/`, however, `routeLoading.enabled = true`, so **`route:wait` holds the cover until `readyToLoadHeavy && fontsReady`**. That means the freshly re-mounted home scene has to reload and compile, because the home WebGL scene was destroyed when you left.
  - No progress bar is shown; the bar only renders in `entry` mode.
  - Then the reveal runs (0.8 s).
  - Measured in headless SwiftShader: click → path `/` at about 1.3 s → reveal started at about 3.4 s.
- **WORK/CONTACT pending-anchor flow:**
  1. On the subpage: `sessionStorage.setItem("hq:pendingScrollAnchor", "#selected-work" | "#contact")`, then `startNavigation("/")`.
  2. On home, `useEffect([lenis])` in the home component (`4d3f3` around line 20206) runs once Lenis exists. It reads and removes the key, calls `lenis.resize()`, and in the next rAF calls `lenis.resize(); lenis.scrollTo(anchor, {lerp: .1, force: true})`.
  3. This fires **while the cover is still closed**. Measured: scrollTop went 524 → 1109 → 1393 → 1500 → 1534 → 1587 (`#selected-work` top) during the cover, so when the iris opens the page is already resting at the section.
- **Logo / footer Home:** no anchor, so home starts at scrollTop 0. The Lenis wrapper mounts fresh, and restoration runs `scrollTo(0)`.

### 2.5 Subpage → subpage (e.g. the `/reunimos` link inside `/wasm_design_utils`)
- Cover, push, then reveal with no wait.
- The scroll container element is **reused** because both routes use the plain-div branch, so the restoration effect does not run.
- Measured: starting at scrollTop 300 on `/wasm_design_utils`, `/reunimos` landed at **scrollTop 96**. That matches the prose top at y 96, which I attribute to Next.js App Router's segment scroll-into-view (see Open questions).
- A clone should reset to 96, or to 0 if it prefers, on subpage-to-subpage navigation.

### 2.6 Theme toggle on a subpage
Colours swap via the `html.dark` / `html.light` vars instantly; there are no transitions on the article. The HUD texts re-scramble (key remount), and scroll position is kept (`misc/dark-adrive.png`).

---

## 3. Per page

Each page lists:
- its scroll height;
- the direct children of the prose column with document y and height;
- every media element in order;
- the full text **verbatim**, as markdown-ish (links `[text](href)`, inline code in backticks, `**bold**`; code blocks with the header label as the info string; `[[…]]` marks non-markdown nodes).

In the media tables, "original src" is what the live HTML references. The images are hosted at `https://mysite2026-blog-cyn6.vercel.app/blog/...`, and **the identical bytes are also served first-party at `https://haoqi.design/blog/...`** (verified with `cmp`). They were downloaded from haoqi.design into `public/blog/...`, so the clone should use `src="/blog/..."`.

Notes per page:
- **reunimos:** the intro div holds all six paragraphs. The iframe follows directly; there are no images.
- **inspire_mono:** intro (one `<p>` with a soft line break), then the download pill, then a 2-col (lg) / 1-col image grid of 15 slides at 16:9, then the footer.
- **wasm_design_utils:**
  - Intro of two paragraphs. The second has an internal `MdxA` link to `/reunimos`, which runs the route transition.
  - Then h2 sections with 4 code blocks (Bash, then JavaScript ×3), one `ul` with bold inline code items and one `ol`.
  - TOC with 7 h2 entries, all indented 8 px.
- **adrive:**
  - No years row: the header ends with the divider, so the header is 189 px tall instead of 227.
  - One-paragraph intro.
  - Body: h1/h2/h3 sections, 14 full-width figures, the paragraph "captions" that follow figures, 3 lists and 6 `hr`.
  - TOC with 9 entries.
- **shore_icon:**
  - 15 h1/h2/h3 headings (TOC has 15 entries) and 11 figures.
  - "→" links in their own paragraphs.
  - The link `[VectorS](/stories/figma_and_me#vectors)` is internal and leads to a 404.
  - Two very long code blocks (Xml, JSON) that scroll horizontally.
- **teambition:** title block, a three-paragraph intro and the footer only. The page fits the viewport at 1440x900 (scrollHeight 900) and is 906 at 390x844.


### 3.1 `/reunimos`
- title=Reunimos™ | scrollHeight 1440x900=1862 | 390x844=2149 | 1920x1080=1880 | chars=863 | TOC=none
- children (1440): header@96h227, div@339h476, iframe@831h600, footer@1495h271
- children (390): header@72h192, div@280h788, iframe@1084h600, footer@1748h329
**Media (in DOM order)**
| # | element | original src | local file | natural | 1440 rendered (x,w×h) | 390 rendered | alt |
|---|---|---|---|---|---|---|---|
| 1 | iframe width=840 height=600 | https://www.reunimos.cc | (third-party, not downloaded) | - | 304,832×600 | 24,342×600 |  |

**Content (verbatim)**
````markdown
[[TITLE]] # Reunimos™
[[DATE]] May 31, 2026
[[YEARS]] 2024-2026

Reunimos™ 是我从 2024 年起构建的个人 AI 灵感收藏夹。一个地方，接住你在浏览、阅读、随手截图时掉落的参考：图片、链接、文档、片段想法，先收进来，不必先想好该放进哪个文件夹。

它面向个人：不做协作，也不催促你「整理得更漂亮」。我更希望它像一块私人的视觉记忆板，少花时间管理，多留空间给真正会回访的灵感。

保存之后，AI 会理解内容、补全上下文；界面以视觉优先的方式呈现，让你按颜色、意象，或某一刻模糊的印象去找回来，而不只是靠标题或路径回忆。

动效与界面质感由 Rive、Motion 与 Shader 共同驱动，整体视觉偏向圆润平滑，贴合年轻用户，长时间使用也依然耐看。2025 年还在 Chrome 下接入了 Liquid Glass 特效，让玻璃质感与这套界面语言更统一。

我对 UI 要求很高，现成工具链往往达不到我想要的效果，于是我为自己搭了一整套 UI 工具库，后来打包开源为 [@wenhaoqi/wasm_design_utils](https://www.npmjs.com/package/@wenhaoqi/wasm_design_utils)。图片主色与调色板提取用 `extractColors`（`@wenhaoqi/wasm_design_utils/extract-colors`）；sRGB ↔ OKLCH 转换用 `rgb2oklch`、`oklch2rgb_abs`、`oklch2rgb_rel`（`@wenhaoqi/wasm_design_utils/color`）；squircle / capsule 平滑圆角路径用 `getSquircle`、`getCapsule`、`getPath`（`@wenhaoqi/wasm_design_utils/squircle`）。Reunimos 里三者都会用到：取色支撑视觉检索与卡片氛围，OKLCH 负责色彩换算，squircle 路径撑起圆润的界面形态，都是我在做设计、打磨产品时沉淀下来的，后来发布开源，也希望帮到有需要的人。

欢迎去 [reunimos.cc](https://www.reunimos.cc) 注册体验，保存一张图、一条链接，感受一下这套视觉优先的收藏方式。

[[IFRAME src=https://www.reunimos.cc width=840 height=600 title="Reunimos preview"]]
````

### 3.2 `/inspire_mono`
- title=Inspire Mono | scrollHeight 1440x900=3007 | 390x844=4332 | 1920x1080=3025 | chars=486 | TOC=none
- children (1440): header@96h227, div@339h182, a@545h52, div[grid]@621h1955, footer@2640h271
- children (390): header@72h192, div@280h364, a@668h52, div@744h3123, footer@3931h329
**Media (in DOM order)**
| # | element | original src | local file | natural | 1440 rendered (x,w×h) | 390 rendered | alt |
|---|---|---|---|---|---|---|---|
| 1 | a | /fonts/InspireMono.zip | public/fonts/InspireMono.zip | - | 304,832×52 | 24,342×52 |  |
| 2 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/Cover.png | public/blog/mono/Cover.png | 1920×1080 (1.7778) | 304,408×230.4 | 24,342×193.3 |  |
| 3 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/1.png | public/blog/mono/1.png | 1920×1080 (1.7778) | 728,408×230.4 | 24,342×193.3 |  |
| 4 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/2.png | public/blog/mono/2.png | 1920×1080 (1.7778) | 304,408×230.4 | 24,342×193.3 |  |
| 5 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/3.png | public/blog/mono/3.png | 1920×1080 (1.7778) | 728,408×230.4 | 24,342×193.3 |  |
| 6 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/4.png | public/blog/mono/4.png | 1920×1080 (1.7778) | 304,408×230.4 | 24,342×193.3 |  |
| 7 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/5.png | public/blog/mono/5.png | 1920×1080 (1.7778) | 728,408×230.4 | 24,342×193.3 |  |
| 8 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/6.png | public/blog/mono/6.png | 1920×1080 (1.7778) | 304,408×230.4 | 24,342×193.3 |  |
| 9 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/7.png | public/blog/mono/7.png | 1920×1080 (1.7778) | 728,408×230.4 | 24,342×193.3 |  |
| 10 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/8.png | public/blog/mono/8.png | 1920×1080 (1.7778) | 304,408×230.4 | 24,342×193.3 |  |
| 11 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/9.png | public/blog/mono/9.png | 1920×1080 (1.7778) | 728,408×230.4 | 24,342×193.3 |  |
| 12 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/10.png | public/blog/mono/10.png | 1920×1080 (1.7778) | 304,408×230.4 | 24,342×193.3 |  |
| 13 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/11.png | public/blog/mono/11.png | 1920×1080 (1.7778) | 728,408×230.4 | 24,342×193.3 |  |
| 14 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/12.png | public/blog/mono/12.png | 1920×1080 (1.7778) | 304,408×230.4 | 24,342×193.3 |  |
| 15 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/13.png | public/blog/mono/13.png | 1920×1080 (1.7778) | 728,408×230.4 | 24,342×193.3 |  |
| 16 | img (grid) | https://mysite2026-blog-cyn6.vercel.app/blog/mono/14.png | public/blog/mono/14.png | 1920×1080 (1.7778) | 304,408×230.4 | 24,342×193.3 |  |

**Content (verbatim)**
````markdown
[[TITLE]] # Inspire Mono
[[DATE]] May 07, 2026
[[YEARS]] 2025

InspireMono 是我在 2025 年一次基于 vibe coding 的实验项目，灵感来自 [RSMS 的字体工作流](https://www.figma.com/community/file/1115382696459820988)：通过 Figma 绘制 glyph，并结合脚本将字形导出为字体。我让 agent 分析了其中关键的字体构建流程，最终定位到基于 [opentype.js](https://opentype.js.org) 的字体生成能力——这也是目前 JavaScript 生态里最成熟的字体读写与构建库之一。
最初，我只是想做一个能在 Figma 中绘制并管理图标字体的小工具，类似过去做的 [VectorSymbols](https://www.figma.com/community/plugin/1255914175202017737/vectorsymbols)；但随着开发推进，对字体构建本身的兴趣逐渐超过了图标管理，于是项目开始演变成一个完整的字体构建插件。它支持字体元信息、OpenType Ligatures、数字与符号变体（Stylistic Sets）、替换字形等特性，并逐步扩展出图标字体、字体管理工具以及最终的 InspireMono 字体本身。字体外观则参考并融合了部分 [TikTok Sans](https://www.tiktok.com/font) 的设计特征。近期准备开源字体的 Figma 源文件。

[[DOWNLOAD BUTTON href=/fonts/InspireMono.zip download=InspireMono.zip]] 下载 InspireMono.zip

[[IMAGE GRID style="--mdx-image-grid-cols:1;--mdx-image-grid-cols-lg:2"]]

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/Cover.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/1.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/2.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/3.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/4.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/5.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/6.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/7.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/8.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/9.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/10.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/11.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/12.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/13.png)  <!-- natural 1920x1080 -->

![](https://mysite2026-blog-cyn6.vercel.app/blog/mono/14.png)  <!-- natural 1920x1080 -->
[[/IMAGE GRID]]
````

### 3.3 `/wasm_design_utils`
- title=Wasm design utils | scrollHeight 1440x900=3000 | 390x844=3086 | 1920x1080=3018 | chars=1,840 | TOC=7 entries
- children (1440): header@96h227, div@339h90, h2@477h30, div[code]@531h79, p@634h26, p@676h26, h2@750h30, ul@796h78, p@874h26, h2@948h30, div[code]@1002h284, p@1309h52, h2@1409h30, div[code]@1463h306, p@1794h26, h2@1868h30, p@1914h26, div[code]@1964h170, p@2157h26, h2@2231h30, p@2277h26, ol@2319h78, p@2397h26, h2@2471h30, p@2517h52, footer@2633h271
- children (390): header@72h192, div@280h149, h2@469h25, div@518h72, p@613h46, p@675h23, h2@738h25, ul@779h156, p@935h46, h2@1020h25, div@1069h247, p@1340h68, h2@1448h25, div@1497h267, p@1788h46, h2@1873h25, p@1914h46, div@1984h150, p@2157h46, h2@2243h25, p@2284h46, ol@2345h104, p@2449h23, h2@2512h25, p@2553h68, footer@2685h329
**Media (in DOM order)**
| # | element | original src | local file | natural | 1440 rendered (x,w×h) | 390 rendered | alt |
|---|---|---|---|---|---|---|---|

**TOC (1920):** 安装(pl8px) · 三个模块，按需引入(pl8px) · 颜色(pl8px) · 取色(pl8px) · 平滑圆角(pl8px) · 本站怎么用(pl8px) · Next.js 注意(pl8px)

**Content (verbatim)**
````markdown
[[TITLE]] # Wasm design utils
[[DATE]] May 31, 2026
[[YEARS]] 2025

`@wenhaoqi/wasm_design_utils` 是一组浏览器端设计小工具：sRGB ↔ OKLCH 色彩转换、图片取色、以及 squircle / capsule 的 SVG 路径生成。npm：[@wenhaoqi/wasm_design_utils](https://www.npmjs.com/package/@wenhaoqi/wasm_design_utils)。

它最初是在做 [Reunimos™](/reunimos) 时沉淀下来的，后来打包开源。

## 安装  {#安装}

```Bash
npm install @wenhaoqi/wasm_design_utils
```

包是 ESM，WASM 默认内联在包里，一般**不用**自己托管 `.wasm` 文件。

所有 API 都是 **async**，调用时要 `await`。

## 三个模块，按需引入  {#三个模块按需引入}

- **`@wenhaoqi/wasm_design_utils/color`** — RGB ↔ OKLCH
- **`@wenhaoqi/wasm_design_utils/extract-colors`** — 从图片提取主色
- **`@wenhaoqi/wasm_design_utils/squircle`** — 生成平滑圆角 SVG path

也可以从根路径 `@wenhaoqi/wasm_design_utils` 一次性导入全部 API。

## 颜色  {#颜色}

```JavaScript
import { rgb2oklch, oklch2rgb_abs, oklch2rgb_rel } from "@wenhaoqi/wasm_design_utils/color";

// sRGB 0–255 → OKLCH
const { L, C, h } = await rgb2oklch(128, 100, 231);

// OKLCH → sRGB，直接指定色度
const { R, G, B } = await oklch2rgb_abs(L, C, h);

// 只定明暗和色相，彩度用 0–1 滑杆（更直觉）
const tint = await oklch2rgb_rel(L, h, 0.5);
```

`init()` 可选。不传的话，第一次调用转换函数时会自动加载 WASM；想在页面启动时预热，可以提前 `await init()`。

## 取色  {#取色}

```JavaScript
import extractColors from "@wenhaoqi/wasm_design_utils/extract-colors";

// 从 <img> 提取调色板，第一个色块通常是主色
const [dominant, ...rest] = await extractColors(img);

// 常用参数
const palette = await extractColors(img, {
  pixels: 64000,        // 抽样分辨率，默认 64000
  distance: 0.22,       // 聚类距离
  crossOrigin: "anonymous", // 跨域图片 URL 时需要
});
```

`input` 支持：图片 URL 字符串、`<img>` / `Image`、`ImageData`。

## 平滑圆角  {#平滑圆角}

普通 `border-radius` 在大圆角时转角容易发尖；squircle 用 SVG path 过渡更顺。

```JavaScript
import { getPath } from "@wenhaoqi/wasm_design_utils/squircle";

const d = await getPath("squircle", 200, 120, 16);
pathEl.setAttribute("d", d);
// viewBox 对应：0 0 200 120
```

`shape` 也可以是 `"capsule"`（胶囊形标签、Chip 等）。

## 本站怎么用  {#本站怎么用}

文章页图片放大时，会用取色 + OKLCH 生成跟图片主色接近的蒙层背景：

1. `extractColors` 取主色
2. `rgb2oklch` 转成 OKLCH
3. 按明暗主题调整亮度，再 `oklch2rgb_abs` 转回 RGB

这样全屏查看图片时，背景不会突兀地跳成纯黑。

## Next.js 注意  {#nextjs-注意}

需要在**客户端**使用（依赖 `Image` 和 WebAssembly）。放在 `"use client"` 组件里，或用动态 `import()` 加载即可。
````

### 3.4 `/adrive`
- title=aDrive 阿里云盘 | scrollHeight 1440x900=11038 | 390x844=7101 | 1920x1080=11056 | chars=1,602 | TOC=9 entries
- children (1440): header@96h189, div@301h78, h1@435h35, p@486h78, span@588h600, p@1212h26, span@1262h599, p@1885h26, p@1927h52, h1@2035h35, h2@2118h30, span@2172h469, p@2665h78, h2@2791h30, p@2837h78, h3@2955h28, span@3006h469, ul@3499h78, h3@3617h28, span@3669h469, span@4162h469, ul@4655h78, h3@4773h28, span@4824h490, ul@5338h78, h2@5464h30, span@5518h625, p@6167h78, p@6261h26, p@6303h26, hr@6361h1, h1@6418h35, span@6477h536, p@7037h78, span@7139h536, p@7699h26, p@7741h78, hr@7851h1, span@7884h536, p@8444h26, p@8486h52, hr@8570h1, span@8603h536, p@9163h26, hr@9221h1, span@9254h536, p@9813h26, hr@9871h1, span@9904h536, p@10464h26, hr@10522h1, p@10555h52, footer@10671h271
- children (390): header@72h158, div@246h114, h1@407h30, p@453h137, span@614h247, p@885h23, span@932h247, p@1202h46, p@1264h68, h1@1380h30, h2@1450h25, span@1499h193, p@1716h114, h2@1870h25, p@1911h137, h3@2079h25, span@2128h193, ul@2345h78, h3@2455h25, span@2504h193, span@2721h193, ul@2939h78, h3@3049h25, span@3097h202, ul@3323h130, h2@3493h25, span@3542h257, p@3824h137, p@3976h46, p@4038h68, hr@4138h1, h1@4187h30, span@4241h221, p@4485h137, span@4646h221, p@4891h23, p@4929h137, hr@5098h1, span@5131h221, p@5376h23, p@5414h91, hr@5537h1, span@5570h221, p@5815h23, hr@5870h1, span@5903h221, p@6148h23, hr@6202h1, span@6235h221, p@6480h23, hr@6535h1, p@6568h68, footer@6700h329
**Media (in DOM order)**
| # | element | original src | local file | natural | 1440 rendered (x,w×h) | 390 rendered | alt |
|---|---|---|---|---|---|---|---|
| 1 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad1.jpg | public/blog/adrive/ad1.jpg | 2251×1621 (1.3886) | 304,832×599.7 | 24,342×246.8 | 首页、传输列表、相册分享菜单 |
| 2 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad2.jpg | public/blog/adrive/ad2.jpg | 2251×1620 (1.3895) | 304,832×599.3 | 24,342×246.7 | 文件预览、文件预览讨论圈点、视频弹幕圈点（概念） |
| 3 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad3.png | public/blog/adrive/ad3.png | 1920×1080 (1.7778) | 304,832×468.9 | 24,342×193.3 | ADS 架构 |
| 4 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad4.png | public/blog/adrive/ad4.png | 1920×1080 (1.7778) | 304,832×468.9 | 24,342×193.3 | 规范简洁 |
| 5 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad5.png | public/blog/adrive/ad5.png | 1920×1080 (1.7778) | 304,832×468.9 | 24,342×193.3 | 高度复用 |
| 6 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad6.png | public/blog/adrive/ad6.png | 1920×1080 (1.7778) | 304,832×468.9 | 24,342×193.3 | 高度复用 |
| 7 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad7.png | public/blog/adrive/ad7.png | 1920×1128 (1.7021) | 304,832×489.6 | 24,342×201.8 | 可持续性 |
| 8 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad8.png | public/blog/adrive/ad8.png | 2168×1628 (1.3317) | 304,832×625.3 | 24,342×257.3 | ADS 周边工具链 |
| 9 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad9.jpg | public/blog/adrive/ad9.jpg | 2520×1621 (1.5546) | 304,832×535.9 | 24,342×220.7 | 阿里云盘设计概览 |
| 10 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad10.jpg | public/blog/adrive/ad10.jpg | 2520×1621 (1.5546) | 304,832×535.9 | 24,342×220.7 | 滑动导航与启动器 |
| 11 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad11.jpg | public/blog/adrive/ad11.jpg | 2520×1621 (1.5546) | 304,832×535.9 | 24,342×220.7 | 多功能菜单、分享菜单 |
| 12 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad12.jpg | public/blog/adrive/ad12.jpg | 2520×1621 (1.5546) | 304,832×535.9 | 24,342×220.7 | 音频播放器、视频播放器、放映室 |
| 13 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad13.jpg | public/blog/adrive/ad13.jpg | 2520×1621 (1.5546) | 304,832×535.9 | 24,342×220.7 | 占位符 |
| 14 | img | https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad14.jpg | public/blog/adrive/ad14.jpg | 2520×1621 (1.5546) | 304,832×535.9 | 24,342×220.7 | 高度统一的桌面端 |

**TOC (1920):** Teambition 网盘(pl0px) · ADS | Adrive Design System(pl0px) · ADS 架构(pl8px) · ADS 设计原则(pl8px) · 规范简洁(pl16px) · 高度复用(pl16px) · 可持续性(pl16px) · ADS 周边工具链(pl8px) · 阿里云盘设计概览(pl0px)

**Content (verbatim)**
````markdown
[[TITLE]] # aDrive 阿里云盘
[[DATE]] Jan 07, 2022
[[YEARS]] (none)

从零搭建阿里云盘设计系统，并参与其长期维护，支撑全端设计语言统一与设计组件复用。参与首页、各版本导航结构与启动器框架，以及影音播放器等业务设计；同时开发或协作开发设计系统文档工具 ADS 客户端与 Figma design token 导出工具。

# Teambition 网盘  {#teambition-网盘}

Teambition 网盘是阿里云盘的前身。前期为了快速搭建并验证方向，我们选择在 Teambition 主产品内「生长」：底层天然具备协作能力，无论面向企业还是个人，都比从零起步更省力。设计侧同样如此，直接沿用成熟的 [Clarity design](https://design.teambition.com)，也无需再搭一套全新的设计系统。

![首页、传输列表、相册分享菜单](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad1.jpg)  <!-- natural 2251x1621 -->

首页、传输列表、相册分享菜单

![文件预览、文件预览讨论圈点、视频弹幕圈点（概念）](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad2.jpg)  <!-- natural 2251x1620 -->

文件预览、文件预览讨论圈点、视频弹幕圈点（概念）

在获得外界与集团内部认可之后，我们决定把它做成独立的客户端，并争取到更充裕的研发资源；资源到位之后，也就有条件从零建立一套新的设计系统。

# ADS | Adrive Design System  {#ads-adrive-design-system}

## ADS 架构  {#ads-架构}

![ADS 架构](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad3.png)  <!-- natural 1920x1080 -->

ADS 有两个驱动核心：一是设计目标，二是业务目标。我们刻意不把二者混为一谈——业务诉求本身并不会自动指向更好的用户体验。持续迭代、不断补全的设计目标，才是拉升体验的主轴；业务目标则负责在收益与体验之间拿捏分寸，避免过度设计。

## ADS 设计原则  {#ads-设计原则}

好的工作流能够显著提高团队效率；相较某些偏形而上的设计方法，它对组织而言往往更落地、也更容易推广。设计系统本质上就是设计、产品、工程有机融合的一条工作流，Figma 等工具协作可以帮助完成约 60% 的工作，其余部分要靠管理机制与各相关方达成共识来补齐。

### 规范简洁  {#规范简洁}

![规范简洁](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad4.png)  <!-- natural 1920x1080 -->

- 场景命名
- 使用缩写
- 层级清晰

### 高度复用  {#高度复用}

![高度复用](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad5.png)  <!-- natural 1920x1080 -->

![高度复用](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad6.png)  <!-- natural 1920x1080 -->

- 组件复用
- 跨端一致性
- 统一 Token 管理

### 可持续性  {#可持续性}

![可持续性](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad7.png)  <!-- natural 1920x1128 -->

- 反馈敏捷
- 受控逃逸 / Escape hatch（允许在特殊情况下跨出设计系统的既定限制，避免机制僵化；并非鼓励随意破窗，而是为真实业务留出可控出口）

## ADS 周边工具链  {#ads-周边工具链}

![ADS 周边工具链](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad8.png)  <!-- natural 2168x1628 -->

ADS 客户端基于 Gatsby 与 Electron 开发，用于承载设计系统文档、组件演示与设计资源整合。对仅有 Figma 查看权限的同学，它还能把多条设计稿链接拼成一张「设计地图」。在团队语境里，大家默认：凡与云盘设计相关的内容，都会在 ADS 客户端里找到对应落点。

Fridge 也被纳入阿里云盘项目，用于把更完整的色板与 icon 实时同步给使用者。

Figma Time Line 是我们借助 Figma 的 Auto Layout「搭」出来的排期看板，全组的工作日程都通过它来对齐。

---

# 阿里云盘设计概览  {#阿里云盘设计概览}

![阿里云盘设计概览](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad9.jpg)  <!-- natural 2520x1621 -->

阿里云盘在上线初期收获好评之后，为了在行业内做出差异化、参与竞争，团队探索了以「场景」为核心的个人云：用户不仅能把数字资产放进云盘，还能按不同使用场景在云盘内完成消费，而不必反复跳转到其他应用，从而形成「存—用」一体的个人数字资产闭环。

![滑动导航与启动器](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad10.jpg)  <!-- natural 2520x1621 -->

滑动导航与启动器

滑动导航是一次有趣的探索：我们希望单一导航栏仍能完整呈现「个人云」的能力版图，又不能牺牲可用性。这一方案在设计冲刺阶段我曾持保留态度，但在原型与可用性测试之后我改变了看法；我接手了与滑动导航相关的全部设计工作，并最终推动上线——日后有机会可以再单独展开当时的推演与取舍。

---

![多功能菜单、分享菜单](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad11.jpg)  <!-- natural 2520x1621 -->

多功能菜单、分享菜单

多功能菜单既贴合当代产品的操作习惯，又比层层模态与二级页面更轻、更快；相较传统的 Action sheet，它在布局与信息密度上也更自由。这也是许多优质 iOS 与 Android 应用正在采用的设计趋势之一。

---

![音频播放器、视频播放器、放映室](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad12.jpg)  <!-- natural 2520x1621 -->

音频播放器、视频播放器、放映室

---

![占位符](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad13.jpg)  <!-- natural 2520x1621 -->

占位符

---

![高度统一的桌面端](https://mysite2026-blog-cyn6.vercel.app/blog/adrive/ad14.jpg)  <!-- natural 2520x1621 -->

高度统一的桌面端

---

最后，在阿里云盘与 Teambition 的这段经历非常充实：不仅让我的设计能力有了明显提升，也结识了许多一路互相促进的伙伴。
````

### 3.5 `/shore_icon`
- title=Shore Icon | scrollHeight 1440x900=10931 | 390x844=8407 | 1920x1080=10949 | chars=9,016 | TOC=15 entries
- children (1440): header@96h227, div@339h104, h1@499h35, p@550h52, h2@650h30, p@696h78, span@798h804, p@1626h26, h2@1700h30, p@1746h52, h3@1838h28, p@1882h78, p@1976h52, h1@2084h35, h2@2167h30, p@2213h26, p@2255h52, span@2331h520, p@2875h78, p@2969h78, span@3071h461, h2@3580h30, p@3626h26, p@3668h26, span@3718h450, p@4192h52, h2@4292h30, p@4338h26, span@4388h417, p@4829h52, span@4905h438, p@5367h52, h1@5475h35, p@5526h78, h2@5652h30, p@5698h26, span@5748h572, p@6344h52, span@6420h523, h2@6991h30, p@7037h52, p@7105h26, span@7155h149, h2@7352h30, p@7398h78, p@7492h52, span@7568h423, p@8015h26, h2@8089h30, p@8135h26, p@8177h26, div[code]@8227h466, p@8716h26, div[code]@8766h648, p@9438h78, h2@9564h30, p@9610h52, h1@9718h35, span@9777h579, p@10380h52, p@10448h52, footer@10564h271
- children (390): header@72h192, div@280h182, h1@510h30, p@556h68, h2@665h25, p@706h137, span@866h331, p@1221h23, h2@1284h25, p@1325h68, h3@1425h25, p@1466h137, p@1618h68, h1@1734h30, h2@1804h25, p@1845h23, p@1884h68, span@1976h214, p@2215h114, p@2344h159, span@2528h190, h2@2758h25, p@2799h23, p@2837h46, span@2907h186, p@3116h68, h2@3225h25, p@3266h46, span@3335h172, p@3531h68, span@3623h181, p@3828h68, h1@3944h30, p@3990h159, h2@4190h25, p@4231h46, span@4300h235, p@4559h68, span@4652h216, h2@4907h25, p@4948h114, p@5078h46, span@5147h62, h2@5249h25, p@5290h114, p@5420h114, span@5558h175, p@5757h46, h2@5842h25, p@5883h46, p@5945h23, div@5991h403, p@6418h23, div@6465h559, p@7048h159, h2@7247h25, p@7288h91, h1@7427h30, span@7481h238, p@7744h91, p@7851h91, footer@8006h329
**Media (in DOM order)**
| # | element | original src | local file | natural | 1440 rendered (x,w×h) | 390 rendered | alt |
|---|---|---|---|---|---|---|---|
| 1 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon01.png | public/blog/shore/icon01.png | 1504×1454 (1.0344) | 304,832×804.4 | 24,342×330.7 | Material 与 Ant Design 的图标网格 |
| 2 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon02.png | public/blog/shore/icon02.png | 1564×976 (1.6025) | 304,832×520 | 24,342×214.2 | SF Symbols 图标与文字系统 |
| 3 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon03.png | public/blog/shore/icon03.png | 1736×960 (1.8083) | 304,832×461 | 24,342×190 | SF Symbols 多档线宽与相对宽度 |
| 4 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon04.png | public/blog/shore/icon04.png | 2418×1306 (1.8515) | 304,832×450.3 | 24,342×185.6 | Microsoft Fluent System Icons 规范 |
| 5 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon05.png | public/blog/shore/icon05.png | 1500×750 (2.0000) | 304,832×417 | 24,342×172 | Spotify Icon System 文章截图 |
| 6 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon06.png | public/blog/shore/icon06.png | 2000×1051 (1.9029) | 304,832×438.2 | 24,342×180.7 | Spotify Icon System 线宽策略 |
| 7 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon07.png | public/blog/shore/icon07.png | 2174×1492 (1.4571) | 304,832×571.6 | 24,342×235.3 | Shore Icon 多重线宽说明 |
| 8 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon08.png | public/blog/shore/icon08.png | 1736×1090 (1.5927) | 304,832×523.1 | 24,342×215.5 | VectorS 线宽工具 |
| 9 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon09.png | public/blog/shore/icon09.png | 3206×566 (5.6643) | 304,832×148.5 | 24,342×62 | Shore Icon 非严格网格 |
| 10 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon10.png | public/blog/shore/icon10.png | 2474×1256 (1.9697) | 304,832×423.4 | 24,342×174.6 | Non-zero 与 Even-odd 填充规则 |
| 11 | img | https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon11.png | public/blog/shore/icon11.png | 1584×1101 (1.4387) | 304,832×578.9 | 24,342×238.3 | VectorS GitHub 版本管理设想 |

**TOC (1920):** 痛点(pl0px) · 风格统一(pl8px) · 识别清晰(pl8px) · 交付与管理(pl16px) · 发现与学习(pl0px) · SF Symbols(pl8px) · Microsoft Fluent System Icons(pl8px) · Spotify Icon System(pl8px) · Shore Icon System(pl0px) · 多重线宽(pl8px) · 非严格的网格(pl8px) · 非零与偶奇填充(pl8px) · 统一输出格式(pl8px) · 版本管理(pl8px) · 未来(pl0px)

**Content (verbatim)**
````markdown
[[TITLE]] # Shore Icon
[[DATE]] Mar 01, 2022
[[YEARS]] 2022

在 Shore 的工作时间不长，但我做了一套风格现代、维护成本可控的图标系统（Icon System）。过程中主要参考了刚完成重构的 [Spotify Icon System](https://spotify.design/article/refreshing-our-icon-system-the-why-and-how-behind-the-changes)、微软的 [Microsoft Fluent System Icons](https://www.figma.com/community/file/836835755999342788/Microsoft-Fluent-System-Icons)，以及业内的 [SF Symbols](https://developer.apple.com/design/resources/#sf-symbols)。这套系统在风格管理、版本管理、跨端表现和自动化交付上都更顺手，我也希望把其中的经验留给正在从零搭建或准备重构图标系统的团队与设计师。

# 痛点  {#痛点}

要做一套好用的图标系统，风格统一、识别清晰、交付与管理简单——听起来是共识，真正落地时每一环都可能变成痛点。

## 风格统一  {#风格统一}

图标能不能称为「系统」，第一条往往是够不够统一。我们以前的做法，是在统一尺寸的画布上，用一套网格约束、几档规范的圆角和统一的描边粗细去框图形。这样顶多统一了表层样式；若网格卡得太死，执行时很容易出现「多一格嫌长、少一格嫌短」的别扭，反而违背视觉直觉。

![Material 与 Ant Design 的图标网格](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon01.png)  <!-- natural 1504x1454 -->

Material 与 Ant Design 的图标网格

## 识别清晰  {#识别清晰}

图标传达内容，不只靠外形，还与最小可用尺寸、正负形是否一致有关；这些细节会直接影响识别，也容易制造视觉错觉。

### 交付与管理  {#交付与管理}

把多人绘制的图标收成一套资源，本身就很费神。好在 Figma 能让更多人在同一份设计稿里协作，历史版本也算能管。但设计稿的版本并不等于研发最终接手的版本，两者很容易脱节。每次还要按端单独导出格式，若没有专人维护，输出就会越来越乱，最后线上各端各版本、各画各的图标。

阿里巴巴的 [iconfont](https://www.iconfont.cn/) 在上一代工具里很好地缓解过这些问题，但以今天的协作与工程节奏来看，已经明显不够用了。

# 发现与学习  {#发现与学习}

## SF Symbols  {#sf-symbols}

[SF Symbols →](https://developer.apple.com/design/resources/#sf-symbols)

门槛最低：多数设计师的 Mac 上都装得到 SF Symbols。细读之后会发现，无论从哪个维度看，这套图标都相当出色。

![SF Symbols 图标与文字系统](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon02.png)  <!-- natural 1564x976 -->

SF 的图标与 SF Pro 是一起为混排设计的，因此字形的中线、基线也会进图标参考；字体没有「裁剪内容」一类的包袱，边缘留多少不必纠结。每个字重都有对应图标，第一眼就很震撼。3.0 起又补了大量彩色图标，同样基于彩色字体。

我把 SF 放进 Figma 看路径时发现：每个字重下还有 5 档相对宽度，而且宽度变化是线性的，并不是随便挑几个档位——多半是为了让描边粗细在观感上更均匀。另一个细节是转折与交叉处的「收口」，这是字形里常用的手法，让弯折处看起来和直线段一样稳，小尺寸也更清楚；在成千上万枚图标里坚持这样做，非常难得。

![SF Symbols 多档线宽与相对宽度](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon03.png)  <!-- natural 1736x960 -->

## Microsoft Fluent System Icons  {#microsoft-fluent-system-icons}

[Microsoft Fluent System Icons →](https://www.figma.com/community/file/836835755999342788/Microsoft-Fluent-System-Icons)

微软更慷慨一些，把整套图标系统设计稿放在 Figma 社区里，规范也写得清楚，很适合当教材。

![Microsoft Fluent System Icons 规范](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon04.png)  <!-- natural 2418x1306 -->

Fluent 讲了网格、不同类型外形的画法、怎么测视觉权重、填充图标怎么处理，以及角标不要挡关键信息——而不只是「铺一层底色」那种粗暴做法，等等。

## Spotify Icon System  {#spotify-icon-system}

[Refreshing our Icon System: the why and how behind the changes →](https://spotify.design/article/refreshing-our-icon-system-the-why-and-how-behind-the-changes)

![Spotify Icon System 文章截图](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon05.png)  <!-- natural 1500x750 -->

在我看来，Spotify 很擅长用较低成本换较大收益，跨端设计系统就是例子；这次图标系统更新也延续了同一套思路。

![Spotify Icon System 线宽策略](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon06.png)  <!-- natural 2000x1051 -->

新系统用两种线宽覆盖两类尺寸区间，并对不同线宽做不同细化——相比 SF 为每个字重各做一整套图标，更贴近「资源没有苹果那么宽裕」的普通团队。

# Shore Icon System  {#shore-icon-system}

有了前面的输入，我想做一套自己的图标系统：视觉统一、识别清楚、手感平衡，还要有一条顺手的交付链路。把整套库做成能和文字自然混排的字体，对我来说不现实，维护和绘制成本都太高，最后还是落在更主流的 SVG 上。不同的是我选了 [SVG Symbol](https://developer.mozilla.org/zh-CN/docs/Web/SVG/Element/symbol) 这种单文件、多图形的组织方式，导出则依赖我自研的 Figma 插件 [VectorS](/stories/figma_and_me#vectors)。

## 多重线宽  {#多重线宽}

我借鉴了 SF 的多档线宽思路，在 24×24 的格子里找出视觉平衡的 5 档宽度，并为每一档写了使用说明。

![Shore Icon 多重线宽说明](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon07.png)  <!-- natural 2174x1492 -->

为了批量整理图标在 Frame 里的适配规则、少手填线宽，我在 VectorS 里加了一串小工具做样式填充，线宽这一层就这样收住了。

![VectorS 线宽工具](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon08.png)  <!-- natural 1736x1090 -->

## 非严格的网格  {#非严格的网格}

很多第三方图标不如官方图标「舒服」，很大一部分原因是对网格的理解：网格应是参照，而不是枷锁；在网格给定的范围里画出舒服的形，比处处贴齐更重要。各家的官方图标也不是死板对齐，而是灵活运用对齐与对比。

我画了一套偏「非严格」的辅助网格，定形之后再配合模糊看视觉权重。

![Shore Icon 非严格网格](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon09.png)  <!-- natural 3206x566 -->

## 非零与偶奇填充  {#非零与偶奇填充}

非零规则（non-zero）与偶奇规则（even-odd）对应 SVG 的 [fill-rule](https://developer.mozilla.org/zh-CN/docs/Web/SVG/Attribute/fill-rule)，描述的是路径布尔运算怎么算。简单说，要么按路径的绕向自动运算，要么靠标记规则；前者兼容性更好（字体、Android 矢量等），后者在 Web 与 iOS 上往往更可控。

Figma 默认更接近 even-odd。用过 Figma 导出到 iconfont 的人多半知道 [Fill Rule Editor](https://www.figma.com/community/plugin/771155994770327940/Fill-Rule-Editor)——它通过调整路径方向，让结果符合 non-zero 规则。作者曾是 Figma 的前 CTO，不知是否因此，社区里几乎找不到第二个做同类事的插件。

![Non-zero 与 Even-odd 填充规则](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon10.png)  <!-- natural 2474x1256 -->

为跨端考虑，Shore Icon 的填充规则我选了兼容性更好的 non-zero。

## 统一输出格式  {#统一输出格式}

格式统一同样是跨端前提。我用插件导出两种格式，给研发同事评估怎么消费。

SVG Symbol 格式预览

```Xml
<svg style="display: none;" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
  <!-- 3 icons / 2022/3/18上午1:31:10 / VectorS 1.0.0 -->
  <symbol id="Figma" viewbox="0 0 24 24">
    <g transform="translate(5.1 2.1)">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M 3.9 0 L 9.9 0 C 12.053 0 13.8 1.747 13.8 3.9 C 13.8 5.106 13.252 6.185 12.391 6.9 C 13.252 7.616 13.8 8.694 13.8 9.9 C 13.8 12.053 12.053 13.8 9.9 13.8 C 9.127 13.8 8.406 13.575 7.8 13.186 L 7.8 15.9 C 7.8 18.053 6.053 19.8 3.9 19.8 C 1.747 19.8 0 18.053 0 15.9 C 0 14.694 0.548 13.616 1.409 12.9 C 0.548 12.184 0 11.106 0 9.9 C 0 8.694 0.548 7.616 1.409 6.9 C 0.548 6.185 0 5.106 0 3.9 C 0 1.747 1.747 0 3.9 0 Z M 1.8 3.9 C 1.8 2.741 2.741 1.8 3.9 1.8 L 6 1.8 L 6 6 L 3.9 6 C 2.741 6 1.8 5.059 1.8 3.9 Z M 6 9.902 C 6 9.901 6 9.901 6 9.9 C 6 9.899 6 9.899 6 9.898 L 6 7.8 L 3.9 7.8 C 2.741 7.8 1.8 8.741 1.8 9.9 C 1.8 11.059 2.741 12 3.9 12 L 6 12 L 6 9.902 Z M 7.8 9.9 C 7.8 11.059 8.741 12 9.9 12 C 11.059 12 12 11.059 12 9.9 C 12 8.741 11.059 7.8 9.9 7.8 C 8.741 7.8 7.8 8.741 7.8 9.9 Z M 9.9 6 C 11.059 6 12 5.059 12 3.9 C 12 2.741 11.059 1.8 9.9 1.8 L 7.8 1.8 L 7.8 6 L 9.9 6 Z M 1.8 15.9 C 1.8 14.741 2.741 13.8 3.9 13.8 L 6 13.8 L 6 15.9 C 6 17.059 5.059 18 3.9 18 C 2.741 18 1.8 17.059 1.8 15.9 Z" fill="rgb(0,0,0)"  />
    </g>
  </symbol>
  <symbol id="Twitter" viewbox="0 0 24 24">
    <g transform="translate(2.5 4)">
      <path  d="M 17.048 3.984 C 17.055 4.16 17.055 4.328 17.055 4.504 C 17.063 9.84 13.143 16 5.973 16 C 3.859 16 1.783 15.368 0 14.184 C 0.309 14.224 0.617 14.24 0.926 14.24 C 2.678 14.24 4.383 13.632 5.765 12.504 C 4.098 12.472 2.632 11.344 2.122 9.696 C 2.709 9.816 3.311 9.792 3.882 9.624 C 2.068 9.256 0.764 7.6 0.756 5.672 C 0.756 5.656 0.756 5.64 0.756 5.624 C 1.297 5.936 1.906 6.112 2.524 6.128 C 0.818 4.944 0.286 2.584 1.32 0.736 C 3.303 3.264 6.22 4.792 9.353 4.96 C 9.037 3.56 9.469 2.088 10.48 1.096 C 12.047 -0.432 14.516 -0.352 15.998 1.272 C 16.87 1.096 17.711 0.76 18.475 0.288 C 18.182 1.224 17.572 2.016 16.762 2.52 C 17.534 2.424 18.29 2.208 19 1.888 C 18.475 2.704 17.812 3.408 17.048 3.984 Z" fill="rgb(0,0,0)"  />
    </g>
  </symbol>
  <symbol id="Instagram" viewbox="0 0 24 24">
    <g transform="translate(2 2)">
      <path fill-rule="evenodd" clip-rule="evenodd" d="M 9.996 4.865 C 7.163 4.865 4.861 7.163 4.861 10 C 4.861 12.837 7.159 15.135 9.996 15.135 C 12.833 15.135 15.131 12.837 15.131 10 C 15.131 7.163 12.833 4.865 9.996 4.865 Z M 9.996 13.329 C 8.155 13.329 6.663 11.837 6.663 9.996 C 6.663 8.155 8.155 6.663 9.996 6.663 C 11.837 6.663 13.329 8.155 13.329 9.996 C 13.329 11.837 11.837 13.329 9.996 13.329 Z M 16.532 4.659 C 16.532 5.321 15.995 5.857 15.333 5.857 C 14.671 5.857 14.135 5.321 14.135 4.659 C 14.135 3.997 14.671 3.46 15.333 3.46 C 15.995 3.46 16.532 3.997 16.532 4.659 Z M 9.996 0 C 7.282 0 6.94 0.012 5.873 0.06 C 4.81 0.107 4.083 0.278 3.448 0.524 C 2.79 0.778 2.234 1.123 1.679 1.679 C 1.123 2.234 0.782 2.794 0.524 3.448 C 0.278 4.083 0.107 4.81 0.06 5.877 C 0.012 6.94 0 7.282 0 9.996 C 0 12.71 0.012 13.052 0.06 14.119 C 0.107 15.183 0.278 15.909 0.524 16.548 C 0.778 17.206 1.123 17.762 1.679 18.317 C 2.234 18.873 2.794 19.214 3.448 19.472 C 4.083 19.718 4.81 19.889 5.877 19.936 C 6.944 19.984 7.282 19.996 10 19.996 C 12.718 19.996 13.056 19.984 14.123 19.936 C 15.187 19.889 15.913 19.718 16.552 19.472 C 17.21 19.218 17.766 18.873 18.321 18.317 C 18.877 17.762 19.218 17.202 19.476 16.548 C 19.722 15.913 19.893 15.186 19.94 14.119 C 19.988 13.052 20 12.714 20 9.996 C 20 7.278 19.988 6.94 19.94 5.873 C 19.893 4.81 19.722 4.083 19.476 3.444 C 19.222 2.786 18.877 2.23 18.321 1.675 C 17.766 1.119 17.206 0.778 16.552 0.52 C 15.917 0.274 15.19 0.103 14.123 0.056 C 13.052 0.012 12.71 0 9.996 0 Z M 9.996 1.802 C 12.667 1.802 12.98 1.813 14.036 1.861 C 15.012 1.905 15.54 2.067 15.893 2.206 C 16.361 2.389 16.694 2.603 17.044 2.952 C 17.393 3.302 17.611 3.635 17.79 4.103 C 17.925 4.456 18.091 4.984 18.135 5.96 C 18.183 7.016 18.194 7.329 18.194 10 C 18.194 12.671 18.183 12.984 18.135 14.04 C 18.091 15.016 17.929 15.544 17.79 15.897 C 17.607 16.365 17.393 16.698 17.044 17.048 C 16.694 17.397 16.361 17.615 15.893 17.794 C 15.54 17.929 15.012 18.095 14.036 18.139 C 12.98 18.186 12.667 18.198 9.996 18.198 C 7.325 18.198 7.012 18.186 5.956 18.139 C 4.98 18.095 4.452 17.933 4.099 17.794 C 3.631 17.611 3.298 17.397 2.948 17.048 C 2.599 16.698 2.381 16.365 2.202 15.897 C 2.067 15.544 1.901 15.016 1.857 14.04 C 1.81 12.984 1.798 12.671 1.798 10 C 1.798 7.329 1.81 7.016 1.857 5.96 C 1.901 4.984 2.063 4.456 2.202 4.103 C 2.385 3.635 2.599 3.302 2.948 2.952 C 3.298 2.603 3.631 2.385 4.099 2.206 C 4.452 2.071 4.98 1.905 5.956 1.861 C 7.012 1.81 7.329 1.802 9.996 1.802 Z" fill="rgb(0,0,0)"  />
    </g>
  </symbol>
</svg>
```

JSON 格式数据结构预览

```JSON
{
  "name": "FigmaIcon",
  "description": "",
  "width": 24,
  "height": 24,
  "id": [
    "3627:1307",
    "046c56ddfafa72e2cbb4b521de681feed7b9db0b"
  ],
  "paths": [
    {
      "color": {
        "r": 0,
        "g": 0,
        "b": 0
      },
      "evenodd": false,
      "opacity": 1,
      "path": [
        "M 3.9 0 L 9.9 0 C 12.053 0 13.8 1.747 13.8 3.9 C 13.8 5.106 13.252 6.185 12.391 6.9 C 13.252 7.616 13.8 8.694 13.8 9.9 C 13.8 12.053 12.053 13.8 9.9 13.8 C 9.127 13.8 8.406 13.575 7.8 13.186 L 7.8 15.9 C 7.8 18.053 6.053 19.8 3.9 19.8 C 1.747 19.8 0 18.053 0 15.9 C 0 14.694 0.548 13.616 1.409 12.9 C 0.548 12.184 0 11.106 0 9.9 C 0 8.694 0.548 7.616 1.409 6.9 C 0.548 6.185 0 5.106 0 3.9 C 0 1.747 1.747 0 3.9 0 Z M 1.8 3.9 C 1.8 2.741 2.741 1.8 3.9 1.8 L 6 1.8 L 6 6 L 3.9 6 C 2.741 6 1.8 5.059 1.8 3.9 Z M 6 9.902 C 6 9.901 6 9.901 6 9.9 C 6 9.899 6 9.899 6 9.898 L 6 7.8 L 3.9 7.8 C 2.741 7.8 1.8 8.741 1.8 9.9 C 1.8 11.059 2.741 12 3.9 12 L 6 12 L 6 9.902 Z M 7.8 9.9 C 7.8 11.059 8.741 12 9.9 12 C 11.059 12 12 11.059 12 9.9 C 12 8.741 11.059 7.8 9.9 7.8 C 8.741 7.8 7.8 8.741 7.8 9.9 Z M 9.9 6 C 11.059 6 12 5.059 12 3.9 C 12 2.741 11.059 1.8 9.9 1.8 L 7.8 1.8 L 7.8 6 L 9.9 6 Z M 1.8 15.9 C 1.8 14.741 2.741 13.8 3.9 13.8 L 6 13.8 L 6 15.9 C 6 17.059 5.059 18 3.9 18 C 2.741 18 1.8 17.059 1.8 15.9 Z"
      ],
      "x": 5.1,
      "y": 2.1
    }
  ]
}
```

调研下来，JSON 虽易读，若要再编译成各端格式，往往仍要各端各用各的技术栈。前端的方案是直接消费 SVG Symbol，打包进 React 组件、用 Props 调图标；构建阶段再用 Node 工具把 Symbol 拆成适合移动端的单文件 SVG。整条链路可以交给 GitHub Actions 一类流程自动化，统一格式与交付也就闭环了。

## 版本管理  {#版本管理}

最后一个问题乍看棘手，其实前面几步已经埋好答案：用 GitHub 管代码即可。只是 GitHub 面向工程思维，我能逐行读 SVG 的 Diff，不是所有设计师都习惯这一套。

# 未来  {#未来}

![VectorS GitHub 版本管理设想](https://mysite2026-blog-cyn6.vercel.app/blog/shore/icon11.png)  <!-- natural 1584x1101 -->

接下来想把 VectorS 接到 GitHub：身份验证通过后，插件读取仓库里约定的 SVG Symbol，在界面里渲染出来，再通过 API 拉 Diff 做图形化对比——有点像 Abstract 在做的事。

我会尽量把这套流程带进以后的项目，也不排除把它做成自己的第一个小产品。回头看，以前对计算机图形只有模糊印象，这次折腾下来，总算又往清楚走近了一点。
````

### 3.6 `/teambition`
- title=Teambition | scrollHeight 1440x900=900 | 390x844=906 | 1920x1080=1080 | chars=243 | TOC=none
- children (1440): header@96h227, div@339h128, footer@531h271
- children (390): header@72h192, div@280h161, footer@505h329
**Media (in DOM order)**
| # | element | original src | local file | natural | 1440 rendered (x,w×h) | 390 rendered | alt |
|---|---|---|---|---|---|---|---|

**Content (verbatim)**
````markdown
[[TITLE]] # Teambition
[[DATE]] May 31, 2026
[[YEARS]] 2018-2020

Work in progress — this page is not finished yet.

From 2018 to 2020, I worked on product and design at Teambition (Alibaba), focused on collaboration and project management. More details coming soon.

[teambition.com](https://www.teambition.com/)
````

---

## 4. Mobile (390x844) differences
`useIsMobile` / lg breakpoint = 1024 px. Measured at 390x844:
- **Article:** padding 72/24 (`py-18`), content width 342. Header `pt-[10vh]` = 84.4 px.
- **Type:**
  - h1 title 30/37.5 with letter-spacing −0.75.
  - Date and years 14/22.75.
  - Intro and body `p` 14/22.75.
  - **`li` stays 16/26.**
  - Inline code 12.6 px.
  - MDX h1 24/30 mt 48, h2 20/25 mt 40, h3 18/24.75 mt 32.
- **Heading `#` hover glyph:** hidden.
- **Code block:** header `px-3` (12), pre padding 8/16, 12/19.5 text.
- **Image grid:** 1 column (342 wide, 16:9 slides 342×193.3).
- **Figures:** 342 wide, height by natural aspect.
- **iframe:** 342×600.
- **Metadata:** padding 16, 2-column grids (143 px columns). Characters wraps to row 2 and the "Links" label is hidden, giving a height of 329.
- **TOC:** hidden (only at ≥1536).
- **HUD:**
  - The hamburger replaces the nav.
  - The bottom row shows `HH:MM NN°C`.
  - The coords readout, globe and progress bar are hidden.
  - The circular to-top ring appears once scrollTop ≥ 36.
- **Scroll heights** (390x844): reunimos 2149, inspire_mono 4332, wasm 3086, adrive 7101, shore 8407, teambition 906.

## 5. 404 / not-found
`GET /this-does-not-exist-xyz` returns HTTP **404** with `<title>404: This page could not be found.</title>`. It is Next.js's built-in not-found UI rendered **inside the subpage layout**: the same header/HUD, the plain scroll container and the same `article[data-mdx-article] > div.space-y-4…` wrapper, but **no title block, no Metadata footer and no TOC**. Markup (inline styles, `_reference/pages/404.html`):
```html
<div style="font-family:system-ui,"Segoe UI",Roboto,Helvetica,Arial,sans-serif,"Apple Color Emoji","Segoe UI Emoji";height:100vh;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center">
  <div><style>body{color:#000;background:#fff;margin:0}.next-error-h1{border-right:1px solid rgba(0,0,0,.3)}@media (prefers-color-scheme:dark){body{color:#fff;background:#000}.next-error-h1{border-right:1px solid rgba(255,255,255,.3)}}</style>
    <h1 class="next-error-h1" style="display:inline-block;margin:0 20px 0 0;padding:0 23px 0 0;font-size:24px;font-weight:500;vertical-align:top;line-height:49px">404</h1>
    <div style="display:inline-block"><h2 style="font-size:14px;font-weight:400;line-height:49px;margin:0">This page could not be found.</h2></div>
  </div>
</div>
```
- The injected `<style>` overrides the body to **pure #fff** (or #000 under OS dark, regardless of THEME).
- The block is 100vh tall and starts below the article's top padding. At 1440x900 the "404 | This page could not be found." row is centred at y ≈ 546, and the container scrollHeight is 1092.
- Screenshot: `recon-pages/d-this-does-not-exist-xyz-top.png`.
- Reachable in-app via `/shore_icon`'s VectorS link (`/stories/figma_and_me#vectors`), which goes through the route transition.

## 6. Assets
Subpage asset sources:
- **Images:** all from `/blog/{adrive,mono,shore}/…`, referenced via `https://mysite2026-blog-cyn6.vercel.app` but identical at `https://haoqi.design/blog/…`.
- **Download:** `/fonts/InspireMono.zip`.

The subpages use no videos, posters, Rive files or new fonts (they reuse TikTok Sans, Geist Mono and Departure Mono already in `public/fonts`). There are no `<picture>`/`srcset` variants.

Downloaded from haoqi.design into `public/` (none were already present). **41 files, 18,885,298 bytes (18.0 MiB):**
- `public/blog/adrive/`: `ad1.jpg` … `ad14.jpg`/`.png`, 14 files, 10,864,149 B.
  - jpg: ad1, ad2, ad9–ad14. png: ad3–ad8.
  - Naturals: ad1 2251×1621, ad2 2251×1620, ad3–6 1920×1080, ad7 1920×1128, ad8 2168×1628, ad9–14 2520×1621.
- `public/blog/mono/`: `Cover.png`, `1.png` … `14.png`. 15 files, 2,101,910 B, all 1920×1080.
- `public/blog/shore/`: `icon01.png` … `icon11.png`, 11 files, 5,857,376 B.
  - Naturals: 01 1504×1454, 02 1564×976, 03 1736×960, 04 2418×1306, 05 1500×750, 06 2000×1051, 07 2174×1492, 08 1736×1090, 09 3206×566, 10 2474×1256, 11 1584×1101.
- `public/fonts/InspireMono.zip`: 61,863 B. It contains `InspireMono-Regular.otf`, `InspireMono-Bold.otf` and `__MACOSX` junk. The download button links to it directly; do not unzip it.

Third-party (recorded only, not downloaded):
- `https://www.reunimos.cc` (iframe). It loads `/src/index.js`, `/asset/index.DCtRznt-.css`, fonts `InspireMono-*.otf` and `InterVariable.woff2`, and `/img/s13.jpg` and `s14.jpg` from www.reunimos.cc.
- QWeather API (HUD, same as home).

## 7. Open questions / not determined
1. **Subpage→subpage scroll landing at 96 px.** I measured it once, starting from scrollTop 300. I believe it is Next.js App Router's `ScrollAndFocusHandler` scrolling the new segment into view, but I did not trace it in `56b0d…`. It may differ if the old scroll position is above 96.
2. **Lightbox timing.** I took the 0.45 s `[0.4,0,0.1,1]` from framer-motion's built-in default layout transition, because no `MotionConfig`/`transition` prop is set on the `motion.img`. I did not frame-time it (headless screenshots are too slow).
3. **Route-transition durations.** The 0.8 s cover and 0.8 s reveal are from code. The wall-clock numbers above are from slow SwiftShader frames and only show ordering.
4. **The page/RSC layer** (title block, intro wrapper, image grid, download pill) is not in client JS, so I inferred their props (`title`, `updated`, `years`) from the rendered HTML and the RSC payload. The frontmatter field names other than `updated` (an `ArticleFooter` prop) are guesses.
5. **The CJK fallback font** depends on the platform. PingFang SC was verified on macOS Chromium; other OSes will differ, just as on the original.
6. **iframe contents** (reunimos.cc) are a live third-party site. It renders differently over time and is not part of the clone.
7. **I did not confirm `/stories/figma_and_me` exists anywhere.** The RSC prefetch for it returned 404.
