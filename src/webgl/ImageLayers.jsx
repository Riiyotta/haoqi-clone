// Track B2 — DOM-synced image layers (orig `cz` rect tracker + `cE`/`cw` layer, 4d3f3b68dbbde33a.js ~17940–18220).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { scrollStore, loadStore } from '../lib/shared.js'
import { useIsMobileWidth } from './hooks.js'
import { WORK_ITEMS } from '../lib/workItems.js'
import { IMAGE_LAYER_VERT, IMAGE_LAYER_FRAG } from './b2-shaders.js'
import { easeInOutCubic, usePrefersReducedMotion } from './b2-shared.js'

const ABOUT_URL = '/img/m3.png'
const getScrollTopPx = () => scrollStore.get().scrollTop || 0
const getViewportHeightPx = () => scrollStore.get().viewportHeight || window.innerHeight

// ---------- placeholder discovery ----------
function findPlaceholders() {
  const out = {}
  const about = document.querySelector('[data-about-image]')
    || document.querySelector('.aspect-square')
  if (about) out.about = about
  const tagged = document.querySelectorAll('[data-work-image]')
  if (tagged.length) {
    tagged.forEach((el) => { out[el.getAttribute('data-work-image')] = el })
  } else {
    const els = document.querySelectorAll('section#selected-work article a > div[aria-hidden]')
    els.forEach((el, i) => {
      const href = el.parentElement?.getAttribute('href')
      const item = WORK_ITEMS.find((w) => w.href === href) ?? WORK_ITEMS[i]
      if (item) out[item.href] = el
    })
  }
  return out
}

// ---------- texture loading (orig s3 = drei-style useTexture via useLoader cache) ----------
const texCache = new Map()
const loader = new THREE.TextureLoader()
function loadTexture(url) {
  let p = texCache.get(url)
  if (!p) {
    p = new Promise((res, rej) => loader.load(url, res, undefined, rej))
    texCache.set(url, p)
  }
  return p
}
// orig cB(texture, gl, isMobile, hasHover)
function configureTexture(e, t, r, n) {
  e.colorSpace = THREE.SRGBColorSpace
  e.needsUpdate = true
  e.wrapS = THREE.ClampToEdgeWrapping
  e.wrapT = THREE.ClampToEdgeWrapping
  if (n) { e.generateMipmaps = false; e.minFilter = THREE.LinearFilter } else e.minFilter = THREE.LinearMipmapLinearFilter
  e.magFilter = THREE.LinearFilter
  const i = t.capabilities.getMaxAnisotropy?.() ?? 1
  e.anisotropy = r ? Math.min(4, i) : Math.min(8, i)
}

// ---------- rect tracker (orig `cz`, useFrame priority -3) ----------
function RectTracker({ layers, targetRectMapRef }) {
  const frame = useRef(0)
  const last = useRef({ top: getScrollTopPx(), left: 0 })
  useFrame(() => {
    const i = frame.current++
    const o = getScrollTopPx()
    const a = 0
    const l = o - last.current.top
    const s = a - last.current.left
    last.current.top = o
    last.current.left = a
    const u = targetRectMapRef.current
    if (l !== 0 || s !== 0) {
      for (const e of Object.values(u)) { e.top -= l; e.bottom -= l; e.left -= s; e.right -= s }
    }
    const c = getViewportHeightPx()
    for (let t = 0; t < layers.length; t++) {
      const r = layers[t]
      const n = r.targetRef.current
      if (!n) continue
      const ob = u[r.key]
      const margin = Math.max(1.5 * c, 600)
      const near = !ob || (ob.bottom > -margin && ob.top < c + margin)
      const due = i % 12 === t % 12
      if (!near && !due) continue
      const f = n.getBoundingClientRect()
      if (ob) {
        ob.left = f.left; ob.top = f.top; ob.width = f.width; ob.height = f.height; ob.right = f.right; ob.bottom = f.bottom
        continue
      }
      u[r.key] = { left: f.left, top: f.top, width: f.width, height: f.height, right: f.right, bottom: f.bottom }
    }
  }, -3)
  return null
}

