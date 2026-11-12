// Ports of orig 78825 (MdxTableOfContents) and 54450 (ArticleFooter "Metadata" box).
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { usePathname } from '../../lib/router.js'
import { scrollEnv } from '../../lib/scroll.js'
import { goToHomeAnchor } from '../../lib/navigation.js'
import { DOTTED_BORDER_BASE } from '../../lib/dotted.js'
import { useWindowSize } from '../../hooks/useWindowSize.js'
import ScrambleText from '../ScrambleText.jsx'
import TransitionLink from '../TransitionLink.jsx'
import { MDX_HEADING_ANCHOR_OFFSET_PX, scrollToMdxAnchorTarget } from './MdxBasics.jsx'

function useContainerEl() {
  const [el, set] = useState(() => scrollEnv.getContainerEl())
  useEffect(() => { set(scrollEnv.getContainerEl()); return scrollEnv.subscribeContainerEl((e) => set(e)) }, [])
  return el
}

function collectHeadings(article) {
  const out = []
  for (const e of article.querySelectorAll('h1, h2, h3')) {
    if (!(e instanceof HTMLElement) || !e.id) continue
    const c = e.cloneNode(true)
    c.querySelectorAll('span[aria-hidden="true"]').forEach((x) => x.remove())
    out.push({ id: e.id, label: (c.textContent ?? '').replace(/\s+/g, ' ').trim(), level: Number(e.tagName.slice(1)) })
  }
  return out
}

