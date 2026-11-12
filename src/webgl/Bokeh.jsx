// Bokeh light-streak background — port of orig sV / sz (4d3f3b68 ~12651-13045).
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { BOKEH_VERT, VIGNETTE_FRAG, SWIRL_FRAG, SINE_FRAG, SHATTER_FRAG, BOKEH_FRAG, OUTPUT_FRAG, OUTPUT_VERT } from './b1-shaders.js'
import { sceneState, normProgress, frameCadence } from './sceneState.js'
import { pointer } from './sectionEnv.js'
import { useTheme, useIsMobileWidth } from './hooks.js'

const LIGHT = { bg: '#ffead6', vignette: '#6196ff', output: '#acffb9' }
const DARK = { bg: '#2c4bd5', vignette: '#00000d', output: '#00344C' }
const MIX = { light: { outputMix: 0.65, edgeIntensity: -0.16 }, dark: { outputMix: 0.95, edgeIntensity: -0.82 } }
const toVec3 = (e) => { const t = new THREE.Color(e); return new THREE.Vector3(t.r, t.g, t.b) }
const FIXED_POS = new THREE.Vector2(0.5, -0.1) // orig sN
const clamp01 = (e) => THREE.MathUtils.clamp(e, 0, 1)
const setInput = (m, t) => { if (m.uniforms.tInput) m.uniforms.tInput.value = t }

const KS = {
  resolutionScale: 0.3,
  vignette: { radius: 0.354, falloff: 1, mix: 1, displace: 0, skew: 0.54, angle: 0, edgeIntensity: 0 },
  swirl: { radius: 0.25, angle: 0.1, phase: 0, mix: 0.5, pinch: 0 },
  sine: { mixRadius: 1, frequency: 0.35, amplitude: 1.18, rotation: 0 },
  shatter: { amount: 1, spread: 0.9, angleDeg: -45, skew: 0.9, mixRadius: 1, mixRadiusInvert: 0 },
  bokeh: { radius: 0.754, tilt: 0.5, trackMouse: 0 },
  smoothing: 0.1,
  leaveSmoothing: 0.05,
}

function makeNoiseTexture(e = 128) {
  const t = new Uint8ClampedArray(e * e * 4)
  for (let i = 0; i < t.length; i += 4) {
    const r = Math.floor(255 * Math.random())
    t[i] = r; t[i + 1] = r; t[i + 2] = r; t[i + 3] = 255
  }
  const c = document.createElement('canvas')
  c.width = e; c.height = e
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(e, e)
  img.data.set(t); ctx.putImageData(img, 0, 0)
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping
  return tex
}

