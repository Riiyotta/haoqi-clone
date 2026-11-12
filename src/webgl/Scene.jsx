// Main R3F scene — port of orig cV (4d3f3b68 ~19018-19380) and its camera (sx + cK).
// Track B1. B2 renders <ImageLayers/> and <PostEffects/> (EffectComposer renderPriority 998).
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { loadStore } from '../lib/shared.js'
import ImageLayers from './ImageLayers.jsx'
import PostEffects from './PostEffects.jsx'
import Bokeh from './Bokeh.jsx'
import DotOverlay from './DotOverlay.jsx'
import Stickers from './Stickers.jsx'
import HyperCursor from './HyperCursor.jsx'
import { GlassProvider, GlassModel, useGLTF } from './Glass.jsx'
import { customCubic } from './easing.js'
import { sceneState, normProgress, hysteresisLatch, EFFECT_THRESHOLDS } from './sceneState.js'
import {
  sectionPosition, startSectionTracking, subscribeSections, verifySectionEls, beginSectionLayoutFrame,
  findSection, getScrollTopPx, getViewportHeightPx, isSectionInViewport, pointer, startPointer,
} from './sectionEnv.js'
import { useIsMobileWidth } from './hooks.js'

useGLTF.preload('/model/hello.gltf')
useGLTF.preload('/model/cursor.glb')
useGLTF.preload('/model/cnt.gltf')

// Final-render throttle hook for B2's composer. In the original the composer renders EVERY frame —
// sF only throttles the glass FBO and the bokeh pre-passes — so this always returns true.
if (typeof window !== 'undefined') window.__hqShouldRender = () => true

const OVERLAY_COLORS = ['#0F1111', '#FBFAF4']
const FBO_POLICY = { mode: 'skip-fbo', drivenByOverlay: true, ...EFFECT_THRESHOLDS.refractiveEffect } // orig cj
const GLASS_HOSTS = ['banner', 'footer'] // orig cU
const Z_RANGE = { min: 24, max: 32 } // orig cN / cJ
const PARALLAX = { parallaxEnabled: true, parallaxStrength: 1.4, parallaxLag: 0.18, parallaxRotate: 0.12, leaveParallaxLag: 0.05 }
const MODEL_KEYS = ['hello', 'h_star', 'cnt']
const HELLO_POS = [-0.1, 0, 2]
const HELLO_BEFORE = [0, 240, 0], HELLO_AFTER = [0, 90, 0], HELLO_ROT = [0, 4, 0]
const CUR_TILT = [0, 0, 45], CUR_BEFORE = [0, 0, 0], CUR_AFTER = [0, 720, 0]
const CUR_TINT = ['#009dff', '#009dff', '#64c3ff', '#64c3ff']
const CNT_BEFORE = [-180, 0, 0], CNT_ROT = [0, 0, 0]
const CNT_TINT = ['#FFFFFF', '#009dff', '#8e9dc4', '#64c3ff']

// orig sP computation (fB effect), evaluated every frame from the Lenis animated scroll.
function computeSceneProgress() {
  const banner = findSection(sectionPosition, 'banner')
  const footer = findSection(sectionPosition, 'footer')
  const t = getScrollTopPx()
  const i = Math.max(1, getViewportHeightPx())
  const o = Math.max(1, 0.25 * i)
  const a = banner ? banner.y - t + banner.height : i
  const sI = (v, lo, hi) => Math.min(hi, Math.max(lo, v))
  return normProgress(sI((i - a) / Math.max(1, i - o), 0, 1) * sI((footer ? footer.y - t : 0) / i, 0, 1))
}