export function MdxTableOfContents() {
  const pathname = usePathname()
  const container = useContainerEl()
  const [items, setItems] = useState([])
  const [active, setActive] = useState(null)
  useEffect(() => {
    const e = () => {
      const a = document.querySelector('article[data-mdx-article]')
      setItems(a instanceof HTMLElement ? collectHeadings(a) : [])
    }
    e()
    const t = window.setTimeout(e, 0)
    const l = window.setTimeout(e, 150)
    return () => { window.clearTimeout(t); window.clearTimeout(l) }
  }, [pathname])
  useEffect(() => {
    if (items.length === 0) { setActive(null); return }
    const e = () => {
      const els = items.map((x) => document.getElementById(x.id)).filter((x) => x !== null)
      if (els.length === 0) return
      let t = els[0]
      for (const n of els) if (n.getBoundingClientRect().top <= MDX_HEADING_ANCHOR_OFFSET_PX) t = n
      setActive(t.id || items[0].id)
    }
    e()
    const t = container ?? window
    t.addEventListener('scroll', e, { passive: true })
    window.addEventListener('resize', e)
    const art = document.querySelector('article[data-mdx-article]')
    const ro = typeof ResizeObserver !== 'undefined' && art ? new ResizeObserver(() => e()) : null
    ro?.observe(art)
    const r = window.setTimeout(e, 100)
    return () => { t.removeEventListener('scroll', e); window.removeEventListener('resize', e); ro?.disconnect(); window.clearTimeout(r) }
  }, [items, pathname, container])
  if (items.length === 0) return null
  return (
    <nav aria-label="本页目录" className="pointer-events-auto fixed inset-y-0 left-0 z-20 hidden min-h-0 w-[320px] flex-col overflow-hidden 2xl:flex pl-14 pr-2">
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-y-contain no-scrollbar">
          <div className="box-border flex min-h-full flex-col py-7">
            <div className="flex min-h-0 flex-1 flex-col justify-center gap-1 p-2 text-sm leading-snug text-l2">
              {items.map((e, l) => {
                const n = e.level === 1 ? 0 : e.level === 2 ? 8 : 16
                const r = `#${encodeURIComponent(e.id)}`
                return (
                  <a
                    key={`${e.id}-${l}`}
                    href={r}
                    title={e.label}
                    aria-current={e.id === active ? 'location' : undefined}
                    className={`block min-w-0 shrink-0 cursor-pointer truncate rounded-md py-0.5 transition-colors hover:text-l1 ${e.id === active ? 'text-l1' : 'text-l2'}`}
                    style={{ paddingLeft: `${n}px` }}
                    onClick={(t) => {
                      t.preventDefault()
                      setActive(e.id)
                      const el = document.getElementById(e.id)
                      if (el) scrollToMdxAnchorTarget(el)
                      history.replaceState(null, '', r)
                    }}
                  >
                    {e.label}
                  </a>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </nav>
  )
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const SOCIALS = [
  { href: 'https://twitter.com/wenhaoqi', label: 'Twitter/X' },
  { href: 'https://github.com/wenhaoqiasd', label: 'GitHub' },
  { href: 'https://www.figma.com/@wenhaoqi', label: 'Figma' },
]
function parseUpdated(A) {
  const e = A.trim()
  if (/^\d{8}$/.test(e)) {
    const y = Number(e.slice(0, 4)), m = Number(e.slice(4, 6)) - 1, d = Number(e.slice(6, 8)), n = new Date(y, m, d)
    return n.getFullYear() === y && n.getMonth() === m && n.getDate() === d ? n : null
  }
  const t = /^(\d{4})-(\d{2})-(\d{2})$/.exec(e)
  if (t) {
    const y = Number(t[1]), m = Number(t[2]) - 1, d = Number(t[3]), n = new Date(y, m, d)
    return n.getFullYear() === y && n.getMonth() === m && n.getDate() === d ? n : null
  }
  const a = Date.parse(e)
  return Number.isNaN(a) ? null : new Date(a)
}
function formatUpdated(A) {
  const e = parseUpdated(A)
  if (!e) return A.trim()
  return `${MONTHS[e.getMonth()]} ${String(e.getDate()).padStart(2, '0')}, ${e.getFullYear()}`
}

function MetaItem({ label, value, startDelayMs = 300 }) {
  return (
    <div className="flex flex-col gap-1.5">
      <dt className="font-sans font-semibold text-l1 text-sm">{label}</dt>
      <dd><ScrambleText text={value} className="font-mono tabular-nums text-l2 text-sm" startDelayMs={startDelayMs} scrambleColors={false} /></dd>
    </div>
  )
}
const LINK_CLS = `${DOTTED_BORDER_BASE} inline-block -mx-1 px-1 py-0.5 text-l2 lg:hover:text-l1 text-sm transition-colors`

export function ArticleFooter({ updated }) {
  const { width: r, height: y } = useWindowSize()
  const pathname = usePathname()
  const ref = useRef(null)
  const [count, setCount] = useState(null)
  useLayoutEffect(() => {
    const t = ref.current?.closest('[data-mdx-article]')
    if (t instanceof HTMLElement) {
      const c = t.cloneNode(true)
      c.querySelector('[data-mdx-footer]')?.remove()
      setCount([...(c.textContent ?? '').trim()].length)
    }
  }, [pathname])
  const f = count !== null ? count.toLocaleString('en-US') : '—'
  return (
    <footer ref={ref} data-mdx-footer="true" className="bg-[rgba(var(--label-d),0.03)] mt-16 p-4 lg:p-6 rounded-xl">
      <div className="mb-5 font-sans font-semibold text-l1 text-base">Metadata</div>
      <dl className="gap-x-6 gap-y-6 grid grid-cols-2 lg:grid-cols-3">
        <MetaItem label="Last Updated" value={updated ? formatUpdated(updated) : '—'} startDelayMs={300} />
        <MetaItem label="Dimensions" value={`${r}×${y}`} startDelayMs={360} />
        <MetaItem label="Characters" value={f} startDelayMs={420} />
      </dl>
      <div className="my-6 border-line border-t border-dashed" />
      <div className="gap-x-6 gap-y-4 grid grid-cols-2 lg:grid-cols-3">
        <div className="hidden lg:block font-sans font-semibold text-l1 text-sm">Links</div>
        <div className="flex flex-col items-start gap-1 font-mono">
          <TransitionLink href="/" className={LINK_CLS}><ScrambleText text="Home" startDelayMs={300} scrambleColors={false} /></TransitionLink>
          <button type="button" onClick={() => goToHomeAnchor('#selected-work')} className={`${LINK_CLS} text-left cursor-pointer`}>
            <ScrambleText text="Work" startDelayMs={300} scrambleColors={false} />
          </button>
          <button type="button" onClick={() => goToHomeAnchor('#contact')} className={`${LINK_CLS} text-left cursor-pointer`}>
            <ScrambleText text="Contact" startDelayMs={300} scrambleColors={false} />
          </button>
        </div>
        <div className="flex flex-col items-start gap-1 font-mono">
          {SOCIALS.map(({ href, label }) => (
            <a key={href} href={href} target="_blank" rel="noopener noreferrer" className={LINK_CLS}>
              <ScrambleText text={label} startDelayMs={300} scrambleColors={false} />
            </a>
          ))}
        </div>
      </div>
    </footer>
  )
}
