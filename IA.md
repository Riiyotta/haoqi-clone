# Local clone of https://haoqi.design/ (this repo). Home measured from the built clone + CLONE_SPEC.md; article and not-found templates from CLONE_SPEC_PAGES.md (live recon of all 6 subpages + a 404).

Source: Local clone of https://haoqi.design/ (this repo). Home measured from the built clone + CLONE_SPEC.md; article and not-found templates from CLONE_SPEC_PAGES.md (live recon of all 6 subpages + a 404).
Status: **measured-from-clone — all 8 routes built; home QA'd against live, article/not-found pages verified against live recon**
8 routes · 3 templates · 17 unique sections

> Generated from `ia.json` by `build.mjs`. Edit the JSON, not this file.

## Shape of the site

The largest 3 templates (Project article, Home (scroll-driven WebGL portfolio), Not found (404)) account for 8 of 8 routes (100%). The remaining 0 routes span 0 templates.

| template | routes | share |
|---|---:|---:|
| Project article | 6 | 75% |
| Home (scroll-driven WebGL portfolio) | 1 | 13% |
| Not found (404) | 1 | 13% |

## Page chrome

**1 routes carry chrome = `hud+webgl`** — Home (scroll-driven WebGL portfolio).

**7 routes carry chrome = `hud`** — Project article, Not found (404).

## Sections by reuse

How widely a section is shared determines whether it belongs in a shared
component library or stays local to its page.

| section | category | templates | routes | implementation | scope |
|---|---|---:|---:|---|---|
| `shell.header-nav` | SHELL | 3 | 8 | `Header.jsx, Toggles.jsx` | All 8 routes. |
| `shell.status-row` | SHELL | 3 | 8 | `Header.jsx, RotatingGlobe.jsx` | All 8 routes. |
| `shell.scroll-progress` | SHELL | 3 | 8 | `ScrollProgress.jsx` | All 8 routes. |
| `shell.transition-mask` | SHELL | 3 | 8 | `webgl/TransitionCanvas.jsx` | All 8 routes (entry and every route change). |
| `article.header` | ARTICLE | 1 | 6 | `pages/ArticlePage.jsx (content: pages/content/<slug>.json)` | All 6 article routes. |
| `article.body` | ARTICLE | 1 | 6 | `pages/ArticlePage.jsx > renderNode + components/mdx/MdxBasics.jsx (MdxHeading, MdxA, MdxPre), MdxImg.jsx` | All 6 article routes. |
| `article.intro` | ARTICLE | 1 | 6 | `pages/ArticlePage.jsx (content: pages/content/<slug>.json)` | All 6 article routes. |
| `article.toc` | ARTICLE | 1 | 6 | `components/mdx/ArticleChrome.jsx > MdxTableOfContents` | Article routes whose body has headings (wasm_design_utils, adrive, shore_icon); other articles render no TOC. |
| `article.meta-footer` | ARTICLE | 1 | 6 | `components/mdx/ArticleChrome.jsx > ArticleFooter` | All 6 article routes. |
| `shell.grid-overlay` | SHELL | 1 | 1 | `GridOverlay.jsx` | Home only (not rendered on article or not-found routes). |
| `backdrop.webgl-scene` | BACKDROP | 1 | 1 | `webgl/Scene.jsx (+ Bokeh, Glass, Stickers, DotOverlay, HyperCursor, ImageLayers, PostEffects)` | Home only. |
| `hero.banner` | HERO | 1 | 1 | `Hero.jsx` | Home only. |
| `intro.about` | INTRO | 1 | 1 | `About.jsx` | Home only. |
| `work.selected-grid` | WORK | 1 | 1 | `SelectedWork.jsx (data: lib/workItems.js)` | Home only. |
| `statement.hyper-space` | STATEMENT | 1 | 1 | `Innovate.jsx` | Home only. |
| `contact.footer-cta` | CONTACT | 1 | 1 | `Footer.jsx` | Home only. |
| `error.not-found` | ERROR | 1 | 1 | `pages/NotFoundPage.jsx` | Any unknown path. |

**4 shared sections** appear in more than one template and belong in a component library.

**13 single-use sections** appear in exactly one template. Building these
as "reusable" components up front would be speculative — keep them page-local
until a second caller actually appears.

## Templates

### Home (scroll-driven WebGL portfolio) — `template.home`