// ---------- single layer (orig `cE`) ----------
function ImageLayer({ ready: e = true, imageUrl: t, hoverImageUrl: r, targetRef: n, layerKey: i, getTargetRect: o, onTextureReady: a }) {
  const f = useRef(null)
  const d = useRef(a)
  d.current = a
  const h = useRef(false) // hovered
  const p = useRef(false) // hover texture ready
  const m = useRef(0) // hover progress
  const g = useIsMobileWidth()
  const v = usePrefersReducedMotion()
  const A = useRef(0) // polarity progress
  const lastScroll = useRef(null)
  const curlSmooth = useRef(0)
  const y = useCallback((dt) => {
    const tt = Math.max(1 / 240, Math.min(dt, 0.1))
    const rr = getScrollTopPx()
    const nn = lastScroll.current
    lastScroll.current = rr
    const ii = nn == null ? 0 : Math.abs(rr - nn) / tt
    const oo = THREE.MathUtils.clamp(ii / 800, 0, 1)
    const aa = curlSmooth.current
    const ss = 1 - Math.exp(-tt / Math.max(oo > aa ? 0.025 : 0.175, 1e-4))
    const uu = aa + (oo - aa) * ss
    curlSmooth.current = uu
    return 0.06 * uu
  }, [])
  const b = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      map: { value: null },
      mapHover: { value: null },
      uRect: { value: new THREE.Vector4(0, 0, 1, 1) },
      uCurlStrength: { value: 0 },
      uPolarityPositive: { value: 0 },
      uLayerOpacity: { value: 1 },
      uRevealProgress: { value: 1 },
      uRevealSoftness: { value: 0 },
      uRevealDirection: { value: 1 },
      uHoverRevealProgress: { value: 0 },
      uDotPixelSize: { value: 18 },
      uViewportPx: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: IMAGE_LAYER_VERT,
    fragmentShader: IMAGE_LAYER_FRAG,
    transparent: true,
    toneMapped: false,
    depthTest: false,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
    alphaToCoverage: false,
  }), [])
  const x = !!r
  const C = useThree((s) => s.size)
  const B = useThree((s) => s.gl)
  const E = useMemo(() => new THREE.PlaneGeometry(2, 2), [])
  useEffect(() => () => E.dispose(), [E])

  // textures [imageUrl, hoverImageUrl ?? imageUrl]
  const [texs, setTexs] = useState([null, null])
  useEffect(() => {
    let alive = true
    Promise.all([loadTexture(t), loadTexture(r ?? t)]).then(([w, M]) => {
      if (!alive) return
      if ('initTexture' in B) { B.initTexture(w); if (M !== w) B.initTexture(M) }
      setTexs([w, M])
    }).catch((err) => console.warn('[ImageLayers] texture failed', t, err))
    return () => { alive = false }
  }, [t, r, B])
  const [w, M] = texs

  // hover listeners on the placeholder's parent (<a>)
  useLayoutEffect(() => {
    if (!x) { h.current = false; return }
    let dead = false
    let timer = 0
    let host = null
    let cleanup = null
    let tries = 0
    const attach = () => {
      if (dead) return
      const l = n.current?.parentElement
      if (!l) { tries++ < 120 && (timer = window.setTimeout(attach, 50)); return }
      if (host === l && cleanup) return
      cleanup?.()
      host = l
      let moveOff = null
      const stopMove = () => { moveOff?.(); moveOff = null }
      const onEnter = () => { h.current = true; stopMove() }
      const onLeave = (ev) => {
        if (ev.pointerType === 'mouse') {
          const rc = l.getBoundingClientRect()
          if (ev.clientX >= rc.left && ev.clientX <= rc.right && ev.clientY >= rc.top && ev.clientY <= rc.bottom) {
            if (moveOff) return
            const onMove = (mv) => {
              if (mv.pointerType !== 'mouse') return
              const q = l.getBoundingClientRect()
              if (!(mv.clientX >= q.left && mv.clientX <= q.right && mv.clientY >= q.top && mv.clientY <= q.bottom)) { h.current = false; stopMove() }
            }
            window.addEventListener('pointermove', onMove, { passive: true })
            moveOff = () => window.removeEventListener('pointermove', onMove)
            return
          }
        }
        h.current = false
      }
      const onFocusIn = () => { h.current = true }
      const onFocusOut = (ev) => { l.contains(ev.relatedTarget) || (h.current = false) }
      l.addEventListener('pointerenter', onEnter)
      l.addEventListener('pointerleave', onLeave)
      l.addEventListener('focusin', onFocusIn)
      l.addEventListener('focusout', onFocusOut)
      cleanup = () => {
        l.removeEventListener('pointerenter', onEnter)
        l.removeEventListener('pointerleave', onLeave)
        l.removeEventListener('focusin', onFocusIn)
        l.removeEventListener('focusout', onFocusOut)
        stopMove()
        cleanup = null
        host = null
      }
    }
    const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(() => attach()) : null
    mo?.observe(document.body, { childList: true, subtree: true })
    attach()
    return () => { dead = true; window.clearTimeout(timer); mo?.disconnect(); cleanup?.(); h.current = false }
  }, [x, n])

  useEffect(() => {
    if (!w) return
    configureTexture(w, B, g, x)
    M && configureTexture(M, B, g, x)
    b.uniforms.map.value = w
    b.uniforms.mapHover.value = w
    b.uniforms.uLayerOpacity.value = 1
    b.uniforms.uRevealProgress.value = 1
    b.uniforms.uRevealSoftness.value = 0
    b.uniforms.uRevealDirection.value = 1
    b.uniforms.mapHover.value = M ?? w
    b.uniforms.uHoverRevealProgress.value = 0
    m.current = 0
    p.current = !!M || !r
    d.current?.()
  }, [w, x, r, M, g, B, b])
  useEffect(() => () => b.dispose(), [b])

  useFrame((_, delta) => {
    const hide = () => {
      f.current && (f.current.visible = false)
      A.current = 0
      b.uniforms.uPolarityPositive.value = 0
    }
    const c = o(i)
    const hasMap = !!b.uniforms.map.value
    const gH = Math.max(1, C.height)
    const gW = Math.max(1, C.width)
    if (!e || !hasMap || !c) return void hide()
    const Ew = c.width
    const Wh = c.height
    if (Ew <= 0 || Wh <= 0) return void hide()
    const Mm = 0.25 * gH
    const R = c.bottom > -Mm && c.top < gH + Mm
    const S = c.bottom < -(2 * gH) || c.top > 3 * gH
    if (!R || S) return void hide()
    const T = Math.min(delta, 0.1) / 0.42
    const D = r != null && h.current && p.current ? 1 : 0
    const F = m.current
    let I = F
    if (D) { (I = Math.min(1, F + T)) > 0.999 && (I = 1) } else { (I = Math.max(0, F - T)) < 0.001 && (I = 0) }
    m.current = I
    f.current && (f.current.visible = true)
    const P = y(delta)
    b.uniforms.uLayerOpacity.value = 1
    b.uniforms.uHoverRevealProgress.value = x ? 0.5 - 0.5 * Math.cos(Math.PI * THREE.MathUtils.clamp(m.current, 0, 1)) : 0
    b.uniforms.uViewportPx.value.set(gW, gH)
    let G
    if (c.right <= 0 || c.left >= gW || c.bottom <= 0 || c.top >= gH) { A.current = 0; G = 0 }
    else if (v) { A.current = 1; G = 1 }
    else { A.current = Math.min(1, A.current + delta / 0.8); G = easeInOutCubic(A.current) }
    b.uniforms.uRect.value.set(c.left / gW, 1 - (c.top + Wh) / gH, Ew / gW, Wh / gH)
    b.uniforms.uCurlStrength.value = P
    b.uniforms.uPolarityPositive.value = G
  })

  return <mesh ref={f} geometry={E} renderOrder={20} frustumCulled={false} material={b} visible={false} />
}

