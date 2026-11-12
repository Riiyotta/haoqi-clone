// Hyper-space text section (orig fh / fp / fm / fg / fv, HyperSpaceStaggerText `fr`, ring SVG `c7`).
import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useWindowSize } from '../hooks/useWindowSize.js'
import { scrollEnv } from '../lib/scroll.js'
import { useHasEnteredViewport, useLenisScrollTop, useArrowFullscreenPastThreshold, ARROW_FULLSCREEN_DOM_COLOR_TRANSITION } from '../lib/hooks.js'

// ---------- ring (c7)
const RING = { enterSpan: 300, exitSpan: 345, cycleDist: 300, totalDist: 945 }
const HALF = (() => {
  const a = new Float32Array(301)
  for (let t = 0; t <= 300; t++) { const d = t - 150; const r = 22500 - d * d; a[t] = r > 0 ? Math.sqrt(r) : 0 }
  return a
})()
const SEEN = new Float32Array(7)
const IDX = [0, 1, 2, 3, 4, 5, 6]

function layoutRing(els, p) {
  const r = (p < 0 ? 0 : p > 1 ? 1 : p) * RING.totalDist
  let phase = 0
  let i = r
  if (r > RING.enterSpan) {
    if (r <= RING.enterSpan + RING.cycleDist) { phase = 1; i = r - RING.enterSpan } else { phase = 2; i = r - RING.enterSpan - RING.cycleDist }
  }
  const o = phase === 0 ? (i / 50) | 0 : 0
  let count = 0
  for (let k = 0; k < 7; k++) {
    const el = els[k]
    if (!el) continue
    let l = 0
    let vis = false
    if (phase === 0) { if (i >= 50 * k) { l = i - ((o < 6 ? o : 6) - k) * 50; vis = l > 0 && l < 300 } }
    else if (phase === 1) { l = (((i + 50 * k) % 300) + 300) % 300; vis = l > 0 && l < 300 }
    else { l = i + 50 * k; vis = l > 0 && l < 300 }
    if (!vis) { el.style.visibility = 'hidden'; continue }
    let rx = 0
    if (!(l <= 0 || l >= 300)) { const t = l | 0; const f = l - t; rx = f <= 0 ? HALF[t] : HALF[t] + (HALF[t + 1] - HALF[t]) * f }
    if (rx <= 0) { el.style.visibility = 'hidden'; continue }
    let next = count + 1
    for (let q = 0; q < count; q++) if (Math.abs(SEEN[q] - l) < 0.5) { next = count; break }
    if (next === count) { el.style.visibility = 'hidden'; continue }
    SEEN[count] = l
    count = next
    el.style.visibility = 'visible'
    el.cx.baseVal.value = 172
    el.cy.baseVal.value = 22 + l
    el.rx.baseVal.value = rx
    el.ry.baseVal.value = 0.1 * rx
  }
}

