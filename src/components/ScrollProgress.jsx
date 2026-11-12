// Port of orig 72443: desktop scroll progress bar + mobile circular scroll-to-top.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { scrollEnv, subscribeScrollTopPx } from '../lib/scroll.js'

const CIRC = 2 * Math.PI * 12
const clamp = (v, a, b) => Math.min(b, Math.max(a, v))
const HIDE_MS = 2000

function useContainerEl() {
  const [el, set] = useState(() => scrollEnv.getContainerEl())
  useEffect(() => scrollEnv.subscribeContainerEl((e) => set(e)), [])
  return el
}

export default function ScrollProgress({ hidden = false }) {
  const h = useContainerEl()
  const [past, setPast] = useState(false)
  const [mounted, setMounted] = useState(false)
  const mountedRef = useRef(false)
  const thumbRef = useRef(null)
  const ringRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [transition, setTransition] = useState(false)
  const timer = useRef(null)
  const abort = useRef(null)
  const rafRef = useRef(null)
  const transRef = useRef(false)
  const dragging = useRef(false)
  const drag = useRef({ startY: 0, startScrollTop: 0 })

  useLayoutEffect(() => () => {
    abort.current?.abort(); abort.current = null
    if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
  }, [])

  const show = useCallback((ms = HIDE_MS) => {
    setVisible(true)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), ms)
  }, [])

  useEffect(() => {
    if (!h) return
    if (!mountedRef.current) { mountedRef.current = true; setMounted(true) }
    show(3000)
    if (!transRef.current) { transRef.current = true; rafRef.current = requestAnimationFrame(() => setTransition(true)) }
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [h, show])

  useEffect(() => {
    if (!h) return
    const update = () => {
      const t = scrollEnv.getScrollTopPx()
      const p36 = t >= 36
      setPast((v) => (v === p36 ? v : p36))
      const total = Math.max(1, h.scrollHeight)
      const client = Math.max(1, h.clientHeight)
      const o = clamp(t / Math.max(1, total - client), 0, 1)
      const l = Math.max(20, 188 * clamp(client / total, 0, 1))
      const c = 6 + o * (188 - l)
      thumbRef.current?.setAttribute('d', `M 16 ${c} V ${c + l}`)
      ringRef.current?.setAttribute('stroke-dashoffset', String(CIRC * (1 - o)))
    }
    update()
    const unsub = subscribeScrollTopPx(() => { update(); if (!dragging.current) show(HIDE_MS) })
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => update()) : null
    ro?.observe(h)
    const first = h.firstElementChild
    if (first instanceof HTMLElement) ro?.observe(first)
    const rafs = []
    let n = 3
    const step = () => { update(); if ((n -= 1) > 0) rafs.push(requestAnimationFrame(step)) }
    rafs.push(requestAnimationFrame(step))
    const onLoad = () => update()
    window.addEventListener('load', onLoad, { passive: true })
    return () => { unsub(); ro?.disconnect(); window.removeEventListener('load', onLoad); rafs.forEach(cancelAnimationFrame) }
  }, [h, show])

  const toTop = useCallback(() => scrollEnv.scrollToTop('smooth'), [])
  const dims = useCallback(() => {
    const el = scrollEnv.getContainerEl()
    const totalH = el ? el.scrollHeight : Math.max(document.documentElement.scrollHeight, document.body.scrollHeight, 1)
    const clientH = el ? el.clientHeight : Math.max(1, window.innerHeight || 1)
    return { el, totalH, clientH, validH: Math.max(1, totalH - clientH) }
  }, [])
  const onMove = useCallback((e) => {
    if (!dragging.current) return
    const dy = e.clientY - drag.current.startY
    const { totalH, clientH, validH } = dims()
    const track = 188 - Math.max(20, 188 * (totalH > 0 ? clamp(clientH / totalH, 0, 1) : 1))
    if (track <= 0) return
    scrollEnv.lenisScrollTo(drag.current.startScrollTop + (validH / track) * dy, { immediate: true })
  }, [dims])
  const onUp = useCallback(() => {
    dragging.current = false
    abort.current?.abort(); abort.current = null
    document.body.style.userSelect = ''
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => setVisible(false), HIDE_MS)
  }, [])

  if (!mounted) return null
  const ringStyle = { transition: 'stroke-opacity 0.66s cubic-bezier(0.66, 0, 0.01, 1), stroke-width 0.66s cubic-bezier(0.66, 0, 0.01, 1)' }
  return (
    <>
      <div
        className={`pointer-events-auto top-1/2 right-0 bottom-0 z-30 fixed w-14 px-3 h-50 -translate-y-1/2 hidden lg:block ${transition ? 'transition-opacity duration-500' : ''} ${visible ? 'opacity-100' : 'opacity-0'}${hidden ? ' hidden!' : ''}`}
        aria-hidden={hidden}
        onMouseEnter={() => { setVisible(true); if (timer.current) clearTimeout(timer.current) }}
        onMouseLeave={() => { if (timer.current) clearTimeout(timer.current); timer.current = setTimeout(() => setVisible(false), HIDE_MS) }}
      >
        <svg
          width="32" height="200" viewBox="0 0 32 200" fill="none" xmlns="http://www.w3.org/2000/svg"
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect()
            const p = (clamp((e.clientY - r.top) * (200 / r.height), 6, 194) - 6) / 188
            scrollEnv.lenisScrollTo(p * dims().validH, { immediate: false })
          }}
        >
          <path d="M 16 6 V 194" stroke="currentColor" strokeOpacity={0.2} strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
          <path
            ref={thumbRef} d="M 16 6 V 6" stroke="currentColor" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round"
            onMouseDown={(e) => {
              e.preventDefault(); e.stopPropagation()
              dragging.current = true
              drag.current = { startY: e.clientY, startScrollTop: scrollEnv.getScrollTopPx() }
              if (timer.current) clearTimeout(timer.current)
              setVisible(true)
              document.body.style.userSelect = 'none'
              abort.current?.abort()
              abort.current = new AbortController()
              const signal = abort.current.signal
              document.addEventListener('mousemove', onMove, { signal })
              document.addEventListener('mouseup', onUp, { signal })
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </svg>
      </div>
      <div
        className={`pointer-events-auto lg:hidden right-0 bottom-0 z-30 fixed flex justify-center items-center px-6 py-6${hidden ? ' hidden' : ''}`}
        role="button" tabIndex={hidden ? -1 : 0} aria-label="Scroll to top" aria-hidden={hidden}
        onClick={toTop}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toTop() } }}
      >
        <svg width="24px" height="24px" viewBox="0 0 32 32" className={`${past ? 'scale-100' : 'scale-50'} transition-all duration-[0.66s] ease-66 pointer-events-none`}>
          <circle r="12" cy="16" cx="16" fill="none" strokeLinejoin="round" strokeLinecap="round" strokeWidth={past ? '4' : '8'} stroke="currentColor" strokeOpacity={past ? 0.2 : 1} transform="rotate(-90 16 16)" style={ringStyle} />
          <circle ref={ringRef} r="12" cy="16" cx="16" fill="none" strokeLinejoin="round" strokeLinecap="round" strokeWidth={past ? '4' : '8'} stroke="currentColor" strokeDashoffset={CIRC} strokeDasharray={CIRC} transform="rotate(-90 16 16)" style={ringStyle} />
        </svg>
      </div>
    </>
  )
}
