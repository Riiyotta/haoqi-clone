// Hyper-space giant cursor — port of orig cx / cC (4d3f3b68 ~17583-17939).
import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { arrowStore } from '../lib/shared.js'
import { HYPER_VERT, HYPER_FRAG } from './b1-shaders.js'
import { useMergedGeometry, useGlassSystem, themedGlassParams, createLightOrbit } from './Glass.jsx'
import { getScrollTopPx, getScrollLeftPx, pointer } from './sectionEnv.js'
import { useTheme, useIsMobileWidth } from './hooks.js'

const ACCENT = '#009dff'
const STRIPE_A = '#009dff'
const STRIPE_B = '#64c3ff'
const TILT = [0, 0, 45]

// orig arrowFullscreenProgressStore semantics
let damped = 0
function setDampedScaleT(t) {
  const e = Math.min(1, Math.max(0, t))
  if (Math.abs(e - damped) <= 0.001) return
  damped = e
  arrowStore.set({ dampedScaleT: e })
}
function resetArrow() {
  if (damped !== 0) { damped = 0; arrowStore.set({ dampedScaleT: 0 }) }
}

function HyperCursorInner({
  model = '/model/cursor.glb', targetRef, getTargetRect, refMarginPx: n = 120, accentColor = ACCENT, stripeColorA = STRIPE_A, stripeColorB = STRIPE_B,
  restScale: l = 0.1, scaleSmoothing: c = 32, maxScale: f, autoPeakPadding: d = 1.64, modelPosition: h = [0, 0, 0], rotationAxisTilt: p = TILT, scaleSpinDegrees: m = 360,
}) {
  const A = useMergedGeometry(model)
  useEffect(() => () => { A?.dispose() }, [A])
  const outer = useRef(null)
  const spin = useRef(null)
  const meshRef = useRef(null)
  const matRef = useRef(null)
  const { size: B, gl: E, camera: w } = useThree()
  const theme = useTheme()
  const { controls: T } = useGlassSystem()
  const D = useMemo(() => themedGlassParams(T, theme), [T, theme])
  const mobile = useIsMobileWidth()
  const orbit = useMemo(() => createLightOrbit(), [])
  const P = useMemo(() => new THREE.Vector3(), [])
  const k = useRef(l)
  const O = useRef(false)
  const G = useRef(null)
  const L = useRef(null)
  const H = useRef({ top: 0, left: 0 })
  const _ = useRef(0)
  const j = useRef('')
  useEffect(() => {
    const e = () => { G.current = null; L.current = null; j.current = '' }
    window.addEventListener('resize', e)
    window.addEventListener('orientationchange', e)
    const vv = window.visualViewport
    vv?.addEventListener('resize', e)
    let r = null
    if (typeof ResizeObserver !== 'undefined') {
      r = new ResizeObserver(e)
      r.observe(E.domElement)
      const t = E.domElement.parentElement
      t && r.observe(t)
    }
    return () => {
      window.removeEventListener('resize', e)
      window.removeEventListener('orientationchange', e)
      vv?.removeEventListener('resize', e)
      r?.disconnect()
    }
  }, [E])
  const U = useMemo(() => (A ? (A.computeBoundingSphere(), { radius: Math.max(A.boundingSphere?.radius ?? 1, 1e-4) }) : null), [A])
  const deg = useCallback((e) => THREE.MathUtils.degToRad(e), [])
  const J = useMemo(() => [deg(p[0]), deg(p[1]), deg(p[2])], [p, deg])
  const K = useMemo(() => [-J[0], -J[1], -J[2]], [J])
  const $ = useMemo(() => THREE.MathUtils.degToRad(m), [m])
  const restScaleArr = useMemo(() => [l, l, l], [l])
  const z = useMemo(() => ({
    iResolution: { value: new THREE.Vector3(1, 1, 1) },
    iTime: { value: 0 },
    uScrollDuration: { value: 2 },
    uOpacity: { value: 1 },
    uAccentColor: { value: new THREE.Color(ACCENT) },
    uStripeColorA: { value: new THREE.Color(STRIPE_A) },
    uStripeColorB: { value: new THREE.Color(STRIPE_B) },
    uStripeReveal: { value: 0 },
    uLight: { value: new THREE.Vector3(4, 9, 0.5) },
    uShininess: { value: 40 },
    uDiffuseness: { value: 0.1 },
    uSpecularStrength: { value: 1.2 },
    uFresnelPower: { value: 6 },
    uFresnelStrength: { value: 1 },
    uFresnelSideDir: { value: new THREE.Vector3(-1, 0.3, 1) },
  }), [])
  useLayoutEffect(() => {
    const e = matRef.current?.uniforms
    if (!e) return
    e.uDiffuseness.value = D.diffuseness
    e.uShininess.value = D.shininess
    e.uFresnelPower.value = D.fresnelPower
    e.uSpecularStrength.value = D.specularStrength
    e.uFresnelStrength.value = D.fresnelStrength
    e.uFresnelSideDir.value.set(...D.fresnelSideDir)
  }, [D, A])
  useEffect(() => {
    const e = matRef.current?.uniforms
    if (!e) return
    e.uAccentColor.value.set(accentColor)
    e.uStripeColorA.value.set(stripeColorA)
    e.uStripeColorB.value.set(stripeColorB)
  }, [accentColor, stripeColorA, stripeColorB, A])
  useEffect(() => () => resetArrow(), [])

  useFrame((state, delta) => {
    const zg = outer.current
    const V = meshRef.current
    const W = matRef.current?.uniforms
    if (!zg || !V || !U || !W) return
    const [Y, Q, X] = h
    const Z = Math.max(1, E.getPixelRatio())
    const q = E.domElement.getBoundingClientRect()
    const ee = window.visualViewport ? window.visualViewport : null
    const et = [
      Math.round(q.top), Math.round(q.left), Math.round(q.width), Math.round(q.height), Z,
      Math.round(B.width), Math.round(B.height),
      ee ? Math.round(100 * ee.height) / 100 : -1,
      ee ? Math.round(100 * ee.offsetTop) / 100 : -1,
      ee ? Math.round(1e3 * ee.scale) / 1e3 : -1,
    ].join('|')
    if (et !== j.current) { j.current = et; L.current = null; G.current = null }
    if (!L.current) {
      const o = B.height
      const mm = E.domElement.getBoundingClientRect()
      const g = Math.max(1, mm.height > 0 ? mm.height : o)
      const v = mm.height > 0 ? mm.top : 0
      const a = mm.height > 0 ? mm.bottom : v + g
      L.current = { cssH: g, topY: v, bottomY: a }
    }
    const { cssH: er, topY: en, bottomY: ei } = L.current
    const eo = Math.max(1, B.width)
    const ea = targetRef?.current
    const el = getScrollTopPx()
    const es = getScrollLeftPx()
    let eu = null
    if (ea) {
      const fr = _.current++
      if (G.current && fr % 12 !== 0) {
        const dy = el - H.current.top
        const dx = es - H.current.left
        H.current.top = el
        H.current.left = es
        if ((dy !== 0 || dx !== 0) && G.current) {
          const r = G.current
          r.top -= dy; r.bottom -= dy; r.left -= dx; r.right -= dx
        }
      } else {
        const e = ea.getBoundingClientRect()
        G.current = { left: e.left, top: e.top, width: e.width, height: e.height, right: e.right, bottom: e.bottom }
        H.current = { top: el, left: es }
      }
      eu = G.current
    } else {
      G.current = null
      eu = getTargetRect ? getTargetRect() : null
    }
    if (!(ea && eu && eu.width > 0 && eu.height > 0) || !eu) { zg.visible = false; resetArrow(); return }
    const ec = Math.max(2 * n, 480)
    const ef = en + 0.5 * er
    const ed = state.viewport.getCurrentViewport(w, P.set(Y, Q, X))
    // shrink phase
    const S = Math.max(1, er)
    const Dd = ef + n - eu.height
    const N = Math.min(ei, Dd + S)
    const eh = {
      shrinkT: eu.top <= Dd ? 1 : eu.top >= N ? 0 : 1 - THREE.MathUtils.smoothstep(eu.top, Dd, N),
      beforeShrink: eu.top > N,
      shrinking: eu.top <= N && eu.top > Dd,
    }
    const ep = Math.min(0.35 * er, ((U.radius * l * er) / Math.max(ed.height, 1e-4)) * 0.45)
    const em = eu.bottom < -ep
    const eg = eu.top < ei + ec && eu.bottom > -(6 * n) && !em
    zg.visible = eg
    if (!eg) { resetArrow(); return }
    const ev = Math.max(1, B.height)
    W.iResolution.value.set(eo * Z, ev * Z, 1)
    const Jt = Math.max(1, ei - -eu.height)
    W.iTime.value = 2 * THREE.MathUtils.clamp((ei - eu.top) / Jt, 0, 1)
    const Kh = Math.max(1, er)
    const eA = THREE.MathUtils.smoothstep(THREE.MathUtils.clamp((ef - (eu.top + n)) / Kh, 0, 1), 0, 1)
    const ey = eu.top + n
    const eb = eu.bottom - n
    const ex = ((eh.beforeShrink ? Math.max(ef, ey) : eh.shrinking ? ef : Math.min(ef, eb)) - en) / er
    zg.position.set(Y, (0.5 - ex) * ed.height + Q, X)
    const eC = (Math.hypot(ed.width, ed.height) * d) / U.radius
    const eB = f ?? eC
    const eE = THREE.MathUtils.lerp(l, eB, eA)
    const ew = eh.beforeShrink ? eE : eh.shrinking ? THREE.MathUtils.lerp(eE, l, eh.shrinkT) : l
    let ps
    if (c <= 0) { ps = ew; k.current = ew }
    else if (O.current) { k.current = THREE.MathUtils.damp(k.current, ew, c, delta); ps = k.current }
    else { O.current = true; ps = ew; k.current = ew }
    V.scale.setScalar(ps)
    const eM = Math.max(eB - l, 1e-6)
    const eR = THREE.MathUtils.clamp((ps - l) / eM, 0, 1)
    W.uStripeReveal.value = eR
    setDampedScaleT(eR)
    let eS = 0
    if (eh.shrinking) eS = $ + THREE.MathUtils.clamp((eh.shrinkT - 0.6) / 0.4, 0, 1) * $
    else if (eh.beforeShrink) eS = THREE.MathUtils.clamp(eR / 0.4, 0, 1) * $
    const eT = spin.current
    if (eT) { eT.rotation.x = 0; eT.rotation.y = eS; eT.rotation.z = 0 }
    const { x: eD, y: eF } = orbit.update({ uv: pointer.uv, inside: pointer.insideRef.current && !mobile, camera: w, delta })
    W.uLight.value.set(eD, eF, T.lightZ)
  }, -2)

  if (!A) return null
  return (
    <group ref={outer} visible={false}>
      <group rotation={J}>
        <group ref={spin}>
          <group rotation={K}>
            <mesh ref={meshRef} geometry={A} renderOrder={12} frustumCulled={false} scale={restScaleArr}>
              <shaderMaterial ref={matRef} vertexShader={HYPER_VERT} fragmentShader={HYPER_FRAG} uniforms={z} transparent depthWrite={false} depthTest toneMapped={false} side={THREE.FrontSide} />
            </mesh>
          </group>
        </group>
      </group>
    </group>
  )
}

export default function HyperCursor(props) {
  return (
    <Suspense fallback={null}>
      <HyperCursorInner {...props} />
    </Suspense>
  )
}
