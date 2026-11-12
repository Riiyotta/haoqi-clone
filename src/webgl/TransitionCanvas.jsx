// Track B2 — entry / route / menu dot-iris transition (orig module 34841, 3c6cc5b2fcccdee5.js:327–790).
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, useSyncExternalStore } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { Effect, BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { loadStore, themeStore } from '../lib/shared.js'
import { MASK_VERT, MASK_FRAG, MASKED_DOTS_FRAG } from './b2-shaders.js'
import { customCubic, menuStore } from './b2-shared.js'
import { routerStore, routerPush } from '../lib/router.js'
import { navStore, clearNavigation } from '../lib/navigation.js'

const MASK_COLORS = ['#191b1b', '#efede7'] // [dark, light]
const subscribeTheme = (fn) => themeStore.subscribe(fn)
const getTheme = () => themeStore.get().resolved

// ---- Canvas shell (orig `s`) ----
function TransitionShell({ children }) {
  const maskMaterialRef = useRef(null)
  return (
    <Canvas
      dpr={[1, 2]}
      frameloop="demand"
      gl={{ alpha: true, antialias: false, premultipliedAlpha: true, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      className="z-30 fixed inset-0 pointer-events-none"
      // Original renders this as a direct <body> child where R3F's inline `position:relative;height:100%`
      // still covers the viewport; here the mount point is arbitrary, so pin it explicitly.
      style={{ position: 'fixed', inset: 0 }}
    >
      {children({ maskMaterialRef })}
    </Canvas>
  )
}

// ---- radial mask plane (orig `p`) ----
function MaskPlane({ open: e, duration: n, initialProgress: o, resetKey: l, onComplete: i, materialRef: s }) {
  const theme = useSyncExternalStore(subscribeTheme, getTheme)
  const m = useThree((st) => st.size)
  const v = useThree((st) => st.invalidate)
  const g = useRef(null)
  const w = s ?? g
  const [y, x] = MASK_COLORS
  const C = theme === 'dark' ? y : x
  const E = useMemo(() => ({
    uColor: { value: new THREE.Color() },
    uFeather: { value: 0.8 },
    uAspect: { value: 1 },
    uHoleRadius: { value: 2 },
    uProgress: { value: 0 },
  }), [])
  const b = useMemo(() => {
    const a = m.width / Math.max(1, m.height)
    const t = Math.max(a, 1 / a)
    return Math.sqrt(t * t + 1)
  }, [m.width, m.height])
  useEffect(() => { v() }, [C, v])
  useEffect(() => {
    if (w.current) w.current.uniforms.uAspect.value = m.width / Math.max(1, m.height)
  }, [m.width, m.height, w])
  const R = useRef(0)
  const M = useRef(null)
  const T = useRef(0)
  const S = useRef(0)
  const L = useRef(false)
  const P = useRef(false)
  const onCompleteRef = useRef(i)
  onCompleteRef.current = i
  useLayoutEffect(() => {
    if (P.current || ((P.current = true), typeof o !== 'number')) return
    const p0 = THREE.MathUtils.clamp(o, 0, 1)
    R.current = p0
    T.current = p0
    const hr = THREE.MathUtils.lerp(b, 0, p0)
    if (w.current) {
      w.current.uniforms.uHoleRadius.value = hr
      w.current.uniforms.uProgress.value = p0
    }
  }, [o, b, w])
  useLayoutEffect(() => {
    T.current = R.current
    S.current = +!!e
    M.current = null
    L.current = false
    v()
  }, [e, l, v])
  useFrame((st) => {
    const r = st.clock.getElapsedTime()
    M.current === null && (M.current = r)
    const el = r - M.current
    const k = THREE.MathUtils.clamp(el / Math.max(1e-6, n), 0, 1)
    const sv = customCubic(k)
    R.current = THREE.MathUtils.lerp(T.current, S.current, sv)
    const a = THREE.MathUtils.lerp(b, 0, R.current)
    if (w.current) {
      w.current.uniforms.uHoleRadius.value = a
      w.current.uniforms.uProgress.value = R.current
      w.current.uniforms.uColor.value.set(C)
    }
    if (!L.current && k >= 1 - 1e-6) { L.current = true; onCompleteRef.current?.(e) }
    if (!L.current && k < 1 - 1e-6) st.invalidate()
  })
  return (
    <mesh renderOrder={2000} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
      <shaderMaterial
        ref={w}
        transparent
        premultipliedAlpha
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
        uniforms={E}
        vertexShader={MASK_VERT}
        fragmentShader={MASK_FRAG}
      />
    </mesh>
  )
}

// ---- MaskedDotsEffect (orig class `g`) ----
class MaskedDotsEffect extends Effect {
  _dirty = true
  constructor({ pixelSize: e = 32, feather: t = 0.5, aspect: r = 1, holeRadius: n = 2, progress: o = 0, overlayColor: l = new THREE.Color(1, 1, 1) } = {}) {
    const i = new Map([
      ['pixelSize', new THREE.Uniform(e)],
      ['uFeather', new THREE.Uniform(t)],
      ['uAspect', new THREE.Uniform(r)],
      ['uHoleRadius', new THREE.Uniform(n)],
      ['uProgress', new THREE.Uniform(o)],
      ['uOverlayColor', new THREE.Uniform(l.clone())],
    ])
    super('MaskedDotsEffect', MASKED_DOTS_FRAG, { uniforms: i, blendFunction: BlendFunction.SRC })
    this.pixelSize = e
    this.feather = t
    this.aspect = r
    this.holeRadius = n
    this.progress = o
    this.overlayColor = l.clone()
    this._uPixelSize = i.get('pixelSize')
    this._uFeather = i.get('uFeather')
    this._uAspect = i.get('uAspect')
    this._uHoleRadius = i.get('uHoleRadius')
    this._uProgress = i.get('uProgress')
    this._uOverlayColor = i.get('uOverlayColor')
  }
  setParams(e) {
    let t = false
    if (typeof e.pixelSize === 'number' && e.pixelSize !== this.pixelSize) { this.pixelSize = e.pixelSize; t = true }
    if (typeof e.feather === 'number' && e.feather !== this.feather) { this.feather = e.feather; t = true }
    if (typeof e.aspect === 'number' && e.aspect !== this.aspect) { this.aspect = e.aspect; t = true }
    if (typeof e.holeRadius === 'number' && e.holeRadius !== this.holeRadius) { this.holeRadius = e.holeRadius; t = true }
    if (typeof e.progress === 'number' && e.progress !== this.progress) { this.progress = e.progress; t = true }
    if (e.overlayColor && !this.overlayColor.equals(e.overlayColor)) { this.overlayColor.copy(e.overlayColor); t = true }
    t && (this._dirty = true)
  }
  update() {
    if (!this._dirty) return
    this._dirty = false
    this._uPixelSize.value = this.pixelSize
    this._uFeather.value = this.feather
    this._uAspect.value = this.aspect
    this._uHoleRadius.value = this.holeRadius
    this._uProgress.value = this.progress
    this._uOverlayColor.value.copy(this.overlayColor)
  }
}

// ---- dots composer (orig `w`) ----
function DotsComposer({ maskMaterialRef: e, pixelSize: n }) {
  const o = useMemo(() => new MaskedDotsEffect(), [])
  const l = useThree((st) => st.viewport.dpr)
  useEffect(() => () => o.dispose(), [o])
  useFrame(() => {
    const t = e.current
    t && o.setParams({
      pixelSize: n * l,
      feather: t.uniforms.uFeather.value,
      aspect: t.uniforms.uAspect.value,
      holeRadius: t.uniforms.uHoleRadius.value,
      progress: t.uniforms.uProgress.value,
      overlayColor: t.uniforms.uColor.value,
    })
  }, 1)
  return (
    <EffectComposer multisampling={0} autoClear renderPriority={999} frameBufferType={THREE.UnsignedByteType}>
      <primitive object={o} />
    </EffectComposer>
  )
}

// ---- loader bar (orig `b`) ----
const clamp = (e, t, r) => Math.min(r, Math.max(t, e))
function LoaderBar({ progress: e, fading: r }) {
  const n = clamp(e, 0, 100)
  return (
    <div
      className={`left-1/2 top-1/2 z-40 fixed flex h-4 w-[140px] -translate-x-1/2 -translate-y-1/2 items-center justify-center pointer-events-none ${r ? 'opacity-0' : 'opacity-100'}`}
      style={{ transition: 'opacity 250ms cubic-bezier(0.25, 1, 0.5, 1)' }}
      aria-hidden="true"
    >
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-l3">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-l1"
          style={{ width: `${n}%`, transition: 'width 520ms cubic-bezier(0.22, 1, 0.36, 1)', willChange: 'width' }}
        />
      </div>
    </div>
  )
}

function reducer(e, t) {
  switch (t.type) {
    case 'transition': return { ...e, transition: t.transition }
    case 'canvas/set': return { ...e, shouldRenderCanvas: t.value }
    case 'canvas/ensure': return e.shouldRenderCanvas ? e : { ...e, shouldRenderCanvas: true }
    default: return e
  }
}

const NOGATE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('nogate')
const subscribeLoad = (fn) => loadStore.subscribe(fn)
const subscribeMenu = (fn) => menuStore.subscribe(fn)
const subscribeNav = (fn) => navStore.subscribe(fn)
const subscribeRoute = (fn) => routerStore.subscribe(fn)

// orig `y` / `x` / `E`: per-route loading config. Only "/" waits for heavy assets (entry loader + route wait).
const DEFAULT_ROUTE_CFG = { entryLoading: { enabled: false }, routeLoading: { enabled: false } }
const ROUTE_CFG = { '/': { entryLoading: { enabled: true }, routeLoading: { enabled: true } } }
const routeCfg = (p) => ROUTE_CFG[p] ?? DEFAULT_ROUTE_CFG
const hrefPath = (e) => {
  if (!e) return null
  if (e.startsWith('/')) { const [t] = e.split('?'); return (t.split('#')[0]) || '/' }
  try { return new URL(e, window.location.origin).pathname || '/' } catch { return null }
}

// orig `M` (34841): entry (wait -> reveal) and route (cover -> push -> wait -> reveal) dot-iris controller.
export default function TransitionCanvas() {
  const m = useSyncExternalStore(subscribeMenu, () => !!menuStore.get().open)
  const v = useSyncExternalStore(subscribeLoad, () => !!loadStore.get().fontsReady)
  const i = useSyncExternalStore(subscribeRoute, () => routerStore.get().pathname)
  const a = useSyncExternalStore(subscribeNav, () => navStore.get().targetHref)
  const u = useSyncExternalStore(subscribeNav, () => navStore.get().replace)
  // heavy load progress (orig cV: S = (models + layers)/total*100) and readyToLoadHeavy (orig p)
  const h = useSyncExternalStore(subscribeLoad, () => {
    const s = loadStore.get()
    const total = s.modelsTotal + s.texTotal
    return total === 0 ? 100 : ((s.modelsLoaded + s.texLoaded) / total) * 100
  })
  const d = useSyncExternalStore(subscribeLoad, () => {
    const s = loadStore.get()
    return s.modelsLoaded >= s.modelsTotal && s.texTotal > 0 && s.texLoaded >= s.texTotal
  })
  const g = useRef({ routeFromPath: null, coverDone: false })
  const [{ transition: y, shouldRenderCanvas: x }, M] = useReducer(reducer, NOGATE
    ? { transition: { mode: 'idle' }, shouldRenderCanvas: false }
    : { transition: { mode: 'entry', phase: 'wait' }, shouldRenderCanvas: true })
  const T = useMemo(() => routeCfg(i), [i])
  const S = useMemo(() => hrefPath(a), [a])
  const L = useMemo(() => (S ? routeCfg(S) : T), [S, T])
  const [P, H] = useState(false)
  const [z, A] = useState(false)
  const F = clamp(d ? 100 : Math.min(h, 99.999), 0, 100)
  const j = useMemo(() => (T.entryLoading.enabled ? clamp(50 * !!v + (F / 100) * 50, 0, 100) : F), [T.entryLoading.enabled, v, F])
  const _ = y.mode === 'entry' && T.entryLoading.enabled && (y.phase === 'wait' || y.phase === 'reveal') && !z
  const U = y.mode === 'idle' ? 'idle' : `${y.mode}:${y.phase}`
  const k = `${U}:${a ?? ''}:${m ? '1' : '0'}`

  // startNavigation -> route:cover
  useEffect(() => {
    if (a && y.mode === 'idle') {
      g.current.routeFromPath = i
      g.current.coverDone = false
      M({ type: 'transition', transition: { mode: 'route', phase: 'cover' } })
    }
  }, [a, y.mode, i])
  useEffect(() => {
    if (y.mode !== 'entry' || y.phase !== 'wait') return
    if (!T.entryLoading.enabled || (d && v)) M({ type: 'transition', transition: { mode: 'entry', phase: 'reveal' } })
  }, [y, d, v, T])
  useEffect(() => {
    if (y.mode === 'route' && y.phase === 'wait' && g.current.coverDone && g.current.routeFromPath && i !== g.current.routeFromPath && (!L.routeLoading.enabled || (d && v))) {
      M({ type: 'transition', transition: { mode: 'route', phase: 'reveal' } })
    }
  }, [y, d, v, i, L])
  useEffect(() => {
    let e
    if (!_ || P || j < 100) return
    const t = window.setTimeout(() => {
      H(true)
      e = window.setTimeout(() => { A(true) }, 250)
    }, 250)
    return () => { window.clearTimeout(t); e && window.clearTimeout(e) }
  }, [j, _, P])

  const O = y.mode === 'idle' ? m : y.phase !== 'reveal'
  const B = y.mode === 'entry' && y.phase === 'wait' ? 1 : undefined
  const I = (y.mode === 'route' && y.phase === 'cover') || (y.mode === 'entry' && y.phase === 'reveal') || (y.mode === 'route' && y.phase === 'reveal') || y.mode === 'idle'
    ? (t) => {
      if (t && y.mode === 'route' && y.phase === 'cover') {
        g.current.coverDone = true
        if (a) {
          loadStore.set({ allowScrambleLines: false })
          // Fresh heavy-load accounting for the destination (orig: readyToLoadHeavy=false / heavyLoadProgress=0
          // at startNavigation; here the counters are zeroed while fully covered so the old home scene is unaffected).
          loadStore.set({ modelsLoaded: 0, texLoaded: 0, texTotal: 0 })
          routerPush(a, { replace: u })
          M({ type: 'transition', transition: { mode: 'route', phase: 'wait' } })
        }
      }
      if (!t && y.mode !== 'idle' && y.phase === 'reveal') {
        M({ type: 'transition', transition: { mode: 'idle' } })
        loadStore.set({ revealed: true })
        clearNavigation()
        g.current.routeFromPath = null
        g.current.coverDone = false
        m || M({ type: 'canvas/set', value: false })
      }
      if (!t && y.mode === 'idle' && !m) M({ type: 'canvas/set', value: false })
    }
    : undefined

  useEffect(() => {
    (m || y.mode !== 'idle') && M({ type: 'canvas/ensure' })
  }, [m, y.mode])
  useEffect(() => {
    if (y.mode === 'idle') {
      loadStore.set(NOGATE ? { allowScrambleLines: true, revealed: true } : { allowScrambleLines: true })
      return
    }
    if (y.phase !== 'reveal') return
    const e = window.setTimeout(() => { loadStore.set({ allowScrambleLines: true }) }, 100)
    return () => window.clearTimeout(e)
  }, [y])

  const N = x || y.mode !== 'idle' || m
  return (
    <>
      {N && (
        <TransitionShell>
          {({ maskMaterialRef: e }) => (
            <>
              <MaskPlane open={O} duration={0.8} initialProgress={B} resetKey={k} onComplete={I} materialRef={e} />
              <DotsComposer maskMaterialRef={e} pixelSize={16} />
            </>
          )}
        </TransitionShell>
      )}
      {_ && <LoaderBar progress={j} fading={P} />}
    </>
  )
}
