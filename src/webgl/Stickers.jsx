// Falling stickers — port of orig ul (4d3f3b68 ~13257-13757).
import { useCallback, useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useLoader, useThree } from '@react-three/fiber'
import { sceneState, hysteresisLatch, EFFECT_THRESHOLDS } from './sceneState.js'
import { findSection, getScrollTopPx, getViewportHeightPx } from './sectionEnv.js'
import { useIsMobileWidth } from './hooks.js'

export const STICKER_URLS = Array.from({ length: 12 }, (_, i) => `/sticker_img/s_${String(i + 1).padStart(2, '0')}.png`)
useLoader.preload(THREE.TextureLoader, STICKER_URLS)

const CFG = {
  particleCount: STICKER_URLS.length,
  spawnWidth: 32, clickSpawnWidth: 24, spawnHeight: 24, clickSpawnHeight: 24,
  positionY: 24, fallDistance: 48, zDepth: 4, zOffset: -6,
  windStrength: 1.8, windFrequency: 0.3, scale: 1.4, clickScale: 1.4, rotationSpeed: 0.8, fallSpeed: 1.8,
}
const VERT = `
attribute vec4 uvRect;

varying vec2 vAtlasUv;

void main() {
  vAtlasUv = uvRect.xy + uv * uvRect.zw;

  vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
}
`
const FRAG = `
uniform sampler2D map;

varying vec2 vAtlasUv;

void main() {
  vec4 color = texture2D(map, vAtlasUv);
  if (color.a < 0.01) discard;

  gl_FragColor = color;
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`
const pow2 = (e) => Math.pow(2, Math.ceil(Math.log2(Math.max(1, e))))
const imgOf = (e) => {
  const t = e.image
  if (!t) return null
  const r = t.width, n = t.height
  return typeof r !== 'number' || typeof n !== 'number' || r <= 0 || n <= 0 ? null : t
}
function spawn(e, t, mode = 'scroll') {
  const { spawnWidth: n, clickSpawnWidth: i, positionY: o, spawnHeight: a, clickSpawnHeight: l, scale: s, clickScale: u, rotationSpeed: c, windStrength: f, zDepth: d, zOffset: h, fallSpeed: p } = t
  const m = mode === 'click' ? l : a
  const g = Math.min(0.5 * Math.max(m, 0), 8)
  const v = mode === 'click' ? o + (2 * Math.random() - 1) * g : o + Math.random() * Math.max(m, 0)
  e.position.set(
    e.originX + (Math.random() - 0.5) * (mode === 'click' ? i : n),
    e.originY + v,
    e.originZ + (Math.random() - 0.5) * d + h,
  )
  e.startY = e.position.y
  e.fallSpeed = p * (0.6 + 0.8 * Math.random())
  e.rotation = Math.random() * Math.PI * 2
  e.rotationSpeed = (Math.random() - 0.5) * c * 2
  e.scale = mode === 'click' ? u : s
  e.windPhase = Math.random() * Math.PI * 2
  e.windAmplitude = 0.3 + Math.random() * f
  e.dead = false
  e.hasStarted = true
  e.emitAt = 0
}
const scratch = []
function pickTexture(e, used) {
  if (e <= 0) return 0
  if (used.size >= e) return Math.floor(Math.random() * e)
  scratch.length = 0
  for (let r = 0; r < e; r++) used.has(r) || scratch.push(r)
  return scratch[Math.floor(Math.random() * scratch.length)]
}
function insertSorted(e, t) {
  const r = t.position.z
  let n = 0, i = e.length
  while (n < i) { const m = (n + i) >>> 1; e[m].position.z <= r ? (n = m + 1) : (i = m) }
  e.push(t)
  for (let k = e.length - 1; k > n; k--) e[k] = e[k - 1]
  e[n] = t
}
function makeParticles(count, texCount, oneShot = false) {
  const n = Array.from({ length: count }, () => ({
    position: new THREE.Vector3(), startY: 0, fallSpeed: 0, rotation: 0, rotationSpeed: 0, scale: 1,
    textureIndex: Math.floor(Math.random() * texCount), windPhase: 0, windAmplitude: 0, emitAt: 0,
    hasStarted: true, dead: false, isOneShot: oneShot, originX: 0, originY: 0, originZ: 0,
  }))
  if (count > 0 && count <= texCount) {
    const r = Array.from({ length: texCount }, (_, i) => i)
    for (let t = r.length - 1; t > 0; t--) { const k = Math.floor(Math.random() * (t + 1)); [r[t], r[k]] = [r[k], r[t]] }
    for (let t = 0; t < count; t++) n[t].textureIndex = r[t]
  }
  return n
}
function capOneShots(e) {
  const t = e.filter((x) => !x.isOneShot || !x.dead)
  const r = t.filter((x) => !x.isOneShot)
  const n = t.filter((x) => x.isOneShot)
  if (n.length <= 384) return t
  n.sort((a, b) => b.emitAt - a.emitAt)
  return r.concat(n.slice(0, 384))
}