const Ring = memo(function Ring({ progress01, size = 344, className = '' }) {
  const id = useId().replace(/:/g, '')
  const els = useRef([])
  useLayoutEffect(() => { layoutRing(els.current, progress01) }, [progress01])
  return (
    <div
      className={`pointer-events-none absolute top-1/2 left-1/2 z-0 size-(--sar-size) -translate-x-1/2 -translate-y-1/2 overflow-hidden contain-[layout_paint_style] ${className}`}
      style={{ '--sar-size': `${size}px` }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox="0 0 344 344" fill="none" xmlns="http://www.w3.org/2000/svg" className="size-full" shapeRendering="geometricPrecision">
        <defs><clipPath id={id}><polygon points="20,22 324,22 324,322 20,322" /></clipPath></defs>
        <g clipPath={`url(#${id})`}>
          {IDX.map((k) => (
            <ellipse key={k} ref={(e) => { els.current[k] = e }} visibility="hidden" stroke="#C0FE04" strokeOpacity={1} strokeWidth={2} vectorEffect="non-scaling-stroke" />
          ))}
        </g>
      </svg>
    </div>
  )
})

// ---------- HyperSpaceStaggerText (fr)
const delayCache = new Map()
function staggerDelays(text, n, spread, salt) {
  const key = `${text}\u0000${n}\u0000${spread}\u0000${salt ?? ''}`
  const hit = delayCache.get(key)
  if (hit) return hit
  let h = 0x811c9dc5
  const src = salt ? text + '\0' + salt : text
  for (let i = 0; i < src.length; i++) h = Math.imul(h ^ src.charCodeAt(i), 0x1000193)
  let s = h >>> 0
  const rand = () => {
    let e = (s += 0x6d2b79f5)
    e = Math.imul(e ^ (e >>> 15), 1 | e)
    return (((e ^= e + Math.imul(e ^ (e >>> 7), 61 | e)) ^ (e >>> 14)) >>> 0) / 0x100000000
  }
  const out = n <= 0 ? [] : n === 1 ? [0] : Array.from({ length: n }, (_, i) => Math.min(spread, (i / (n - 1)) * spread * 0.7 + rand() * spread * 0.35))
  delayCache.set(key, out)
  return out
}

const StaggerText = memo(function HyperSpaceStaggerText({ text, className, durationSec = 0.23, staggerSpreadMs = 290, groupDelayMs = 0, play = true }) {
  const chars = useMemo(() => Array.from(text), [text])
  const [inD, outD] = useMemo(() => [staggerDelays(text, chars.length, staggerSpreadMs), staggerDelays(text, chars.length, staggerSpreadMs, 'out')], [chars.length, staggerSpreadMs, text])
  const played = useRef(false)
  useEffect(() => { if (play) played.current = true }, [play])
  if (!(play || played.current)) return <span className={className} style={{ opacity: 0 }}>{text}</span>
  return (
    <span className={className}>
      {chars.map((c, i) => (
        <span
          key={`${i}-${c}`}
          className="hsst-char"
          style={{
            opacity: +!play,
            animationName: play ? 'hsstFadeIn' : 'hsstFadeOut',
            animationDuration: `${durationSec}s`,
            animationDelay: `${((play ? inD : outD)[i] + groupDelayMs) / 1000}s`,
            animationTimingFunction: 'linear',
            animationFillMode: 'forwards',
          }}
        >
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  )
})

// ---------- section
const STAGES = [
  { range: [0, 1], stage: 'seg0-primary' },
  { range: [2, 3], stage: 'seg0-secondary' },
  { range: [4, 5], stage: 'seg1' },
  { range: [6, 7], stage: 'end' },
]
const PRIMARY = ['Innovate', 'with', 'purpose']
const SECONDARY = ['Innovate', 'with a', 'human touch']
const END = ['FUTURE-FIRST', 'ALWAYS']
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const stageOf = (i) => { for (const s of STAGES) if (i >= s.range[0] && i <= s.range[1]) return s.stage; return null }
const segH = (sec, vh) => { const r = sec ? sec.height / 8 : 0; return r > 1 ? r : Math.max(1, vh || scrollEnv.getViewportHeightPx()) }

// Measures the section's document Y inside the .lenis content (orig section registry).
function useSectionRect(ref) {
  const [rect, setRect] = useState(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let raf = 0
    const measure = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const c = scrollEnv.getContainerEl()
      const y = c ? r.top - c.getBoundingClientRect().top + scrollEnv.getScrollTopPx() : r.top + window.scrollY
      setRect((p) => (p && p.y === y && p.height === r.height ? p : { y, height: r.height }))
    }
    const schedule = () => { if (!raf) raf = requestAnimationFrame(measure) }
    schedule()
    window.addEventListener('resize', schedule)
    window.addEventListener('orientationchange', schedule)
    document.fonts?.ready.then(schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(el)
    let observedContent = null
    const bindContainer = (c) => {
      if (observedContent) ro.unobserve(observedContent)
      observedContent = c?.firstElementChild ?? null
      if (observedContent) ro.observe(observedContent)
      schedule()
    }
    bindContainer(scrollEnv.getContainerEl())
    const unsub = scrollEnv.subscribeContainerEl(bindContainer)
    return () => { cancelAnimationFrame(raf); ro.disconnect(); unsub(); window.removeEventListener('resize', schedule); window.removeEventListener('orientationchange', schedule) }
  }, [ref])
  return rect
}

function useHyperSpaceSegment(sec, vh) {
  const scrollTop = useLenisScrollTop()
  const [, setOri] = useState(0)
  const [segmentIndex, setSegmentIndex] = useState(0)
  const [stage, setStage] = useState(() => stageOf(0))
  const [reveal, setReveal] = useState(false)
  const [gen, setGen] = useState(0)
  const segRef = useRef(0)
  const stageRef = useRef(stageOf(0))
  const revealRef = useRef(false)
  const lastU = useRef(null)
  useEffect(() => {
    const f = () => setOri((n) => n + 1)
    window.addEventListener('orientationchange', f, { passive: true })
    return () => window.removeEventListener('orientationchange', f)
  }, [])
  useEffect(() => {
    if (!sec) return
    const n = segH(sec, vh)
    const d = scrollTop - sec.y
    const a = clamp(Math.floor(Math.max(0, d) / n), 0, 7)
    const s = stageOf(a)
    if (a !== segRef.current) { segRef.current = a; setSegmentIndex(a) }
    if (s !== stageRef.current) { stageRef.current = s; setStage(s) }
    if (s !== 'seg0-primary' && s !== 'seg0-secondary') {
      lastU.current = null
      if (revealRef.current) { revealRef.current = false; setReveal(false) }
      return
    }
    const u = d >= -(0.2 * n)
    const prev = lastU.current
    if (prev === null) {
      lastU.current = u
      if (u) { revealRef.current = true; setReveal(true); setGen((g) => g + 1) }
      return
    }
    if (u !== prev) {
      lastU.current = u
      if (u) { revealRef.current = true; setReveal(true); setGen((g) => g + 1) } else { revealRef.current = false; setReveal(false) }
    }
  }, [sec?.y, sec?.height, vh, scrollTop, sec])
  const progress = useMemo(() => {
    if (!sec || !stage) return 0
    const st = STAGES.find((x) => x.stage === stage)
    if (!st) return 0
    const n = segH(sec, vh)
    const d = scrollTop - sec.y
    const [lo, hi] = st.range
    const u = lo * n
    return clamp((d - u) / Math.max(1, (hi + 1) * n - u), 0, 1)
  }, [sec, vh, stage, scrollTop])
  return { segmentIndex, stage, segment0Reveal: reveal, segment0StaggerGen: gen, stageScrollProgress01: progress }
}

const BIG = 'flex flex-col justify-center items-center col-span-12 row-span-6 font-bold text-[7.2svw] lg:text-[6.8svw] uppercase leading-none'
const WDTH = { fontVariationSettings: '"wdth" 120' }

function Seg0({ stage, reveal, staggerGen, primaryLines, secondaryLines }) {
  const primary = stage === 'seg0-primary'
  const a = primary ? 'primary' : 'secondary'
  return (
    <div className={BIG} style={WDTH}>
      {(primary ? primaryLines : secondaryLines).map((text, n) => (
        <StaggerText key={n === 0 ? `${staggerGen}-${a}-stable-${n}` : `${staggerGen}-${a}-${n}`} text={text} play={reveal} groupDelayMs={100 * n} />
      ))}
    </div>
  )
}

const SENT = 'p-2 font-medium text-[5.6svw] lg:text-3xl leading-tight'
function Seg1({ ringProgress01 }) {
  return (
    <>
      <Ring progress01={ringProgress01} />
      <div className={`col-span-8 lg:col-span-4 col-start-1 lg:col-start-7 row-start-2 ${SENT}`}>
        <StaggerText text="Building tomorrow's" /><br /><StaggerText text="digital products." />
      </div>
      <div className={`col-span-8 lg:col-span-4 col-start-5 lg:col-start-9 row-start-3 ${SENT}`}>
        <StaggerText text="Independent by" /><br /><StaggerText text="design & engineering." />
      </div>
      <div className={`col-span-8 lg:col-span-4 col-start-1 lg:col-start-2 row-start-4 ${SENT}`}>
        <StaggerText text="Clarity first." /><br /><StaggerText text="Delight second." />
      </div>
      <div className={`col-span-8 lg:col-span-4 col-start-5 lg:col-start-4 row-start-5 ${SENT}`}>
        <StaggerText text="Ship in small loops." /><br /><StaggerText text="Aim for long arcs." />
      </div>
    </>
  )
}

function End() {
  const { ref, hasEnteredViewport } = useHasEnteredViewport({ threshold: 0.35, once: false })
  return (
    <div ref={ref} className={BIG} style={WDTH}>
      {END.map((t, r) => <StaggerText key={r} text={t} play={hasEnteredViewport} groupDelayMs={100 * r} />)}
    </div>
  )
}

function Stage({ stage, segment0Reveal, segment0StaggerGen, primaryLines, secondaryLines, stageScrollProgress01 }) {
  switch (stage) {
    case 'seg0-primary':
    case 'seg0-secondary':
      return <Seg0 stage={stage} reveal={segment0Reveal} staggerGen={segment0StaggerGen} primaryLines={primaryLines} secondaryLines={secondaryLines} />
    case 'seg1':
      return <Seg1 ringProgress01={stageScrollProgress01} />
    case 'end':
      return <End />
    default:
      return null
  }
}

export default function Innovate({ primaryLines = PRIMARY, secondaryLines = SECONDARY }) {
  const ref = useRef(null)
  const { height: vh } = useWindowSize()
  const sec = useSectionRect(ref)
  const st = useHyperSpaceSegment(sec, vh)
  const past = useArrowFullscreenPastThreshold()
  return (
    <div ref={ref} data-section="hyper-space" className={`relative ${ARROW_FULLSCREEN_DOM_COLOR_TRANSITION} ${past ? 'text-white' : 'text-l1'}`} style={{ height: `${8 * vh}px` }}>
      <div className="top-0 sticky grid grid-cols-12 grid-rows-6 px-4 lg:px-14 py-18 lg:py-24 w-full" style={{ minHeight: `${vh}px` }}>
        <Stage
          stage={st.stage} segment0Reveal={st.segment0Reveal} segment0StaggerGen={st.segment0StaggerGen}
          primaryLines={primaryLines} secondaryLines={secondaryLines} stageScrollProgress01={st.stageScrollProgress01}
        />
      </div>
    </div>
  )
}
