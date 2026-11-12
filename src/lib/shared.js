// SHARED CONTRACT between the HTML layer (track A) and WebGL (tracks B1/B2).
// Do not rename exports. Internals may be extended.
import { createStore } from './store.js'

// Scroll bus (orig module 90270). Written by the Lenis wrapper on every Lenis 'scroll' event.
// scrollTop is Lenis's ANIMATED scroll. limit = max scrollTop.
export const scrollStore = createStore({ scrollTop: 0, limit: 0, progress: 0, velocity: 0, direction: 0, viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 900 })

// The Lenis instance (set by track A). WebGL drives lenis.raf(t) from the R3F loop (autoRaf:false).
export const lenisRef = { current: null }

// Pointer (orig 16265). x,y in uv 0..1 with yUp (0 = bottom). inside=false when pointer left window.
// lastMoveAt = performance.now() of last move. clientX/clientY CSS px.
export const pointerStore = createStore({ x: 0.5, yUp: 0.5, clientX: null, clientY: null, inside: false, hasPointer: false, lastMoveAt: 0 })

// Theme (orig 90975). setting: 'light'|'dark'|'system'; resolved: 'light'|'dark'.
export const themeStore = createStore({ setting: 'system', resolved: 'light' })

// Sound (orig 23525).
export const soundStore = createStore({ on: true, playing: false })

// Hyper-space giant cursor damped reveal 0..1 (orig 1111). Written by WebGL (B1), read by HTML (A).
export const arrowStore = createStore({ dampedScaleT: 0 })
export const ARROW_THRESHOLD = 0.5

// Loading gate (spec §5.9). fontsReady set by A; assetsProgress 0..1 set by WebGL; revealed set by transition canvas (B2).
export const loadStore = createStore({
  fontsReady: false,            // A
  modelsLoaded: 0, modelsTotal: 3,   // B1 (hello, cursor, cnt; ready after 5 rendered frames)
  texLoaded: 0, texTotal: 0,         // B2 (image-layer textures)
  revealed: false,              // B2 TransitionCanvas: entry dot-iris finished opening
  allowScrambleLines: false,    // B2 sets true 100ms into the reveal phase; A's ScrambleText waits for it
})

// Section registry: HTML marks elements with data-section="banner" | "about" | "hyper-space" | "footer" | <work href>.
// WebGL measures them via getSection(name) -> { el, docTop, height } (document Y inside .lenis content).
export function getSectionEl(name) { return document.querySelector(`[data-section="${CSS.escape(name)}"]`) }
export function measureSection(name) {
  const el = getSectionEl(name); if (!el) return null
  const r = el.getBoundingClientRect(); const st = scrollStore.get().scrollTop
  return { el, docTop: r.top + st, height: r.height, left: r.left, width: r.width }
}

export const isMobile = () => window.innerWidth < 1024
