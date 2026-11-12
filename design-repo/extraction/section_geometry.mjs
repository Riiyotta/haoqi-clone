// Shared in-page classifier: rendered DOM -> design-repo semantic sections (document Y + height, no copy text).
// Used by measure_sections.mjs and parity/capture.mjs so both cut pages identically.
export function collect() {
  const r2 = (n) => Math.round(n * 100) / 100
  const lenis = document.querySelector('.lenis')
  if (lenis && lenis.firstElementChild) {
    const c = lenis.firstElementChild
    const base = c.getBoundingClientRect().top
    const kids = [...c.children].filter((e) => getComputedStyle(e).position !== 'fixed')
    const box = (e) => { const b = e.getBoundingClientRect(); return { top: r2(b.top - base), height: r2(b.height) } }
    const [banner, about, work, hyper, footer] = kids
    const out = [
      { id: 'hero.banner', ...box(banner) },
      { id: 'intro.about', ...box(about) },
      { id: 'work.selected-grid', ...box(work) },
    ]
    // The hyper-space wrapper is one sticky container whose scroll span is cut into 4 stages of 2 segments
    // (segH = wrapper height / 8). Each stage is a distinct content state, so it is its own semantic section.
    const hb = box(hyper)
    const segH = hb.height / 8
    const stages = [['statement.stage-headline', 'primary'], ['statement.stage-headline', 'secondary'], ['statement.stage-sentences', null], ['statement.stage-headline', 'closing']]
    stages.forEach(([id, variant], k) => out.push({ id, variant, top: r2(hb.top + 2 * k * segH), height: r2(2 * segH), derivedFrom: { wrapper: 'hyper-space', wrapperHeight: hb.height, segments: [2 * k, 2 * k + 1] } }))
    out.push({ id: 'contact.footer-cta', ...box(footer) })
    return { kind: 'home', pageHeight: lenis.scrollHeight, sections: out, stageWrapper: hb }
  }
  const scroller = document.querySelector('div.fixed.inset-0 > div.overflow-y-auto')
  const art = scroller && scroller.querySelector('article[data-mdx-article]')
  if (!art) return { kind: 'unknown' }
  const prose = art.firstElementChild
  const sTop = scroller.getBoundingClientRect().top - scroller.scrollTop
  const kids = [...prose.children]
  const top = (e) => e.getBoundingClientRect().top - sTop
  const toc = document.querySelector('nav[aria-label]')
  const hasFooter = !!prose.querySelector('[data-mdx-footer]')
  if (!hasFooter && kids.length === 1 && !kids[0].matches('header')) {
    const e = kids[0]
    return { kind: 'not-found', pageHeight: scroller.scrollHeight, sections: [{ id: 'error.not-found', top: r2(top(e)), height: r2(e.getBoundingClientRect().height) }], toc: !!toc }
  }
  // Each block runs from its own top to the next block's top (collapsed margins included), so the
  // in-flow sections partition the article column without gaps.
  const blocks = []
  let body = []
  const flush = () => { if (body.length) { blocks.push({ kind: 'body', els: body }); body = [] } }
  for (const e of kids) {
    if (e.matches('header')) { flush(); blocks.push({ kind: 'article.header', els: [e] }) }
    else if (e.matches('footer[data-mdx-footer]')) { flush(); blocks.push({ kind: 'article.meta-footer', els: [e] }) }
    else if (e.matches('iframe')) { flush(); blocks.push({ kind: 'article.live-embed', els: [e] }) }
    else if (e.matches('a[download]')) { flush(); blocks.push({ kind: 'article.download-cta', els: [e] }) }
    else if (e.matches('[data-mdx-image-grid]')) { flush(); blocks.push({ kind: 'article.image-grid', els: [e] }) }
    else if (blocks.length && blocks[blocks.length - 1].kind === 'article.header' && e.tagName === 'DIV' && !body.length) blocks.push({ kind: 'article.intro', els: [e] })
    else body.push(e)
  }
  flush()
  const pageHeight = scroller.scrollHeight
  const out = []
  const levelOf = (e) => (/^H[1-6]$/.test(e.tagName) ? Number(e.tagName[1]) : null)
  // Split a run of body elements into heading-bounded chapters at `level`; any chapter holding > 50 % of the
  // page is split again at the next heading level present (real content boundaries only).
  const chapters = (els, level, endTop) => {
    const parts = []
    let cur = null
    for (const e of els) {
      if (levelOf(e) === level || !cur) { cur = { els: [] }; parts.push(cur) }
      cur.els.push(e)
    }
    const res = []
    parts.forEach((p, i) => {
      const t = top(p.els[0])
      const end = i + 1 < parts.length ? top(parts[i + 1].els[0]) : endTop
      const lv = levelOf(p.els[0])
      const sub = p.els.slice(1).map(levelOf).filter((x) => x && x > (lv || 0))
      if ((end - t) / pageHeight > 0.5 && sub.length) {
        const next = Math.min(...sub)
        const head = p.els[0]
        const rest = chapters(p.els.slice(1), next, end)
        res.push({ level: lv, top: t, end: rest.length ? rest[0].top : end, split: true, headingIndex: kids.indexOf(head) })
        res.push(...rest)
      } else res.push({ level: lv, top: t, end, headingIndex: kids.indexOf(p.els[0]) })
    })
    return res
  }
  blocks.forEach((b, i) => {
    const t = top(b.els[0])
    const nextTop = i + 1 < blocks.length ? top(blocks[i + 1].els[0]) : (() => { const l = b.els[b.els.length - 1].getBoundingClientRect(); return l.bottom - sTop })()
    if (b.kind !== 'body') { out.push({ id: b.kind, top: r2(t), height: r2(nextTop - t) }); return }
    const lv = Math.min(...b.els.map(levelOf).filter(Boolean))
    const parts = Number.isFinite(lv) ? chapters(b.els, lv, nextTop) : [{ level: null, top: t, end: nextTop }]
    for (const p of parts) out.push({ id: 'article.chapter', headingLevel: p.level, splitAtNextLevel: !!p.split, top: r2(p.top), height: r2(p.end - p.top) })
  })
  return { kind: 'article', pageHeight, sections: out, toc: !!toc, tocDisplayed: !!toc && getComputedStyle(toc).display !== 'none' }
}