1 route · `/` · chrome: **hud+webgl**

| # | category | section | |
|---:|---|---|---|
| 1 | SHELL | `shell.header-nav` | shared ×3 |
| 2 | SHELL | `shell.status-row` | shared ×3 |
| 3 | SHELL | `shell.grid-overlay` | page-local |
| 4 | SHELL | `shell.scroll-progress` | shared ×3 |
| 5 | SHELL | `shell.transition-mask` | shared ×3 |
| 6 | BACKDROP | `backdrop.webgl-scene` | page-local |
| 7 | HERO | `hero.banner` | page-local |
| 8 | INTRO | `intro.about` | page-local |
| 9 | WORK | `work.selected-grid` | page-local |
| 10 | STATEMENT | `statement.hyper-space` | page-local |
| 11 | CONTACT | `contact.footer-cta` | page-local |

### Project article — `template.article`

6 routes · `/reunimos`, `/inspire_mono`, `/wasm_design_utils`, `/adrive`, `/shore_icon`, `/teambition` · chrome: **hud**

| # | category | section | |
|---:|---|---|---|
| 1 | SHELL | `shell.header-nav` | shared ×3 |
| 2 | SHELL | `shell.status-row` | shared ×3 |
| 3 | SHELL | `shell.scroll-progress` | shared ×3 |
| 4 | SHELL | `shell.transition-mask` | shared ×3 |
| 5 | ARTICLE | `article.toc` | page-local |
| 6 | ARTICLE | `article.header` | page-local |
| 7 | ARTICLE | `article.intro` | page-local |
| 8 | ARTICLE | `article.body` | page-local |
| 9 | ARTICLE | `article.meta-footer` | page-local |

### Not found (404) — `template.not-found`

1 route · `/<any unknown path>` · chrome: **hud**

| # | category | section | |
|---:|---|---|---|
| 1 | SHELL | `shell.header-nav` | shared ×3 |
| 2 | SHELL | `shell.status-row` | shared ×3 |
| 3 | SHELL | `shell.scroll-progress` | shared ×3 |
| 4 | SHELL | `shell.transition-mask` | shared ×3 |
| 5 | ERROR | `error.not-found` | page-local |

## Section reference

### SHELL

_Fixed site chrome layered over every page: header HUD, status row, overlays, page-transition mask._

**`shell.header-nav`** — Fixed top row: HAOQI.DESIGN wordmark (home link) plus WORK / CONTACT scroll links and the THEME[L|D|A] and SOUND[x] toggles; collapses to a hamburger + full-screen menu below 1024px. Text turns white over the dark warp scene.

· All 8 routes. · appears on 8 routes · implemented by `Header.jsx, Toggles.jsx`

**`shell.status-row`** — Fixed bottom row: GMT+8 clock + temperature line (replaced by HAOQI (C) YEAR near the end of the home page only), pointer coordinate readout (click scrolls to top) and the rotating wireframe globe icon.

· All 8 routes. · appears on 8 routes · implemented by `Header.jsx, RotatingGlobe.jsx`

**`shell.grid-overlay`** — Fixed difference-blended SVG grid: 3–4 vertical column lines and 2 horizontal lines with '+' crosshairs, sized from the viewport.

· Home only (not rendered on article or not-found routes). · appears on 1 routes · implemented by `GridOverlay.jsx`

**`shell.scroll-progress`** — Right-edge vertical scroll thumb on desktop (visible on mount and for 2s after each scroll); circular scroll-to-top ring on mobile once scrolled. Tracks Lenis on home and the native scroll container elsewhere.

· All 8 routes. · appears on 8 routes · implemented by `ScrollProgress.jsx`

**`shell.transition-mask`** — Separate overlay canvas drawing a halftone dot-iris that covers/reveals the page on first load, route changes and mobile menu open, with the loader progress bar on entry.

· All 8 routes (entry and every route change). · appears on 8 routes · implemented by `webgl/TransitionCanvas.jsx`

### BACKDROP

_Full-viewport WebGL canvas behind the scrolling content._

**`backdrop.webgl-scene`** — three.js scene behind the scroll content: blue bokeh light-streak background, glass 'hello' / cursor / 'CRAFT & TASTE' models, falling stickers, cream dot overlay, DOM-synced project image layers, giant warp-speed cursor, lens flare + fluid post with lime pointer trail.

