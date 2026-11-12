// Track B2 helpers (ported from original bundle modules 29090 / 4d3f3b68 sR,sS,sT,sD).
import { useEffect, useState } from 'react'

// customCubic = cubic-bezier(0.66, 0, 0.01, 1) — verbatim port of module 29090.
export const customCubic = (() => {
  const t = -3 * 0.65 - 1.98
  const n = -0.98 - (-3 * 0.65 - 1.98)
  const r = (e) => ((n * e + t) * e + 1.98) * e
  const i = (e) => (3 * n * e + 2 * t) * e + 1.98
  const solve = (e) => {
    let x = e
    for (let k = 0; k < 8; k++) {
      const d = r(x) - e
      const a = i(x)
      if (1e-7 > Math.abs(d)) return x
      if (1e-7 > Math.abs(a)) break
      x -= d / a
    }
    let lo = 0
    let hi = 1
    for (x = e; lo < hi;) {
      const v = r(x)
      if (1e-7 > Math.abs(v - e)) break
      e > v ? (lo = x) : (hi = x)
      x = (hi + lo) / 2
    }
    return x
  }
  return (e) => {
    if (e <= 0) return 0
    if (e >= 1) return 1
    const s = solve(e)
    return ((-2 * s + 3) * s + 0) * s
  }
})()

export const easeInOutCubic = (e) => (e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2)

// Opaque-mode hysteresis presets (orig `sR`).
export const EFFECT_POLICY = {
  solidEffect: { opaqueThreshold: 0.9, opaqueTolerance: 0, hysteresis: 0.9 - 0.82 },
  refractiveEffect: { opaqueThreshold: 0.99, opaqueTolerance: 0.005, hysteresis: 0.02 },
}
const sS = (e) => Math.min(1, Math.max(0, e))
export function normProgress(e) { return void 0 === e ? 0 : sS(e > 1 ? e / 100 : e) }
// orig `sD(prev, progress, policy)`
export function opaqueHysteresis(e, t, r) {
  const i = sS(r?.opaqueThreshold ?? 0.99)
  const o = sS(r?.opaqueTolerance ?? 0.005)
  const a = sS(r?.hysteresis ?? 0.02)
  const l = sS(i - o)
  const s = sS(l - a)
  const n = normProgress(t)
  return (!e && n >= l) || ((!e || !(n <= s)) && e)
}

export function usePrefersReducedMotion() {
  const [v, setV] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const f = () => setV(m.matches)
    f()
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return v
}

// ---- Cross-track state ----
export { sceneState } from './sceneState.js'
export { menuStore } from '../lib/menu.js'