export default function Stickers({ images = STICKER_URLS, particlesPerBurst, showAtVh, sectionPosition, sectionName = 'footer' }) {
  const groupRef = useRef(null)
  const meshRef = useRef(null)
  const gl = useThree((s) => s.gl)
  const get = useThree((s) => s.get)
  const raycaster = useRef(new THREE.Raycaster())
  const ndc = useRef(new THREE.Vector2())
  const plane = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0))
  const particles = useRef([])
  const inited = useRef(false)
  const clock = useRef(0)
  const lastEmit = useRef(0)
  const usedTex = useRef(new Set())
  const drawList = useRef([])
  const dummy = useRef(new THREE.Object3D())
  const tmp = useRef(new THREE.Vector3())
  const solid = useRef(false)
  const refractive = useRef(false)
  const mobile = useIsMobileWidth()
  const cfg = useMemo(() => ({ ...CFG, particleCount: Math.max(1, particlesPerBurst ?? images.length) }), [images.length, particlesPerBurst])
  const loaded = useLoader(THREE.TextureLoader, images)
  const R = useMemo(() => (Array.isArray(loaded) ? loaded : [loaded]), [loaded])
  const ok = useMemo(() => R.length > 0 && R.every((e) => !!imgOf(e)), [R])
  const atlas = useMemo(() => {
    if (!ok) return null
    const t = R.map(imgOf)
    if (t.some((e) => !e)) return null
    const r = Math.max(...t.map((e) => e.width))
    const n = Math.max(...t.map((e) => e.height))
    const i = Math.ceil(Math.sqrt(t.length))
    const o = Math.ceil(t.length / i)
    const a = r + 4, l = n + 4
    const s = pow2(i * a), u = pow2(o * l)
    const c = document.createElement('canvas')
    c.width = s; c.height = u
    const f = c.getContext('2d')
    if (!f) return null
    f.clearRect(0, 0, s, u)
    const d = new Float32Array(4 * t.length)
    const h = []
    t.forEach((e, k) => {
      const row = Math.floor(k / i)
      const x = (k % i) * a + 2
      const y = row * l + 2
      f.drawImage(e, x, y, e.width, e.height)
      const q = 4 * k
      d[q] = (x + 0.5) / s
      d[q + 1] = 1 - (y + e.height - 0.5) / u
      d[q + 2] = (e.width - 1) / s
      d[q + 3] = (e.height - 1) / u
      h[k] = e.width / e.height
    })
    const p = new THREE.CanvasTexture(c)
    p.colorSpace = THREE.SRGBColorSpace
    p.minFilter = THREE.LinearFilter
    p.magFilter = THREE.LinearFilter
    p.wrapS = THREE.ClampToEdgeWrapping
    p.wrapT = THREE.ClampToEdgeWrapping
    p.generateMipmaps = false
    p.needsUpdate = true
    return { texture: p, uvRects: d, aspects: h }
  }, [ok, R])
  useEffect(() => () => { atlas?.texture.dispose() }, [atlas])
  const geom = useMemo(() => {
    const e = new THREE.PlaneGeometry(2, 2)
    e.setAttribute('uvRect', new THREE.InstancedBufferAttribute(new Float32Array(8192), 4))
    return e
  }, [])
  useEffect(() => () => geom.dispose(), [geom])
  const mat = useMemo(() => (atlas ? new THREE.ShaderMaterial({
    uniforms: { map: { value: atlas.texture } }, vertexShader: VERT, fragmentShader: FRAG,
    transparent: true, depthWrite: false, side: THREE.FrontSide, toneMapped: false,
  }) : null), [atlas])
  useEffect(() => () => { mat?.dispose() }, [mat])
  useEffect(() => {
    if (!atlas || inited.current) return
    inited.current = true; clock.current = 0; lastEmit.current = 0
    const e = makeParticles(cfg.particleCount, atlas.aspects.length, false)
    for (const t of e) spawn(t, cfg, 'scroll')
    particles.current = e
  }, [atlas, cfg])

  const burst = useCallback((pt) => {
    if (!atlas) return
    const t = makeParticles(cfg.particleCount, atlas.aspects.length, true)
    let r = 0.05 * Math.random()
    for (const e of t) { e.hasStarted = false; e.dead = false; e.emitAt = r; r += 0.04 + 0.04 * Math.random() }
    const n = pt.x, i = pt.y - cfg.positionY
    for (const e of t) { e.originX = n; e.originY = i; e.originZ = 0; e.emitAt += clock.current }
    particles.current = capOneShots(particles.current.concat(t))
  }, [atlas, cfg])

  // orig P: scrollTop threshold at which regular stickers run
  const showAt = () => {
    const e = findSection(sectionPosition, sectionName)
    if (!e) return Infinity
    return e.y + e.height / 2 - getViewportHeightPx()
  }

  useFrame((_, delta) => {
    const sp = sceneState.sP
    solid.current = hysteresisLatch(solid.current, sp, EFFECT_THRESHOLDS.solidEffect)
    refractive.current = hysteresisLatch(refractive.current, sp, EFFECT_THRESHOLDS.refractiveEffect)
    if (refractive.current) return
    const o = meshRef.current
    if (!o || !atlas || !inited.current) { if (o) { o.count = 0; o.visible = false } return }
    const l = Math.min(delta, 0.1)
    clock.current += l
    const s = particles.current
    const u = clock.current
    const P = showAt()
    const st = getScrollTopPx()
    const c = typeof P === 'number' ? +(st >= P) : !showAtVh || showAtVh <= 0 ? 1 : +(st >= getViewportHeightPx() * showAtVh)
    const { fallDistance: f, windFrequency: d } = cfg
    const h = usedTex.current
    h.clear()
    for (const e of s) e.isOneShot || e.dead || !e.hasStarted || h.add(e.textureIndex)
    const x = drawList.current
    x.length = 0
    let E = false
    for (const e of s) {
      if (!(e.isOneShot || c === 1)) continue
      if (!e.hasStarted) {
        if (!(u >= e.emitAt)) continue
        spawn(e, cfg, 'click'); e.hasStarted = true
      }
      if (e.dead) { e.isOneShot && (E = true); continue }
      e.position.y -= e.fallSpeed * l
      const w = Math.sin(u * d + e.windPhase) * e.windAmplitude
      e.position.x += w * l
      e.rotation += e.rotationSpeed * l
      const n = THREE.MathUtils.clamp((e.startY - e.position.y) / f, 0, 1)
      let i = 1
      const enter = cfg.enterDurationRatio ?? 0.05
      if (enter > 0 && n < enter) i = n / enter
      else if (n > 0.9) i = (1 - n) / 0.1
      i = THREE.MathUtils.clamp(i, 0, 1)
      if (e.position.y < e.startY - f) {
        if (e.isOneShot) { e.dead = true; E = true; continue }
        h.delete(e.textureIndex)
        e.textureIndex = pickTexture(atlas.aspects.length, h)
        e.emitAt = Math.max(lastEmit.current, u) + (0.04 + 0.04 * Math.random())
        lastEmit.current = e.emitAt
        e.hasStarted = false
        continue
      }
      e.scale = i
      x.length < 96 ? insertSorted(x, e) : x.push(e)
    }
    if (E) particles.current = capOneShots(s.filter((e) => !e.isOneShot || !e.dead))
    if (x.length > 96) x.sort((a, b) => a.position.z - b.position.z)
    const M = geom.getAttribute('uvRect')
    const Rn = Math.min(x.length, 2048)
    const S = dummy.current
    for (let k = 0; k < Rn; k++) {
      const t = x[k]
      const asp = atlas.aspects[t.textureIndex] ?? 1
      const n = (t.isOneShot ? cfg.clickScale : cfg.scale) * t.scale
      const q = 4 * t.textureIndex
      S.position.copy(t.position)
      S.rotation.set(0, 0, t.rotation)
      S.scale.set(n * asp, n, 1)
      S.updateMatrix()
      o.setMatrixAt(k, S.matrix)
      M.setXYZW(k, atlas.uvRects[q], atlas.uvRects[q + 1], atlas.uvRects[q + 2], atlas.uvRects[q + 3])
    }
    o.count = Rn
    o.visible = Rn > 0
    o.instanceMatrix.needsUpdate = true
    M.needsUpdate = true
  })

  useEffect(() => {
    if (mobile) return
    const el = gl.domElement
    if (!el) return
    let t = null
    const down = (e) => {
      if (e.isPrimary && ((e.pointerType !== 'mouse' && e.pointerType !== 'pen') || e.button === 0)) {
        t = { id: e.pointerId, pointerType: e.pointerType, startX: e.clientX, startY: e.clientY, startAt: e.timeStamp || performance.now(), cancelled: false }
      }
    }
    const move = (e) => {
      if (!t || e.pointerId !== t.id || t.cancelled) return
      const r = e.clientX - t.startX, n = e.clientY - t.startY
      const lim = t.pointerType === 'touch' ? 10 : 4
      r * r + n * n > lim * lim && (t.cancelled = true)
    }
    const up = (r) => {
      const n = t
      if (!n || r.pointerId !== n.id) return
      t = null
      if (n.cancelled || (r.timeStamp || performance.now()) - n.startAt > 600) return
      const sel = window.getSelection()
      if ((sel && !sel.isCollapsed && sel.toString().trim().length > 0) || solid.current) return
      const rect = el.getBoundingClientRect()
      const ix = ((r.clientX - rect.left) / rect.width) * 2 - 1
      const iy = -(((r.clientY - rect.top) / rect.height) * 2 - 1)
      ndc.current.set(ix, iy)
      raycaster.current.setFromCamera(ndc.current, get().camera)
      const hit = new THREE.Vector3()
      if (!raycaster.current.ray.intersectPlane(plane.current, hit)) return
      const p = tmp.current
      p.copy(hit)
      groupRef.current?.worldToLocal(p)
      burst(p)
    }
    const cancel = (e) => { t && e.pointerId === t.id && (t = null) }
    const opts = { capture: true, passive: true }
    window.addEventListener('pointerdown', down, opts)
    window.addEventListener('pointermove', move, opts)
    window.addEventListener('pointerup', up, opts)
    window.addEventListener('pointercancel', cancel, opts)
    return () => {
      window.removeEventListener('pointerdown', down, true)
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
    }
  }, [gl, mobile, burst, get])

  return (
    <group ref={groupRef}>
      {atlas && mat ? <instancedMesh ref={meshRef} args={[geom, mat, 2048]} frustumCulled={false} /> : null}
    </group>
  )
}
