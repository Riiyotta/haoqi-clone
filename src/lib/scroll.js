// Lenis wrapper (orig 95212) + scroll bus (orig 90270) + scrollEnv helpers (orig 29680).
import Lenis from 'lenis'
import { addEffect } from '@react-three/fiber'
import { scrollStore, lenisRef } from './shared.js'

export const PENDING_SCROLL_ANCHOR_SESSION_KEY = 'hq:pendingScrollAnchor'

let containerEl = null
const containerSubs = new Set()

export const isEditableTarget = (t) => {
  if (!(t instanceof HTMLElement)) return false
  const n = t.tagName
  return n === 'INPUT' || n === 'TEXTAREA' || n === 'SELECT' || t.isContentEditable
}

export const scrollEnv = {
  setContainerEl(el) { containerEl = el; for (const f of containerSubs) f(el) },
  getContainerEl: () => containerEl,
  subscribeContainerEl(f) { containerSubs.add(f); return () => containerSubs.delete(f) },
  lenisScrollTo(target, opts) {
    const l = lenisRef.current
    if (l) return void l.scrollTo(target, { force: true, ...opts })
    if (typeof target !== 'number') return
    const behavior = opts?.immediate ? 'auto' : 'smooth'
    ;(containerEl ?? window).scrollTo({ top: target, left: 0, behavior })
  },
  getScrollTopPx() {
    if (lenisRef.current) return scrollStore.get().scrollTop
    return containerEl ? containerEl.scrollTop : window.scrollY ?? 0
  },
  getViewportHeightPx() {
    return containerEl ? Math.max(1, containerEl.clientHeight || 1) : Math.max(1, window.innerHeight || 1)
  },
  scrollToEdge(edge, behavior = 'smooth') {
    const el = containerEl
    const top = edge === 'top' ? 0 : el ? Math.max(0, el.scrollHeight - el.clientHeight) : Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
    const l = lenisRef.current
    if (l) l.scrollTo(top, { force: true, immediate: behavior === 'auto' })
    else (el ?? window).scrollTo({ top, left: 0, behavior })
  },
  scrollToTop(b = 'smooth') { scrollEnv.scrollToEdge('top', b) },
  scrollToBottom(b = 'smooth') { scrollEnv.scrollToEdge('bottom', b) },
}

// subscribeScrollTopPx (orig 35231): Lenis scroll bus + native container scroll.
export function subscribeScrollTopPx(fn) {
  const unsubBus = scrollStore.subscribe(fn)
  let off = null
  const bind = (el) => {
    off?.()
    const t = el ?? window
    t.addEventListener('scroll', fn, { passive: true })
    off = () => t.removeEventListener('scroll', fn)
  }
  bind(containerEl)
  const unsubC = scrollEnv.subscribeContainerEl((el) => { bind(el); fn() })
  return () => { unsubBus(); unsubC(); off?.(); off = null }
}

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d)

// Creates Lenis on the `.lenis` wrapper, binds the scroll bus and drives lenis.raf from R3F's addEffect
// (fallback: own rAF while R3F's global loop is not ticking, i.e. no Canvas mounted).
export function initLenis(wrapper, content) {
  scrollEnv.setContainerEl(wrapper)
  const lenis = new Lenis({ wrapper, content, lerp: 0.1, smoothWheel: true, syncTouch: true, anchors: true, autoRaf: false })
  lenisRef.current = lenis

  const publish = (e, viewportOnly = false) => {
    const v = scrollStore.get()
    const scrollTop = viewportOnly ? v.scrollTop : num(e?.scroll, lenis.scroll ?? v.scrollTop)
    const limit = Math.max(1, viewportOnly ? v.limit : num(e?.limit, lenis.limit ?? v.limit))
    const progress = Math.min(1, Math.max(0, viewportOnly ? v.progress : num(e?.progress, scrollTop / limit)))
    const velocity = viewportOnly ? v.velocity : num(e?.velocity, lenis.velocity ?? 0)
    const direction = viewportOnly ? v.direction : num(e?.direction, lenis.direction ?? 0)
    const viewportHeight = Math.max(1, window.innerHeight || 1)
    if (v.scrollTop !== scrollTop || v.limit !== limit || v.progress !== progress || v.velocity !== velocity || v.direction !== direction || v.viewportHeight !== viewportHeight) {
      scrollStore.set({ scrollTop, limit, progress, velocity, direction, viewportHeight })
    }
  }
  const onScroll = (e) => publish(e)
  lenis.on('scroll', onScroll)
  const onResize = () => publish(undefined, true)
  window.addEventListener('resize', onResize, { passive: true })
  window.visualViewport?.addEventListener('resize', onResize, { passive: true })
  publish()
  // limit changes when content resizes without a scroll event (images loading etc.)
  const ro = new ResizeObserver(() => { requestAnimationFrame(() => publish({ scroll: lenis.scroll, limit: lenis.limit })) })
  ro.observe(content)
  ro.observe(wrapper)

  // R3F's global loop only ticks while a <Canvas> is mounted; our own rAF drives Lenis whenever
  // R3F did not tick since our previous frame.
  let r3fTicked = false
  const offEffect = addEffect((t) => { r3fTicked = true; lenis.raf(t) })
  let rafId = 0
  const loop = (t) => {
    if (!r3fTicked) lenis.raf(t)
    r3fTicked = false
    rafId = requestAnimationFrame(loop)
  }
  rafId = requestAnimationFrame(loop)

  return () => {
    cancelAnimationFrame(rafId)
    offEffect()
    ro.disconnect()
    window.removeEventListener('resize', onResize)
    window.visualViewport?.removeEventListener('resize', onResize)
    lenis.off('scroll', onScroll)
    lenis.destroy()
    if (lenisRef.current === lenis) lenisRef.current = null
    scrollEnv.setContainerEl(null)
  }
}