· Home only. · appears on 1 routes · implemented by `webgl/Scene.jsx (+ Bokeh, Glass, Stickers, DotOverlay, HyperCursor, ImageLayers, PostEffects)`

### HERO

_Page-opening composition of the home page._

**`hero.banner`** — One-viewport opener: 'Design & Engineering' label, 'Thinking in systems' line, bio paragraph with masked employer slot, and the 3-line 'I BRING CRAFT & TASTE TO DIGITAL WORK' headline, over the glass 'hello' model.

· Home only. · appears on 1 routes · implemented by `Hero.jsx`

### INTRO

_Personal introduction block following the hero._

**`intro.about`** — Portrait photo (WebGL negative-to-positive reveal) with lime handwritten signature that draws on view, plus two large statement paragraphs with inline links to reunimos™, aDrive and Teambition.

· Home only. · appears on 1 routes · implemented by `About.jsx`

### WORK

_Index of projects linking to article pages or external sites._

**`work.selected-grid`** — #selected-work asymmetric 12-column grid of 10 project cards (image drawn by WebGL with dot-wipe hover swap, optional CODING PROJECT tag, name/year/type row); 6 link to article routes, 4 to external sites.

· Home only. · appears on 1 routes · implemented by `SelectedWork.jsx (data: lib/workItems.js)`

### STATEMENT

_Scroll-pinned manifesto/typographic sequence._

**`statement.hyper-space`** — 8-viewport-tall sticky sequence inside the warp tunnel: 'Innovate with purpose' → 'Innovate with a human touch' → four floating sentences with a lime ellipse ring → 'FUTURE-FIRST ALWAYS', each with staggered per-character fades.

· Home only. · appears on 1 routes · implemented by `Innovate.jsx`

### CONTACT

_Closing call-to-action with contact and social links._

**`contact.footer-cta`** — #contact full-viewport closer: 'LET'S CREATE SOMETHING EXTRAORDINARY' scrambled headline over the glass 'CRAFT & TASTE' model, email link bottom-left, Twitter/X · Figma · GitHub bottom-right.

· Home only. · appears on 1 routes · implemented by `Footer.jsx`

### ARTICLE

_Building blocks of a long-form project write-up page._

**`article.header`** — Article opener: large wide-bold title, last-updated date, hairline divider, then the project's year range (year row omitted when a project has none).

· All 6 article routes. · appears on 6 routes · implemented by `pages/ArticlePage.jsx (content: pages/content/<slug>.json)`

**`article.body`** — Long-form prose (Chinese/English mixed) with h1–h3 headings, inline links and monospace code chips, lists, rules, zoomable rounded image figures (lightbox with dominant-colour backdrop), code blocks with line numbers + COPY, and page-specific embeds (live site iframe, slide image grid, download button).

· All 6 article routes. · appears on 6 routes · implemented by `pages/ArticlePage.jsx > renderNode + components/mdx/MdxBasics.jsx (MdxHeading, MdxA, MdxPre), MdxImg.jsx`

**`article.intro`** — Muted (secondary-label) lead paragraphs directly under the article header, before the body proper.

· All 6 article routes. · appears on 6 routes · implemented by `pages/ArticlePage.jsx (content: pages/content/<slug>.json)`

**`article.toc`** — Fixed left-hand table of contents of the article's h1–h3 headings with active-heading tracking; only shown at very wide viewports (2xl and up).

· Article routes whose body has headings (wasm_design_utils, adrive, shore_icon); other articles render no TOC. · appears on 6 routes · implemented by `components/mdx/ArticleChrome.jsx > MdxTableOfContents`

**`article.meta-footer`** — Tinted rounded 'Metadata' box closing the article: Last Updated, live viewport Dimensions and body Characters count (scrambled in), plus a 'Links' group: Home, Work, Contact (back to home sections) and Twitter/X, GitHub, Figma.

· All 6 article routes. · appears on 6 routes · implemented by `components/mdx/ArticleChrome.jsx > ArticleFooter`

### ERROR

_Fallback content for unknown paths._

**`error.not-found`** — Plain '404 | This page could not be found.' message inside the article column, with no title block, metadata box or TOC.

· Any unknown path. · appears on 1 routes · implemented by `pages/NotFoundPage.jsx`
