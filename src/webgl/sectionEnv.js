// Scroll env + section registry + pointer for the WebGL scene (Track B1).
// Ports orig s0 (4d3f3b68 ~13046), the home-page section snapshot (fB, ~20041) and PointerProvider (16265).
import * as THREE from 'three'
import { scrollStore, lenisRef } from '../lib/shared.js'

// ---------------------------------------------------------------- scroll env
export function getContainerEl() {
  return document.querySelector('.lenis')
}
// Lenis animated scroll (scrollStore.scrollTop). Falls back to the DOM scrollTop when Lenis isn't wired.
export function getScrollTopPx() {
  if (lenisRef.current) return scrollStore.get().scrollTop
  const c = getContainerEl()
  return c ? c.scrollTop : 0
}
export const getScrollLeftPx = () => 0
export const getViewportHeightPx = () => Math.max(1, window.innerHeight || 1)

// ---------------------------------------------------------------- section elements
const FALLBACKS = {
  banner: () => document.querySelector('.lenis > div > :nth-child(1)'),
  about: () => document.querySelector('.lenis > div > :nth-child(2)'),
  'hyper-space': () =>
    Array.from(document.querySelectorAll('.lenis > div > div')).find((d) => /height:\s*\d/.test(d.getAttribute('style') || '') && d.style.height && parseFloat(d.style.height) > window.innerHeight * 2) || null,
  footer: () => document.querySelector('footer#contact'),
}
export function resolveSectionEl(name) {
  const el = document.querySelector(`[data-section="${CSS.escape(name)}"]`)
  if (el) return el
  return FALLBACKS[name] ? FALLBACKS[name]() : null
}

const NAMES = ['banner', 'hyper-space', 'footer']
// [{ name, ref: {current: el}, x, y, width, height }] — orig `sectionPosition` snapshot (document Y in .lenis)
export const sectionPosition = []
const refs = Object.fromEntries(NAMES.map((n) => [n, { current: null }]))
const listeners = new Set()
export const subscribeSections = (fn) => (listeners.add(fn), () => listeners.delete(fn))

function measureEl(el) {
  const r = el.getBoundingClientRect()
  const c = getContainerEl()
  const ct = c ? c.getBoundingClientRect().top : 0
  return { x: r.left, y: r.top - ct + getScrollTopPx(), width: r.width, height: r.height }
}
let ro = null
let observed = new Set()
function measureAll() {
  sectionPosition.length = 0
  for (const name of NAMES) {
    const el = resolveSectionEl(name)
    refs[name].current = el
    if (!el) continue
    sectionPosition.push({ name, ref: refs[name], ...measureEl(el) })
  }
  // observe sections + container for size changes
  if (typeof ResizeObserver !== 'undefined') {
    if (!ro) ro = new ResizeObserver(() => scheduleMeasure())
    const want = new Set([getContainerEl(), ...NAMES.map((n) => refs[n].current)].filter(Boolean))
    for (const el of observed) if (!want.has(el)) ro.unobserve(el)
    for (const el of want) if (!observed.has(el)) ro.observe(el)
    observed = want
  }
  layoutCache.clear()
  listeners.forEach((f) => f())
}
let raf = 0
export function scheduleMeasure() {
  if (raf) return
  raf = requestAnimationFrame(() => { raf = 0; measureAll() })
}
let started = 0
export function startSectionTracking() {
  if (started++ === 0) {
    measureAll()
    window.addEventListener('resize', scheduleMeasure)
    window.addEventListener('orientationchange', scheduleMeasure)
    window.visualViewport?.addEventListener('resize', scheduleMeasure)
    document.fonts?.ready?.then(() => scheduleMeasure())
    document.fonts?.addEventListener?.('loadingdone', scheduleMeasure)
  }
  return () => {
    if (--started === 0) {
      window.removeEventListener('resize', scheduleMeasure)
      window.removeEventListener('orientationchange', scheduleMeasure)
      window.visualViewport?.removeEventListener('resize', scheduleMeasure)
      document.fonts?.removeEventListener?.('loadingdone', scheduleMeasure)
      ro?.disconnect(); ro = null; observed = new Set()
    }
  }
}
// Called once per frame: re-resolve if Track A swapped the DOM (HMR / data-section added later).
let checkCounter = 0
export function verifySectionEls() {
  if (checkCounter++ % 30 !== 0) return
  for (const name of NAMES) {
    const cur = refs[name].current
    const el = resolveSectionEl(name)
    if (el !== cur || (cur && !cur.isConnected)) { scheduleMeasure(); return }
  }
}

