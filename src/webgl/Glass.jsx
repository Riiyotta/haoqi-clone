// Glass refraction system — port of orig ca (light orbit), cl (controls), cu (FBO provider), cp (glass model).
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { GLASS_VERT, GLASS_FRAG } from './b1-shaders.js'
import { sceneState, normProgress, frameCadence, hysteresisLatch } from './sceneState.js'
import {
  pointer, anySectionInViewport, findSection, getViewportHeightPx, getScrollTopPx, isSectionInViewport,
  readSectionContentLayout, getSectionContentCenterDocY, scrollSyncedWorldYFromAnchorDocY,
} from './sectionEnv.js'
import { useTheme, useIsMobileWidth } from './hooks.js'

// ------------------------------------------------------------ GLTF (orig cn / cr)
const DRACO_URL = 'https://www.gstatic.com/draco/versioned/decoders/1.5.5/'
let draco = null
const gltfExt = (loader) => {
  if (!draco) { draco = new DRACOLoader(); draco.setDecoderPath(DRACO_URL) }
  loader.setDRACOLoader(draco)
  loader.setMeshoptDecoder(MeshoptDecoder)
}
export const useGLTF = (url) => useLoader(GLTFLoader, url, gltfExt)
useGLTF.preload = (url) => useLoader.preload(GLTFLoader, url, gltfExt)

// orig cd / cb: recentre geometry on its bbox centre
export function recenter(e) {
  e.computeBoundingBox()
  const t = e.boundingBox
  if (!t) return
  const r = (t.min.x + t.max.x) / 2, n = (t.min.y + t.max.y) / 2, i = (t.min.z + t.max.z) / 2
  if (Math.abs(r) + Math.abs(n) + Math.abs(i) < 1e-8) return
  e.translate(-r, -n, -i)
  e.computeBoundingSphere()
}
export function useMergedGeometry(url) {
  const g = useGLTF(url)
  return useMemo(() => {
    if (!g) return null
    g.scene.updateMatrixWorld(true)
    const list = []
    g.scene.traverse((t) => {
      if (t instanceof THREE.Mesh && t.geometry) {
        const r = t.geometry.clone()
        r.applyMatrix4(t.matrixWorld)
        list.push(r)
      }
    })
    if (list.length === 0) return null
    try {
      const t = mergeGeometries(list, true)
      recenter(t)
      return t
    } catch {
      const t = list[0]
      recenter(t)
      return t
    }
  }, [g])
}

// ------------------------------------------------------------ light orbit (orig ca)
export function createLightOrbit() {
  const e0 = 4, t0 = 9
  const r = Math.hypot(e0, t0)
  const n = Math.atan2(t0, e0)
  let i = n
  const o = new THREE.Raycaster()
  const a = new THREE.Vector2()
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0)
  const s = new THREE.Vector3()
  const u = new THREE.Vector2(e0, t0)
  let c = n
  const f = () => ({ x: u.x, y: u.y })
  return {
    update: ({ uv, inside, camera, delta }) => {
      a.set(2 * uv.x - 1, 2 * uv.y - 1)
      o.setFromCamera(a, camera)
      const g = o.ray.intersectPlane(plane, s)
      const v = g !== null
      v && s.copy(g)
      const A = inside && v
      const y = -s.x, b = -s.y
      if (A && y * y + b * b > 1e-6) i = Math.atan2(b, y)
      const x = A ? i : n
      const p = c
      const m = Math.atan2(Math.sin(x - p), Math.cos(x - p))
      c = p + m * (1 - Math.exp(-6 * delta))
      u.x = r * Math.cos(c)
      u.y = r * Math.sin(c)
      return f()
    },
    get: f,
  }
}