export default function Bokeh() {
  const e = KS
  const gl = useThree((s) => s.gl)
  const size = useThree((s) => s.size)
  const theme = useTheme()
  const mobile = useIsMobileWidth()
  const res = useMemo(() => new THREE.Vector2(1, 1), [])
  const sharedPos = useMemo(() => new THREE.Vector2(0.5, 0.5), [])
  const uTime = useMemo(() => ({ value: 0 }), [])
  const noise = useMemo(() => makeNoiseTexture(128), [])
  const noiseRes = useMemo(() => new THREE.Vector2(128, 128), [])
  useEffect(() => () => noise.dispose(), [noise])

  const pal = useMemo(() => {
    const l = theme === 'light' ? LIGHT : DARK
    return { hex: l, vec: { bg: toVec3(l.bg), vignette: toVec3(l.vignette), output: toVec3(l.output) }, mix: MIX[theme] }
  }, [theme])
  const h = useMemo(() => pal.vec, [theme]) // eslint-disable-line react-hooks/exhaustive-deps
  const p = useMemo(() => pal.mix, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

  const m = useMemo(() => {
    const mk = (frag, extra = {}) =>
      new THREE.ShaderMaterial({
        vertexShader: BOKEH_VERT,
        fragmentShader: frag,
        uniforms: {
          tInput: { value: null },
          uResolution: { value: res },
          uTime,
          uPos: { value: sharedPos },
          uMousePos: { value: new THREE.Vector2(0.5, 0.5) },
          uTrackMouse: { value: 1 },
          ...extra,
        },
        transparent: false,
        blending: THREE.NoBlending,
        depthTest: false,
        depthWrite: false,
        toneMapped: false,
      })
    const vignette = mk(VIGNETTE_FRAG, {
      uRadius: { value: e.vignette.radius },
      uFalloff: { value: e.vignette.falloff },
      uMix: { value: e.vignette.mix },
      uDisplace: { value: e.vignette.displace },
      uSkew: { value: e.vignette.skew },
      uAngle: { value: e.vignette.angle },
      uEdgeIntensity: { value: p.edgeIntensity },
      uVignetteColor: { value: h.vignette.clone() },
      uColorAlpha: { value: 1 },
      uClearColor: { value: h.bg.clone() },
      uTrackMouse: { value: 1 },
    })
    const swirl = mk(SWIRL_FRAG, {
      uRadius: { value: e.swirl.radius },
      uAngle: { value: e.swirl.angle },
      uPhase: { value: e.swirl.phase },
      uMix: { value: e.swirl.mix },
      uPinch: { value: e.swirl.pinch },
    })
    const sine = mk(SINE_FRAG, {
      uMixRadius: { value: e.sine.mixRadius },
      uFrequency: { value: e.sine.frequency },
      uAmplitude: { value: e.sine.amplitude },
      uRotation: { value: e.sine.rotation },
    })
    const shatter = mk(SHATTER_FRAG, {
      uAmount: { value: e.shatter.amount },
      uSpread: { value: e.shatter.spread },
      uAngle: { value: e.shatter.angleDeg / 360 },
      uSkew: { value: e.shatter.skew },
      uCellScale: { value: 16 },
      uMixRadius: { value: e.shatter.mixRadius },
      uMixRadiusInvert: { value: e.shatter.mixRadiusInvert },
      uEasing: { value: 1 },
      uTrackMouse: { value: 0 },
      uPos: { value: new THREE.Vector2(0.5, 0.5) },
      uRoundness: { value: 0.02 },
    })
    const bokeh = mk(BOKEH_FRAG, {
      tBlueNoise: { value: noise },
      uBlueNoiseResolution: { value: noiseRes.clone() },
      uAmount: { value: 3.125 * e.bokeh.radius },
      uTilt: { value: e.bokeh.tilt },
      uPos: { value: new THREE.Vector2(0.5, 0.5) },
      uTrackMouse: { value: e.bokeh.trackMouse },
    })
    const output = mk(OUTPUT_FRAG, {
      uBgColor: { value: h.bg.clone() },
      uOutputColor: { value: h.output.clone() },
      uLoaded: { value: 1 },
      uOutputMix: { value: p.outputMix },
    })
    output.vertexShader = OUTPUT_VERT
    output.depthTest = false
    output.depthWrite = false
    output.toneMapped = false
    output.transparent = false
    output.blending = THREE.NoBlending
    const prePasses = [
      { name: 'vignette', material: vignette },
      { name: 'swirl', material: swirl },
      { name: 'sine', material: sine },
      { name: 'shatter', material: shatter },
      { name: 'bokeh', material: bokeh },
    ]
    return { prePasses, outputMaterial: output, vignetteMaterial: vignette, shatterMaterial: shatter, mouseConsumers: prePasses.filter((x) => x.name !== 'shatter') }
  }, [e, res, sharedPos, uTime, noise, noiseRes, h, p])

  const rts = useRef(null)
  if (!rts.current) rts.current = { read: new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }), write: new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }) }
  const frameCount = useRef(0)

  useEffect(() => {
    const n = Math.max(1, Math.floor(size.width * e.resolutionScale))
    const i = Math.max(1, Math.floor(size.height * e.resolutionScale))
    res.set(n, i)
    rts.current.read.dispose(); rts.current.write.dispose()
    rts.current = { read: new THREE.WebGLRenderTarget(n, i, { depthBuffer: false }), write: new THREE.WebGLRenderTarget(n, i, { depthBuffer: false }) }
    gl.setRenderTarget(rts.current.read)
    gl.setClearColor(pal.hex.bg, 1)
    gl.clear()
    gl.setRenderTarget(null)
    frameCount.current = 0
    m.outputMaterial.uniforms.tInput.value = rts.current.read.texture
  }, [gl, e.resolutionScale, res, size.height, size.width, pal.hex.bg, m])
  useEffect(() => () => { rts.current.read.dispose(); rts.current.write.dispose() }, [])

  const passScene = useMemo(() => new THREE.Scene(), [])
  const passCam = useMemo(() => new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), [])
  const quad = useRef(null)
  useEffect(() => {
    const g = new THREE.PlaneGeometry(2, 2)
    const t = new THREE.Mesh(g, m.prePasses[0]?.material)
    passScene.add(t); quad.current = t
    return () => { passScene.remove(t); g.dispose() }
  }, [m, passScene])
  useEffect(() => () => { m.prePasses.forEach((x) => x.material.dispose()); m.outputMaterial.dispose() }, [m])
  useEffect(() => {
    const track = +!mobile
    m.prePasses.forEach((t) => { if (t.material.uniforms.uTrackMouse) t.material.uniforms.uTrackMouse.value = track })
    m.vignetteMaterial.uniforms.uPos && m.vignetteMaterial.uniforms.uPos.value.copy(FIXED_POS)
    m.shatterMaterial.uniforms.uPos && m.shatterMaterial.uniforms.uPos.value.copy(FIXED_POS)
    const t = m.prePasses.find((x) => x.name === 'bokeh')
    t && t.material.uniforms.uPos && t.material.uniforms.uPos.value.copy(FIXED_POS)
  }, [mobile, m])

  const smoothed = useMemo(() => new THREE.Vector2(0.5, 0.5), [])
  const target = useMemo(() => new THREE.Vector2(0.5, 0.5), [])
  const center = useMemo(() => new THREE.Vector2(0.5, 0.5), [])
  const raw = useMemo(() => new THREE.Vector2(0.5, 0.5), [])
  const bgCur = useMemo(() => h.bg.clone(), [h])
  const bgTgt = useMemo(() => h.bg.clone(), [h])
  const vigCur = useMemo(() => h.vignette.clone(), [h])
  const vigTgt = useMemo(() => h.vignette.clone(), [h])
  const outCur = useMemo(() => h.output.clone(), [h])
  const outTgt = useMemo(() => h.output.clone(), [h])
  useEffect(() => { bgTgt.copy(pal.vec.bg); vigTgt.copy(pal.vec.vignette); outTgt.copy(pal.vec.output) }, [pal, bgTgt, vigTgt, outTgt])

  useFrame((state) => {
    const r = rts.current
    const n = quad.current
    if (!r || !n) return
    uTime.value = state.clock.getElapsedTime()
    if (mobile) {
      sharedPos.copy(FIXED_POS)
      m.mouseConsumers.forEach((x) => { x.material.uniforms.uMousePos && x.material.uniforms.uMousePos.value.copy(FIXED_POS) })
      m.shatterMaterial.uniforms.uPos.value.copy(FIXED_POS)
    } else {
      raw.set(clamp01(pointer.uv.x), clamp01(pointer.uv.y))
      pointer.insideRef.current ? target.copy(raw) : target.copy(center)
      const k = pointer.insideRef.current ? e.smoothing : e.leaveSmoothing
      smoothed.lerp(target, k)
      sharedPos.copy(smoothed)
      m.mouseConsumers.forEach((x) => { x.material.uniforms.uMousePos && x.material.uniforms.uMousePos.value.copy(smoothed) })
      m.shatterMaterial.uniforms.uPos.value.copy(center)
    }
    bgCur.lerp(bgTgt, e.smoothing)
    vigCur.lerp(vigTgt, e.smoothing)
    outCur.lerp(outTgt, e.smoothing)
    m.vignetteMaterial.uniforms.uVignetteColor.value.copy(vigCur)
    m.vignetteMaterial.uniforms.uClearColor.value.copy(bgCur)
    m.outputMaterial.uniforms.uBgColor.value.copy(bgCur)
    m.outputMaterial.uniforms.uOutputColor.value.copy(outCur)
    const g = state.gl
    const s = normProgress(sceneState.sP)
    if (!(s >= 0.98)) {
      if (frameCount.current++ % Math.max(frameCadence(s, false), 2) === 0) {
        for (const pass of m.prePasses) {
          setInput(pass.material, r.read.texture)
          n.material = pass.material
          g.setRenderTarget(r.write)
          g.render(passScene, passCam)
          g.setRenderTarget(null)
          const t = r.read
          r.read = r.write
          r.write = t
        }
        setInput(m.outputMaterial, r.read.texture)
      }
    }
  }, -2)

  return (
    <mesh frustumCulled={false} renderOrder={-10}>
      <planeGeometry args={[2, 2]} />
      <primitive object={m.outputMaterial} attach="material" />
    </mesh>
  )
}
