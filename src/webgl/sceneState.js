// Shared per-frame WebGL scene state (owned by Track B1, read-only for B2).
// Updated at the very start of every R3F frame (useFrame priority -1000) by Scene.jsx.
//
//   sP               scene progress 0..1 (orig module-level `sP`; bannerFactor * footerFactor)
//   solidMode        sD(sP, solidEffect)      on at >= .9, off at <= .82   (orig `sR.solidEffect`)
//   refractiveOpaque sD(sP, refractiveEffect) on at >= .985, off at <= .965 (orig `sR.refractiveEffect`)
//   bannerInView / footerInView  live section-in-viewport tests (orig `s0.isSectionInViewport`)
//   frame            R3F frame counter
export const sceneState = {
  sP: 0,
  solidMode: false,
  refractiveOpaque: false,
  bannerInView: true,
  footerInView: false,
  frame: 0,
}

// orig `sR`
export const EFFECT_THRESHOLDS = {
  solidEffect: { opaqueThreshold: 0.9, opaqueTolerance: 0, hysteresis: 0.9 - 0.82 },
  refractiveEffect: { opaqueThreshold: 0.99, opaqueTolerance: 0.005, hysteresis: 0.02 },
}

const clamp01 = (e) => Math.min(1, Math.max(0, e)) // orig sS
// orig sT
export function normProgress(e) {
  return e === undefined ? 0 : clamp01(e > 1 ? e / 100 : e)
}
// orig sD: hysteresis latch
export function hysteresisLatch(prev, value, cfg) {
  const i = clamp01(cfg?.opaqueThreshold ?? 0.99)
  const o = clamp01(cfg?.opaqueTolerance ?? 0.005)
  const a = clamp01(cfg?.hysteresis ?? 0.02)
  const l = clamp01(i - o)
  const s = clamp01(l - a)
  const n = normProgress(value)
  return (!prev && n >= l) || ((!prev || !(n <= s)) && prev)
}
// orig sF: frame cadence (used by the glass FBO and the bokeh pre-passes only —
// the final composer render runs every frame in the original).
export function frameCadence(sp, mobile) {
  if (mobile) return 3
  const r = normProgress(sp)
  return r > 0.75 ? 4 : r > 0.5 ? 2 : 1
}
