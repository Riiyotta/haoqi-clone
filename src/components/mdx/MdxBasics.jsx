// Ports of orig 31250 (MdxH1..6 + scrollToMdxAnchorTarget), 71289 (MdxA) and 93325 (MdxPre).
import { useState } from 'react'
import { scrollEnv } from '../../lib/scroll.js'
import { DOTTED_BORDER_BASE } from '../../lib/dotted.js'
import TransitionLink from '../TransitionLink.jsx'

export const MDX_HEADING_ANCHOR_OFFSET_PX = 96

// orig `i`/`r`
export function scrollToMdxAnchorTarget(el) {
  const t = scrollEnv.getContainerEl()
  if (t) {
    const l = el.getBoundingClientRect().top - t.getBoundingClientRect().top + t.scrollTop - MDX_HEADING_ANCHOR_OFFSET_PX
    scrollEnv.lenisScrollTo(Math.max(0, l), { lerp: 0.1 })
    return
  }
  el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}
const hashOf = (id) => `#${encodeURIComponent(id)}`

const HEADING_SIZES = {
  1: 'mt-12 text-2xl leading-tight lg:mt-14 lg:text-[28px]',
  2: 'mt-10 text-xl leading-tight lg:mt-12 lg:text-2xl',
  3: 'mt-8 text-lg leading-snug lg:mt-10 lg:text-xl',
  4: 'mt-7 text-base leading-snug lg:mt-8 lg:text-lg',
  5: 'mt-6 text-sm leading-snug lg:mt-7 lg:text-[17px]',
  6: 'mt-6 text-sm leading-snug uppercase tracking-wide lg:mt-6 lg:text-base lg:normal-case lg:tracking-normal',
}
export const slugifyHeading = (d) => d.trim().toLowerCase().replace(/[\s　]+/g, '-').replace(/[^\w一-鿿-]+/g, '').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '') || undefined

export function MdxHeading({ level, id, text, children }) {
  const u = id || slugifyHeading(text)
  const onClick = async (e) => {
    if (!u) return
    e.preventDefault()
    const t = document.getElementById(u)
    if (t) scrollToMdxAnchorTarget(t)
    const h = hashOf(u)
    history.replaceState(null, '', h)
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}${h}`
    try { await navigator.clipboard?.writeText(url) } catch {}
  }
  const Tag = `h${level}`
  const cls = ['group relative scroll-mt-24 font-semibold tracking-tight text-l1 [&:first-child]:mt-0', HEADING_SIZES[level]].join(' ')
  return (
    <Tag id={u} className={cls}>
      {u ? (
        <a href={hashOf(u)} onClick={onClick} aria-label={`Copy link to ${text}`} className="relative inline-block text-inherit no-underline">
          <span aria-hidden="true" className="absolute top-0 right-full mr-2 hidden text-l3 opacity-0 transition-opacity select-none lg:inline lg:group-hover:opacity-100 lg:hover:text-l1">#</span>
          {children}
        </a>
      ) : children}
    </Tag>
  )
}

const MDXA_CLS = 'text-[color:var(--label-1)] underline underline-offset-4 decoration-[color:var(--label-3)] transition-colors lg:hover:decoration-[color:var(--label-2)]'
function onHashClick(A) {
  const e = A.currentTarget.getAttribute('href') ?? ''
  if (!e.startsWith('#') || e === '#') return
  const n = document.getElementById(decodeURIComponent(e.slice(1)))
  if (n) { A.preventDefault(); scrollToMdxAnchorTarget(n); history.replaceState(null, '', e) }
}
export function MdxA({ href, children }) {
  const i = href ?? ''
  const g = MDXA_CLS
  if (!i || i.startsWith('#')) return <a href={i} className={g} onClick={i.startsWith('#') ? onHashClick : undefined}>{children}</a>
  if (i.startsWith('//')) return <a href={`https:${i}`} className={g} target="_blank" rel="noopener noreferrer">{children}</a>
  if (/^https?:\/\//i.test(i)) return <a href={i} className={g} target="_blank" rel="noopener noreferrer">{children}</a>
  if (i.startsWith('mailto:') || i.startsWith('tel:')) return <a href={i} className={g}>{children}</a>
  if (i.startsWith('/')) return <TransitionLink href={i} className={g}>{children}</TransitionLink>
  return <a href={i} className={g} target="_blank" rel="noopener noreferrer">{children}</a>
}

const styleCache = new Map()
function parseStyle(s) {
  if (!s) return undefined
  let o = styleCache.get(s)
  if (o) return o
  o = {}
  for (const d of s.split(';')) {
    const i = d.indexOf(':'); if (i < 0) continue
    o[d.slice(0, i).trim().replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = d.slice(i + 1).trim()
  }
  styleCache.set(s, o)
  return o
}

// MdxPre: tokens are the original's prism-react-renderer output (captured per token: text, class, inline style).
export function MdxPre({ lang, label, lines }) {
  const [copied, setCopied] = useState(false)
  const text = lines.map((toks) => toks.map((t) => t[0]).join('').replace(/\n$/, '')).join('\n')
  const copy = async () => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1200)
    } catch { setCopied(false) }
  }
  return (
    <div className="group my-6 overflow-hidden rounded-xl bg-[rgba(var(--label-d),0.03)]">
      <div className="flex items-center justify-between px-3 py-2 shadow-[inset_0_-1px_0_0_var(--line)] lg:px-4">
        <span className="px-1 font-mono text-xs tracking-wide text-(--label-3)">{label}</span>
        <button
          type="button"
          onClick={copy}
          className={`${DOTTED_BORDER_BASE} cursor-pointer px-1 py-0.5 font-mono text-xs uppercase tracking-wide text-(--label-2) transition-colors lg:hover:text-(--label-1) focus-visible:text-(--label-1) focus-visible:outline-none focus-visible:before:border-l1`}
          aria-label={copied ? 'Copied code' : 'Copy code'}
        >
          {copied ? 'COPIED' : 'COPY'}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-2 font-mono text-xs leading-relaxed text-(--label-1) lg:px-5 lg:py-2.5 lg:text-sm ">
        <code className={`language-${lang}`}>
          {lines.map((toks, n) => (
            <div key={n} className="gap-4 grid grid-cols-[auto_1fr]" style={{ color: '#9CDCFE' }}>
              <span aria-hidden="true" className="select-none text-right tabular-nums text-(--label-4)">{n + 1}</span>
              <span>{toks.map((t, k) => <span key={k} className={t[1]} style={parseStyle(t[2])}>{t[0]}</span>)}</span>
            </div>
          ))}
        </code>
      </pre>
    </div>
  )
}