// ------------------------------------------------------------ controls (orig cl leva defaults)
export const GLASS_CONTROLS = {
  refractPower: 0.72, chromaticAberration: 0.14,
  specularStrength: 1.2, loop: 3,
  lightZ: 0.5,
  darkShininess: 100, darkDiffuseness: 0.05, darkFresnelPower: 3, darkFresnelStrength: 0.72,
  darkBrightness: 0.6, darkContrast: 0.98, darkGamma: 1, darkSaturation: 1.2,
  darkTintMix: 1, darkTintColorA: '#64c3ff', darkTintColorB: '#8e9dc4', darkTintThicknessMinAlpha: 1, darkTintThicknessMaxAlpha: 0.4,
  lightShininess: 120, lightDiffuseness: 0.1, lightFresnelPower: 1, lightFresnelStrength: 0.24,
  lightBrightness: 0.78, lightContrast: 0.9, lightGamma: 1, lightSaturation: 1.2,
  lightTintMix: 1, lightTintColorA: '#009dff', lightTintColorB: '#ffffff', lightTintThicknessMinAlpha: 1, lightTintThicknessMaxAlpha: 0.92,
  fresnelSideDirX: -1, fresnelSideDirY: 1, fresnelSideDirZ: -1,
}
// orig cf
export function themedGlassParams(e, theme) {
  const r = theme === 'dark'
  return {
    refractPower: e.refractPower,
    chromaticAberration: e.chromaticAberration,
    diffuseness: r ? e.darkDiffuseness : e.lightDiffuseness,
    shininess: r ? e.darkShininess : e.lightShininess,
    fresnelPower: r ? e.darkFresnelPower : e.lightFresnelPower,
    saturation: r ? e.darkSaturation : e.lightSaturation,
    brightness: r ? e.darkBrightness : e.lightBrightness,
    contrast: r ? e.darkContrast : e.lightContrast,
    gamma: r ? e.darkGamma : e.lightGamma,
    specularStrength: e.specularStrength,
    fresnelStrength: r ? e.darkFresnelStrength : e.lightFresnelStrength,
    fresnelSideDir: [e.fresnelSideDirX, e.fresnelSideDirY, e.fresnelSideDirZ],
    tintMix: r ? e.darkTintMix : e.lightTintMix,
    tintColorA: r ? e.darkTintColorA : e.lightTintColorA,
    tintColorB: r ? e.darkTintColorB : e.lightTintColorB,
    tintThicknessMinAlpha: r ? e.darkTintThicknessMinAlpha : e.lightTintThicknessMinAlpha,
    tintThicknessMaxAlpha: r ? e.darkTintThicknessMaxAlpha : e.lightTintThicknessMaxAlpha,
    loop: e.loop,
  }
}

// orig sb (drei useFBO subset)
function useFBO(w, h, opts) {
  const { samples = 0, depth, ...rest } = opts
  const d = depth ?? rest.depthBuffer
  const rt = useMemo(() => {
    const t = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, type: THREE.HalfFloatType, ...rest })
    if (d) t.depthTexture = new THREE.DepthTexture(w, h, THREE.FloatType)
    t.samples = samples
    return t
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useLayoutEffect(() => { rt.setSize(w, h); if (samples) rt.samples = samples }, [samples, rt, w, h])
  useEffect(() => () => rt.dispose(), []) // eslint-disable-line react-hooks/exhaustive-deps
  return rt
}

