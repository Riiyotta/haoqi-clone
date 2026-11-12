// Port of orig 45556 (selected work grid). Card images are WebGL layers synced to the placeholders.
import { useEffect, useRef, useState } from 'react'
import { WORK_ITEMS, isExternal } from '../lib/workItems.js'
import TransitionLink from './TransitionLink.jsx'

export const SELECTED_WORK_SECTION_ID = 'selected-work'
const ratioCache = {}

export default function SelectedWork() {
  const [ratios, setRatios] = useState(() => ({ ...ratioCache }))
  const [rowGap, setRowGap] = useState(0)
  const gridRef = useRef(null)
  const items = WORK_ITEMS

  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const upd = () => setRowGap(el.clientWidth / 12)
    upd()
    const ro = new ResizeObserver(upd)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let dead = false
    const put = (url, w, h) => {
      if (dead || w <= 0 || h <= 0) return
      const r = `${w} / ${h}`
      ratioCache[url] = r
      setRatios((s) => (s[url] === r ? s : { ...s, [url]: r }))
    }
    const imgs = items.map((it) => {
      const img = new window.Image()
      img.decoding = 'async'
      img.onload = () => put(it.imageUrl, img.naturalWidth, img.naturalHeight)
      img.src = it.imageUrl
      if (img.complete && img.naturalWidth > 0 && img.naturalHeight > 0) put(it.imageUrl, img.naturalWidth, img.naturalHeight)
      return img
    })
    return () => { dead = true; for (const i of imgs) i.onload = null }
  }, [items])

  return (
    <section id={SELECTED_WORK_SECTION_ID} className="px-4 lg:px-14 py-18 lg:py-24 w-full">
      <div ref={gridRef} className="grid grid-cols-12 w-full" style={{ rowGap: `${rowGap}px` }}>
        {items.map((t) => {
          const ext = isExternal(t.href)
          const cls = 'group block space-y-3 p-2'
          const label = ext ? `${t.name} - ${t.year} (external)` : `${t.name} - ${t.year}`
          const body = (
            <>
              <div
                data-work-image={t.href}
                data-section={t.href}
                aria-hidden="true"
                className="relative w-full pointer-events-none select-none"
                style={{ aspectRatio: ratios[t.imageUrl] ?? '1 / 1' }}
              >
                {t.codingProject && (
                  <span className="top-0 right-0 z-10 absolute bg-selection px-1 font-mono-2 text-black text-xs uppercase pointer-events-none select-none" aria-hidden="true">Coding Project</span>
                )}
              </div>
              <div className="flex justify-between items-center gap-3 min-w-0 text-xs lg:text-sm uppercase">
                <span className="flex-1 min-w-0 truncate">{t.name}</span>
                <div className="flex items-center gap-2 sm:gap-3 font-mono-2 tabular-nums whitespace-nowrap shrink-0">
                  <span>{t.year}</span>
                  {t.type !== 'post' && (
                    <span className="hidden lg:inline-flex items-center gap-1" aria-hidden="true">
                      <span>{t.type}</span>
                      <span>↗</span>
                    </span>
                  )}
                </div>
              </div>
            </>
          )
          return (
            <article key={t.href} className={t.gridClass ?? 'col-span-12 lg:col-span-6 xl:col-span-4'}>
              {ext
                ? <a href={t.href} target="_blank" rel="noopener noreferrer" className={cls} aria-label={label}>{body}</a>
                : <TransitionLink href={t.href} className={cls} aria-label={label}>{body}</TransitionLink>}
            </article>
          )
        })}
      </div>
    </section>
  )
}