// ---------------------------------------------------------------- orig s0 helpers
let frameId = -1
const layoutCache = new Map()
export function beginSectionLayoutFrame(f) {
  if (f !== frameId) { layoutCache.clear(); frameId = f }
}
// orig sX: live content layout (cached per frame)
export function readSectionContentLayout(sec) {
  const name = sec.name
  if (name && frameId >= 0) { const c = layoutCache.get(name); if (c) return c }
  const el = sec.ref?.current
  let out
  if (!el) out = { topDocY: sec.y, height: sec.height }
  else {
    const n = el.getBoundingClientRect()
    const c = getContainerEl()
    out = c
      ? { topDocY: n.top - c.getBoundingClientRect().top + getScrollTopPx(), height: n.height }
      : { topDocY: n.top + getScrollTopPx(), height: n.height }
  }
  if (name && frameId >= 0) layoutCache.set(name, out)
  return out
}
export const findSection = (list, name) => (list ? list.find((e) => e.name === name) ?? null : null)
export function isSectionInViewport(sec, scrollTop, vh) {
  const { topDocY, height } = readSectionContentLayout(sec)
  const o = topDocY - scrollTop
  return o + height > 0 && o < vh
}
export function anySectionInViewport(list, names) {
  if (!list || !names || names.length === 0) return true
  const vh = getViewportHeightPx()
  const st = getScrollTopPx()
  for (const n of names) {
    const s = findSection(list, n)
    if (s && isSectionInViewport(s, st, vh)) return true
  }
  return false
}
export function getSectionContentCenterDocY(sec) {
  const { topDocY, height } = readSectionContentLayout(sec)
  return topDocY + 0.5 * height
}
export function scrollSyncedWorldYFromAnchorDocY({ anchorDocY, scrollTopPx, viewportHeightPx, viewportWorldHeight, anchorOffsetPx = 0, scrollSyncFactor = 1 }) {
  const l = Math.max(1, viewportHeightPx || 1)
  return (0.5 - (anchorDocY + anchorOffsetPx) / l) * viewportWorldHeight + (scrollTopPx / l) * viewportWorldHeight * scrollSyncFactor
}

// ---------------------------------------------------------------- pointer (orig PointerProvider 16265)
// uv: x 0..1, y 0..1 yUp; resets to (.5,.5) + inside=false on blur / mouseleave / visibilitychange.
export const pointer = { uv: new THREE.Vector2(0.5, 0.5), insideRef: { current: false } }
let pointerStarted = 0
let pointerCleanup = null
export function startPointer() {
  if (pointerStarted++ === 0) {
    let last = { x: 0.5, y: 0.5, inside: false }
    const set = (e) => {
      if (last.x !== e.x || last.y !== e.y || last.inside !== e.inside) {
        last = e
        pointer.insideRef.current = e.inside
        pointer.uv.set(e.x, e.y)
      }
    }
    const mv = (t) => {
      const i = Math.max(1, window.innerWidth)
      const r = Math.max(1, window.innerHeight)
      set({ x: t.clientX / i, y: 1 - t.clientY / r, inside: true })
    }
    const leave = () => set({ x: 0.5, y: 0.5, inside: false })
    const o = { capture: true, passive: true }
    window.addEventListener('pointermove', mv, o)
    window.addEventListener('pointerdown', mv, o)
    window.addEventListener('pointerover', mv, o)
    window.addEventListener('blur', leave, o)
    document.addEventListener('mouseleave', leave, o)
    document.addEventListener('visibilitychange', leave, o)
    pointerCleanup = () => {
      window.removeEventListener('pointermove', mv, true)
      window.removeEventListener('pointerdown', mv, true)
      window.removeEventListener('pointerover', mv, true)
      window.removeEventListener('blur', leave, true)
      document.removeEventListener('mouseleave', leave, true)
      document.removeEventListener('visibilitychange', leave, true)
    }
  }
  return () => { if (--pointerStarted === 0) { pointerCleanup?.(); pointerCleanup = null } }
}