// orig cH + sP update + shared sceneState
function FrameStart() {
  useFrame(() => {
    sceneState.frame++
    beginSectionLayoutFrame(sceneState.frame)
    verifySectionEls()
    const e = computeSceneProgress()
    if (Math.abs(sceneState.sP - e) > 0.001) sceneState.sP = e
    sceneState.solidMode = hysteresisLatch(sceneState.solidMode, sceneState.sP, EFFECT_THRESHOLDS.solidEffect)
    sceneState.refractiveOpaque = hysteresisLatch(sceneState.refractiveOpaque, sceneState.sP, EFFECT_THRESHOLDS.refractiveEffect)
    const st = getScrollTopPx(), vh = getViewportHeightPx()
    const b = findSection(sectionPosition, 'banner'), f = findSection(sectionPosition, 'footer')
    sceneState.bannerInView = b ? isSectionInViewport(b, st, vh) : true
    sceneState.footerInView = f ? isSectionInViewport(f, st, vh) : false
  }, -1000)
  return null
}

// orig sx (PerspectiveCamera makeDefault, position [0,0,22]) + cK (fov / dolly / parallax)
function CameraRig({ ready }) {
  const set = useThree((s) => s.set)
  const size = useThree((s) => s.size)
  const mobile = useIsMobileWidth()
  const camRef = useRef(null)
  const cam = useMemo(() => {
    const c = new THREE.PerspectiveCamera()
    c.position.set(0, 0, 22)
    return c
  }, [])
  camRef.current = cam
  useLayoutEffect(() => { set({ camera: cam }) }, [cam, set])
  const { parallaxEnabled: t, parallaxStrength: r, parallaxLag: n, parallaxRotate: i, leaveParallaxLag: o } = PARALLAX
  const base = useRef(null)
  const offset = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const m = useMemo(() => new THREE.Vector3(), [])
  const g = useMemo(() => new THREE.Vector3(), [])
  const zero = useMemo(() => new THREE.Vector3(), [])
  const A = useRef(Z_RANGE.min)
  const y = useRef(0)
  const hfov = size.width >= 1024 ? 60 : 38
  useLayoutEffect(() => {
    const r0 = size.width / size.height
    cam.aspect = r0
    const fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(hfov) / 2) / r0))
    if (Math.abs(cam.fov - fov) > 1e-4) cam.fov = fov
    cam.updateProjectionMatrix()
  }, [size, hfov, cam])
  useEffect(() => { A.current = THREE.MathUtils.lerp(Z_RANGE.min, Z_RANGE.max, THREE.MathUtils.clamp(sceneState.sP, 0, 1)) }, [])
  const readyRef = useRef(ready)
  readyRef.current = ready
  useFrame((_, delta) => {
    const x = camRef.current
    if (!x) return
    base.current || (base.current = new THREE.Vector2(x.position.x, x.position.y))
    const C = THREE.MathUtils.clamp(sceneState.sP, 0, 1)
    A.current = THREE.MathUtils.lerp(Z_RANGE.min, Z_RANGE.max, C)
    y.current = readyRef.current() ? Math.min(y.current + delta / 1.2, 1) : 0
    x.position.z = THREE.MathUtils.lerp(A.current + 8, A.current, customCubic(y.current))
    if (t && base.current && !mobile) {
      const ex = (0.5 - pointer.uv.x) * 2
      const ey = (0.5 - pointer.uv.y) * 2
      m.set(ex * r, ey * r * 0.6, 0)
      g.set(-m.x * i, -m.y * i, 0)
      const a = pointer.insideRef.current ? n : o
      offset.current.lerp(m, a)
      look.current.lerp(g, a)
      x.position.x = base.current.x + offset.current.x
      x.position.y = base.current.y + offset.current.y
      x.lookAt(look.current)
    } else if (base.current) {
      offset.current.lerp(zero, n)
      look.current.lerp(zero, n)
      x.position.x = base.current.x
      x.position.y = base.current.y
      x.lookAt(0, 0, 0)
    }
  }, -2)
  return <primitive object={cam} />
}

// Fallback final render while B2's composer is not mounted (it sets window.__hqPostActive = true).
function FallbackRender() {
  useFrame((state) => {
    if (window.__hqPostActive === true) return
    if (!window.__hqShouldRender()) return
    state.gl.setRenderTarget(null)
    state.gl.render(state.scene, state.camera)
  }, 1)
  return null
}