// ------------------------------------------------------------ provider (orig cu)
const GlassCtx = createContext(null)
export const useGlassSystem = () => {
  const e = useContext(GlassCtx)
  if (!e) throw Error('useGlassSystem must be used within GlassMaterialControlsProvider')
  return e
}
export function GlassProvider({ performancePolicy: e, sectionPosition: t, glassHostingSectionNames: r, children }) {
  const controls = GLASS_CONTROLS
  const { size: o, camera: a, scene: l, gl: c, viewport: f } = useThree()
  const mobile = useIsMobileWidth()
  const h = Math.floor(0.5 * o.width * f.dpr)
  const p = Math.floor(0.5 * o.height * f.dpr)
  const m = useMemo(() => c.getDrawingBufferSize(new THREE.Vector2()), [c, o.width, o.height, f.dpr])
  const g = useMemo(() => new THREE.Vector2(h, p), [h, p])
  const v = useFBO(h, p, { stencilBuffer: false, depthBuffer: true, samples: 0 })
  useEffect(() => { a.layers.enable(10) }, [a])
  const A = useRef(false)
  const y = useRef(0)
  const b = useRef(true)
  useEffect(() => { y.current = 0 }, [o.width, o.height])
  useFrame((state) => {
    const n = e?.mode ?? 'none'
    const i = e?.drivenByOverlay ?? false
    if (n === 'skip-fbo' && i) {
      A.current = hysteresisLatch(A.current, sceneState.sP, { opaqueThreshold: e?.opaqueThreshold, opaqueTolerance: e?.opaqueTolerance, hysteresis: e?.hysteresis })
    } else if (A.current) A.current = false
    const inView = anySectionInViewport(t, r)
    if (A.current || !inView) { b.current = false; return }
    b.current = true
    const s = normProgress(sceneState.sP)
    if (y.current++ % frameCadence(s, mobile) !== 0) return
    const cam = state.camera
    const u = cam.layers.mask
    const prev = c.getRenderTarget()
    const ac = c.autoClear
    c.setRenderTarget(v)
    c.clear()
    cam.layers.mask = 1
    c.render(l, cam)
    cam.layers.mask = u
    c.setRenderTarget(prev)
    c.autoClear = ac
  }, -1)
  const x = useMemo(() => ({ controls, envMapBase: v.texture, screenResolutionPx: m, refractionResolutionPx: g, glassLayer: 10, sceneRefractionActiveRef: b }), [controls, v.texture, g, m])
  return <GlassCtx.Provider value={x}>{children}</GlassCtx.Provider>
}

// orig ch: parse css colour + alpha
function parseColorAlpha(e) {
  const t = new THREE.Color(e)
  let r = 1
  const n = e.trim()
  if (n.startsWith('#')) {
    if (n.length === 9) r = parseInt(n.slice(7, 9), 16) / 255
    else if (n.length === 5) { const k = n.slice(4, 5); r = parseInt(k + k, 16) / 255 }
  } else {
    const m = n.match(/^rgba?\(([^)]+)\)$/i)
    if (m) {
      const parts = m[1].split(',').map((x) => x.trim())
      if (parts.length === 4) { const a = parseFloat(parts[3]); Number.isNaN(a) || (r = Math.min(Math.max(a, 0), 1)) }
    }
  }
  return { color: t, alpha: r }
}

const deg = (e) => THREE.MathUtils.degToRad(e)
const floatOffset = (r) => 0.18 * Math.sin(1.2 * r) + 0.06 * Math.sin(0.6 * r)