// ---------- root ----------
const subscribeLoad = (fn) => loadStore.subscribe(fn)
export default function ImageLayers() {
  // stable per-key target refs; elements resolved from the DOM (Track A placeholders)
  const refsByKey = useRef({})
  const [keys, setKeys] = useState([])
  useEffect(() => {
    let raf = 0
    const scan = () => {
      raf = 0
      const found = findPlaceholders()
      let changed = false
      for (const [k, el] of Object.entries(found)) {
        const ref = refsByKey.current[k] || (refsByKey.current[k] = { current: null })
        if (ref.current !== el) { ref.current = el; changed = true }
      }
      for (const [k, ref] of Object.entries(refsByKey.current)) {
        if (!found[k] && ref.current && !ref.current.isConnected) { ref.current = null; changed = true }
      }
      if (changed) {
        const order = ['about', ...WORK_ITEMS.map((w) => w.href)].filter((k) => refsByKey.current[k])
        setKeys((prev) => (prev.join('|') === order.join('|') ? prev : order))
      }
    }
    scan()
    const mo = new MutationObserver(() => { if (!raf) raf = requestAnimationFrame(scan) })
    mo.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-work-image', 'data-about-image'] })
    return () => { mo.disconnect(); cancelAnimationFrame(raf) }
  }, [])

  const layers = useMemo(() => keys.map((k) => {
    if (k === 'about') return { key: 'about', imageUrl: ABOUT_URL, targetRef: refsByKey.current.about }
    const it = WORK_ITEMS.find((w) => w.href === k)
    return { key: k, imageUrl: it.imageUrl, hoverImageUrl: it.hoverImageUrl, targetRef: refsByKey.current[k] }
  }), [keys])

  const rectMapRef = useRef({})
  const getTargetRect = useCallback((k) => rectMapRef.current[k] ?? null, [])
  const tracked = useMemo(() => layers.map((l) => ({ key: l.key, targetRef: l.targetRef })), [layers])

  const [loadedKeys, setLoadedKeys] = useState({})
  const onReady = useCallback((k) => setLoadedKeys((s) => (s[k] ? s : { ...s, [k]: true })), [])
  const texLoaded = layers.reduce((n, l) => (loadedKeys[l.key] ? n + 1 : n), 0)
  useEffect(() => { loadStore.set({ texTotal: layers.length, texLoaded }) }, [layers.length, texLoaded])

  // orig `p` = all models ready && all layer textures ready
  const modelsReady = useSyncExternalStore(subscribeLoad, () => {
    const s = loadStore.get()
    return s.modelsLoaded >= s.modelsTotal
  })
  const ready = modelsReady && (layers.length === 0 || texLoaded >= layers.length)

  return (
    <>
      <RectTracker layers={tracked} targetRectMapRef={rectMapRef} />
      {layers.map((l) => (
        <ImageLayer
          key={l.key}
          ready={ready}
          imageUrl={l.imageUrl}
          hoverImageUrl={l.hoverImageUrl}
          targetRef={l.targetRef}
          layerKey={l.key}
          getTargetRect={getTargetRect}
          onTextureReady={() => onReady(l.key)}
        />
      ))}
    </>
  )
}
