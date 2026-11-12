// Track B2 — post stack (orig `cG`, 4d3f3b68dbbde33a.js ~18850–19015).
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import * as THREE from 'three'
import { pointerStore, themeStore } from '../lib/shared.js'
import { useIsMobileWidth } from './hooks.js'
import { LensFlarePass, FluidPushPass, POINTER_COLOR } from './b2-passes.js'
import { LENS_FLARE_FRAG, LENS_FLARE_COMPOSITE_FRAG } from './b2-shaders.js'
import { EFFECT_POLICY, opaqueHysteresis, normProgress, sceneState, usePrefersReducedMotion } from './b2-shared.js'

// leva defaults (lensFlare folder)
const FLARE = { starRays: 6, intensity: 0.7, threshold: 0.99, streakScale: 8, hotspotPower: 32, gate: 0.88, tailColorLight: '#ffa300', tailColorDark: '#1600ff' }
const flareDownsample = 0.5

const subscribeTheme = (fn) => themeStore.subscribe(fn)
const getTheme = () => themeStore.get().resolved

export default function PostEffects() {
  const d = useThree((s) => s.size)
  const h = useThree((s) => s.gl)
  const g = useSyncExternalStore(subscribeTheme, getTheme)
  const v = useIsMobileWidth()
  const A = usePrefersReducedMotion()

  const M = FLARE.intensity
  const R = FLARE.threshold
  const S = FLARE.streakScale * (Math.max(1, d.width) / 1920) * (v ? 2 : 1)
  const T = FLARE.hotspotPower
  const D = FLARE.gate
  const F = g === 'dark' ? FLARE.tailColorDark : FLARE.tailColorLight
  const E = FLARE.starRays

  const P = useRef(1)
  const k = useRef(new THREE.Vector2(-1, -1))
  const O = useRef(new THREE.Vector2(0, 0))
  const G = useRef(new THREE.Vector2(-1, -1))
  const L = useRef(new THREE.Vector2(-1, -1))
  const uv = useRef(new THREE.Vector2(0.5, 0.5))
  const H = useRef(false)
  const _ = useRef(false)
  const j = useRef(0)
  const U = useRef(true)

  const N = useRef(null)
  if (!N.current) {
    const e = new LensFlarePass({
      flareDownsample, starRays: E, intensity: M, threshold: R, streakScale: S, hotspotPower: T, gate: D, tailColor: F,
      flareFragmentShader: LENS_FLARE_FRAG, compositeFragmentShader: LENS_FLARE_COMPOSITE_FRAG,
    })
    e.enabled = true
    N.current = e
  }
  const J = N.current
  const K = useRef(null)
  if (!K.current) {
    const e = new FluidPushPass({})
    e.enabled = true
    K.current = e
  }
  const $ = K.current

  // render gate (B1's throttling) + post-active flag
  const [composer, setComposer] = useState(null)
  const composerRef = useCallback((c) => setComposer(c ?? null), [])
  useEffect(() => {
    if (!composer) return
    const orig = composer.render
    composer.render = function (dt) {
      if (window.__hqShouldRender?.() === false) return
      return orig.call(this, dt)
    }
    return () => { composer.render = orig }
  }, [composer])
  useEffect(() => {
    window.__hqPostActive = true
    return () => { window.__hqPostActive = false }
  }, [])

  useEffect(() => {
    J.setParams({ starRays: E, intensity: M, threshold: R, streakScale: S, hotspotPower: T, gate: D, tailColor: F })
  }, [J, E, M, R, S, T, D, F])
  useEffect(() => { J.setFlareDownsample(flareDownsample) }, [J])
  useEffect(() => { $.setPointerColor(POINTER_COLOR); $.setPointerPixelSize(16) }, [$])
  useEffect(() => () => { J.dispose(); $.dispose() }, [$, J])
  useEffect(() => {
    const t = Math.min(h.getPixelRatio(), 2)
    P.current = t
    if (composer) {
      const r = Math.max(1, Math.floor(d.width * t))
      const n = Math.max(1, Math.floor(d.height * t))
      composer.inputBuffer.setSize(r, n)
      composer.outputBuffer.setSize(r, n)
      for (const p of composer.passes) p.setSize(r, n)
    }
    $.setDisplayMetrics(d.width, d.height, t)
  }, [$, h, d.width, d.height, composer])

  useFrame((_s, t) => {
    const scene = sceneState
    const r = normProgress(scene.sP)
    H.current = opaqueHysteresis(H.current, r, EFFECT_POLICY.solidEffect)
    _.current = H.current
    const n = scene.bannerInView || scene.footerInView
    const i = !H.current && n
    !U.current && i && J.resetFlareCadence()
    U.current = i
    J.enabled = i
    const ps = pointerStore.get()
    uv.current.set(ps.x, ps.yUp)
    const p = uv.current
    const o = !!ps.inside && !v && !A
    const a = P.current
    if (o) {
      const ex = p.x * d.width * a
      const ey = p.y * d.height * a
      G.current.x >= 0 && G.current.y >= 0 ? O.current.set(ex - G.current.x, ey - G.current.y) : O.current.set(0, 0)
      k.current.set(ex, ey)
      G.current.set(ex, ey)
    } else O.current.multiplyScalar(0.9)
    const l = o ? O.current.lengthSq() : 0
    const s = performance.now()
    l > 1 && (j.current = s)
    const u = s - j.current > 600
    const hh = !v && !A && !H.current && !u
    const gg = _.current
    if (!i || hh || gg) {
      J.renderToScreen = false
      $.enabled = true
      $.renderToScreen = true
    } else {
      J.renderToScreen = true
      $.enabled = false
    }
    $.setEffectEnabled(hh)
    $.setPointerOverlayEnabled(gg)
    $.setPointer(k.current)
    $.setPointerDelta(O.current)
    o ? L.current.copy(p) : L.current.set(-1, -1)
    $.updatePointer(L.current, o && gg, t)
  }, 0)

  return (
    <EffectComposer ref={composerRef} multisampling={0} autoClear renderPriority={998} frameBufferType={THREE.UnsignedByteType}>
      <primitive object={J} />
      <primitive object={$} />
    </EffectComposer>
  )
}