// IntersectionObserver gate for the hyper-space cursor (rootMargin 480px, as orig cV)
function useHyperSpaceIntersecting(el) {
  const [on, setOn] = useState(false)
  useEffect(() => {
    if (!el) return
    const io = new IntersectionObserver(([e]) => setOn(e.isIntersecting), { root: null, rootMargin: '480px 0px 480px 0px', threshold: 0 })
    io.observe(el)
    return () => { io.disconnect(); setOn(false) }
  }, [el])
  return on
}

let sectionsVersion = 0
const subVersion = (cb) => subscribeSections(() => { sectionsVersion++; cb() })
const getVersion = () => sectionsVersion

function SceneContents() {
  const mobile = useIsMobileWidth()
  useSyncExternalStore(subVersion, getVersion, getVersion)
  const hyper = findSection(sectionPosition, 'hyper-space')
  const hyperRef = hyper?.ref ?? null
  const hyperEl = hyperRef?.current ?? null
  const hyperOn = useHyperSpaceIntersecting(hyperEl)

  // loading: models count after 5 rendered frames (orig onReady -> l(key))
  const readySet = useRef(new Set())
  const onReady = useMemo(() => Object.fromEntries(MODEL_KEYS.map((k) => [k, () => {
    if (readySet.current.has(k)) return
    readySet.current.add(k)
    loadStore.set({ modelsLoaded: readySet.current.size, modelsTotal: MODEL_KEYS.length })
  }])), [])
  useEffect(() => { loadStore.set({ modelsLoaded: 0, modelsTotal: MODEL_KEYS.length }) }, [])
  const isReady = useMemo(() => () => {
    const s = loadStore.get()
    return readySet.current.size >= MODEL_KEYS.length && s.texLoaded >= s.texTotal
  }, [])
  const getHyperRect = useMemo(() => () => null, [])
  const cursorPos = useMemo(() => [mobile ? 6.6 : 11.6, mobile ? -5.6 : -4.2, -3], [mobile])

  return (
    <>
      <FrameStart />
      <CameraRig ready={isReady} />
      <DotOverlay overlayColors={OVERLAY_COLORS} overlayPixelSize={4} />
      <GlassProvider performancePolicy={FBO_POLICY} sectionPosition={sectionPosition} glassHostingSectionNames={GLASS_HOSTS}>
        <GlassModel
          model="/model/hello.gltf" scrollSyncFactor={0.72} modelPosition={HELLO_POS}
          beforeRotation={HELLO_BEFORE} afterRotation={HELLO_AFTER} rotation={HELLO_ROT}
          scale={mobile ? 19 : 22} sectionPosition={sectionPosition} sectionName="banner" onReady={onReady.hello} tintEnabled
        />
        <GlassModel
          model="/model/cursor.glb" scrollSyncFactor={0.72} modelPosition={cursorPos}
          rotationAxisTilt={CUR_TILT} beforeRotation={CUR_BEFORE} afterRotation={CUR_AFTER}
          scale={0.1} sectionPosition={sectionPosition} sectionName="banner" tintEnabled tingColor={CUR_TINT} onReady={onReady.h_star}
        />
        <Bokeh />
        <GlassModel
          model="/model/cnt.gltf" beforeRotation={CNT_BEFORE} rotation={CNT_ROT} scale={19}
          sectionPosition={sectionPosition} sectionName="footer" tintEnabled tingColor={CNT_TINT} onReady={onReady.cnt}
        />
        <Stickers sectionPosition={sectionPosition} sectionName="banner" />
        <ImageLayers />
        {hyperRef && hyperOn && <HyperCursor targetRef={hyperRef} getTargetRect={getHyperRect} scaleSpinDegrees={180} />}
        <PostEffects />
      </GlassProvider>
    </>
  )
}

export default function Scene() {
  useEffect(() => startSectionTracking(), [])
  useEffect(() => startPointer(), [])
  return (
    <Canvas dpr={[1, 2]}>
      <Suspense fallback={null}>
        <SceneContents />
      </Suspense>
      <FallbackRender />
    </Canvas>
  )
}
