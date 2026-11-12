# haoqi.design — local clone

Local study clone of https://haoqi.design/ (React 19 + Vite, three.js r184, Lenis). Not for deployment: it reproduces another designer's portfolio content.

```bash
npm ci && npm run dev    # http://localhost:5192
```

Build specs: `CLONE_SPEC.md` (home), `CLONE_SPEC_PAGES.md` (project articles + 404), `SHADERS.md` (verbatim GLSL).

## Information architecture

`ia.json` is the only IA file to hand-edit. `IA.md` and `matrix.csv` are **generated** — don't edit them; regenerate with:

```bash
node validate.mjs && node build.mjs
```

What the data shows (status: draft):

- 8 routes across 3 templates:
  - home (1 route)
  - project article (6 routes)
  - a not-found page standing for every unknown path (1)

  The home page carries 11 of the 17 sections. All 6 articles share one 9-section shape, so the article build effort is one template filled with 6 pages' content.
- 4 sections are shared across all three templates, and all are shell: header nav, the bottom status row, scroll progress and the dot-iris transition mask. The grid overlay and the WebGL backdrop are home-only.
- The other 13 sections are single-template.
  - The 7 home-only sections (grid overlay, WebGL backdrop and 5 content sections) are 1-route by design.
  - The 5 article sections repeat across 6 routes, so they are shared article components. `article.toc` renders only on the 3 articles whose body has headings.
  - The last single-template section is the not-found message.
- Every section now names the component that renders it (`implementedBy`).

Excluded on purpose: `/2026` and `/unlock/*` (passcode-protected on the original). Outbound card links (Figma plugins, Friends of Figma events) and social/mailto links are not routes.