// ------------------------------------------------------------ glass model (orig cp)
export function GlassModel({
  model, modelPosition = [0, 0, 0], rotationAxisTilt = [0, 0, 0], rotation = [0, 0, 0], beforeRotation, afterRotation,
  scale = 1, floatingMotion = true, onReady, tintEnabled = false, scrollSyncFactor = 1, sectionPosition, sectionName = 'footer', tingColor,
}) {
  const theme = useTheme()
  const { controls: A, envMapBase: y, screenResolutionPx: b, glassLayer: x, sceneRefractionActiveRef: C } = useGlassSystem()
  const B = useMemo(() => themedGlassParams(A, theme), [A, theme])
  const E = useMemo(() => {
    const dark = theme === 'dark'
    const t = B.tintColorA, r = B.tintColorB
    return tingColor
      ? { tintColorA: dark ? tingColor[2] || t : tingColor[0] || t, tintColorB: dark ? tingColor[3] || r : tingColor[1] || r }
      : { tintColorA: t, tintColorB: r }
  }, [theme, B.tintColorA, B.tintColorB, tingColor])
  const w = A.lightZ
  const meshRef = useRef(null)
  const matRef = useRef(null)
  const posGroup = useRef(null)
  const rotGroup = useRef(null)
  const lastVis = useRef(null)
  const readyFired = useRef(false)
  const frames = useRef(0)
  const mobile = useIsMobileWidth()
  const orbit = useMemo(() => createLightOrbit(), [])
  const L = useMemo(() => new THREE.Vector3(), [])
  const H = floatingMotion && !mobile
  const U = beforeRotation ?? rotation
  const J = useMemo(() => [deg(U[0]), deg(U[1]), deg(U[2])], [U[0], U[1], U[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  const K = useMemo(() => [deg(rotation[0]), deg(rotation[1]), deg(rotation[2])], [rotation[0], rotation[1], rotation[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  const $ = useMemo(() => (afterRotation ? [deg(afterRotation[0]), deg(afterRotation[1]), deg(afterRotation[2])] : null), [afterRotation?.[0], afterRotation?.[1], afterRotation?.[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  const z = useMemo(() => [deg(rotationAxisTilt[0]), deg(rotationAxisTilt[1]), deg(rotationAxisTilt[2])], [rotationAxisTilt[0], rotationAxisTilt[1], rotationAxisTilt[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  const V = useMemo(() => [-z[0], -z[1], -z[2]], [z])
  const posProp = useMemo(() => modelPosition, [modelPosition[0], modelPosition[1], modelPosition[2]]) // eslint-disable-line react-hooks/exhaustive-deps
  const scaleArr = useMemo(() => [scale, scale, scale], [scale])
  const W = useMergedGeometry(model)
  const Y = useMemo(() => {
    if (!W) return [0, 1]
    W.boundingBox || W.computeBoundingBox()
    const e = W.boundingBox
    if (!e) return [0, 1]
    const t = e.min.y, r = e.max.y
    return Math.abs(r - t) < 1e-6 ? [t, t + 1] : [t, r]
  }, [W])
  const Q = useMemo(() => ({
    uTexture: { value: null },
    uIorR: { value: 1.15 }, uIorY: { value: 1.16 }, uIorG: { value: 1.18 }, uIorC: { value: 1.22 }, uIorB: { value: 1.22 }, uIorP: { value: 1.22 },
    uRefractPower: { value: 0.24 }, uChromaticAberration: { value: 0.24 }, uSaturation: { value: 1 }, uShininess: { value: 40 },
    uDiffuseness: { value: 0.1 }, uFresnelPower: { value: 6 }, uBrightness: { value: 1 }, uContrast: { value: 1 }, uGamma: { value: 1 },
    uSpecularStrength: { value: 1.2 }, uFresnelStrength: { value: 1 }, uFresnelSideDir: { value: new THREE.Vector3(-1, 0.3, 1) },
    uTintColorA: { value: new THREE.Vector4(1, 1, 1, 1) }, uTintColorB: { value: new THREE.Vector4(1, 1, 1, 1) },
    uTintLocalYRange: { value: new THREE.Vector2(0, 1) }, uTintEnabled: { value: 0 }, uTintMix: { value: 0.8 },
    uTintThicknessMinAlpha: { value: 0.35 }, uTintThicknessMaxAlpha: { value: 1 }, uDark: { value: 0 }, uLoop: { value: 6 },
    uSceneRefractionEnabled: { value: 1 }, uRgbRefraction: { value: 0 }, uLight: { value: new THREE.Vector3(4, 9, 0.5) },
    uScreenResolutionPx: { value: new THREE.Vector2() },
  }), [])

  useLayoutEffect(() => { meshRef.current && meshRef.current.layers.set(x) }, [W, x])
  useLayoutEffect(() => {
    const e = matRef.current?.uniforms
    if (!e) return
    e.uTexture.value = y
    e.uRefractPower.value = B.refractPower
    e.uChromaticAberration.value = B.chromaticAberration
    e.uDiffuseness.value = B.diffuseness
    e.uShininess.value = B.shininess
    e.uFresnelPower.value = B.fresnelPower
    e.uSaturation.value = B.saturation
    e.uBrightness.value = B.brightness
    e.uContrast.value = B.contrast
    e.uGamma.value = B.gamma
    e.uSpecularStrength.value = B.specularStrength
    e.uFresnelStrength.value = B.fresnelStrength
    e.uFresnelSideDir.value.set(...B.fresnelSideDir)
    e.uTintMix.value = B.tintMix
    const loop = mobile ? Math.min(B.loop, 2) : B.loop
    e.uLoop.value = loop
    e.uRgbRefraction.value = +(loop <= 3)
    const { color: r, alpha: n } = parseColorAlpha(E.tintColorA)
    const { color: i, alpha: o } = parseColorAlpha(E.tintColorB)
    e.uTintColorA.value.set(r.r, r.g, r.b, n)
    e.uTintColorB.value.set(i.r, i.g, i.b, o)
    e.uTintLocalYRange.value.set(Y[0], Y[1])
    e.uTintThicknessMinAlpha.value = B.tintThicknessMinAlpha
    e.uTintThicknessMaxAlpha.value = B.tintThicknessMaxAlpha
    e.uTintEnabled.value = +!!tintEnabled
    e.uDark.value = +(theme === 'dark')
  }, [B, E, tintEnabled, y, theme, Y, mobile, W])
  useEffect(() => {
    const e = matRef.current?.uniforms
    e && e.uScreenResolutionPx.value.set(b.x, b.y)
  }, [b, W])

  const isVisible = useCallback(() => {
    const j = findSection(sectionPosition, sectionName)
    if (!j) return sectionName === 'banner'
    return isSectionInViewport(j, getScrollTopPx(), getViewportHeightPx())
  }, [sectionPosition, sectionName])
  const entryAfter = useCallback(() => {
    const j = findSection(sectionPosition, sectionName)
    if (!j) return { entry: 1, after: +!!afterRotation }
    const e = getViewportHeightPx()
    const t = getScrollTopPx()
    if (e <= 0) return { entry: 1, after: +!!afterRotation }
    const r = t + e
    const { topDocY: n } = readSectionContentLayout(j)
    const i = (r - n) / (r - t)
    return { entry: THREE.MathUtils.clamp(i, 0, 1), after: THREE.MathUtils.clamp(i - 1, 0, 1) }
  }, [afterRotation, sectionPosition, sectionName])

  useFrame(() => {
    const e = matRef.current?.uniforms
    e && (e.uSceneRefractionEnabled.value = +!!C.current)
  }, 0)
  useFrame((state, delta) => {
    const cam = state.camera
    const vis = isVisible()
    if (posGroup.current && lastVis.current !== vis) { lastVis.current = vis; posGroup.current.visible = vis }
    if (onReady && !readyFired.current) { frames.current += 1; if (frames.current >= 5) { readyFired.current = true; onReady() } }
    if (!vis) return
    const j = findSection(sectionPosition, sectionName)
    if (posGroup.current && j) {
      const worldH = state.viewport.getCurrentViewport(cam, L.set(0, 0, modelPosition[2])).height
      const yy = scrollSyncedWorldYFromAnchorDocY({
        anchorDocY: getSectionContentCenterDocY(j),
        scrollTopPx: getScrollTopPx(),
        viewportHeightPx: getViewportHeightPx(),
        viewportWorldHeight: worldH,
        scrollSyncFactor,
      })
      const fl = H ? floatOffset(state.clock.getElapsedTime()) : 0
      posGroup.current.position.y = yy + modelPosition[1] + fl
    }
    if (rotGroup.current) {
      const { entry, after } = entryAfter()
      let n = THREE.MathUtils.lerp(J[0], K[0], entry)
      let i = THREE.MathUtils.lerp(J[1], K[1], entry)
      let o = THREE.MathUtils.lerp(J[2], K[2], entry)
      if ($) {
        n = THREE.MathUtils.lerp(n, $[0], after)
        i = THREE.MathUtils.lerp(i, $[1], after)
        o = THREE.MathUtils.lerp(o, $[2], after)
      }
      const g = rotGroup.current.rotation
      g.x = THREE.MathUtils.damp(g.x, n, 6, delta)
      g.y = THREE.MathUtils.damp(g.y, i, 6, delta)
      g.z = THREE.MathUtils.damp(g.z, o, 6, delta)
    }
    const { x: lx, y: ly } = orbit.update({ uv: pointer.uv, inside: pointer.insideRef.current && !mobile, camera: cam, delta })
    const l = matRef.current?.uniforms
    l && l.uLight.value.set(lx, ly, w)
  }, -2)

  if (!W) return null
  return (
    <group ref={posGroup} visible={false} position={posProp}>
      <group rotation={z}>
        <group ref={rotGroup} rotation={J}>
          <group rotation={V}>
            <mesh ref={meshRef} geometry={W} scale={scaleArr}>
              <shaderMaterial ref={matRef} vertexShader={GLASS_VERT} fragmentShader={GLASS_FRAG} uniforms={Q} toneMapped={false} transparent />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}
