// Track B2 — custom postprocessing passes ported from 4d3f3b68dbbde33a.js:
//   cT = LensFlarePass, cI = pointer trail overlay, cO = FluidPushPass.
import * as THREE from 'three'
import { Pass } from 'postprocessing'
import {
  LENS_FLARE_VERT, LENS_FLARE_FRAG, LENS_FLARE_COMPOSITE_FRAG,
  FLUID_VERT, FLUID_CURL_FRAG, FLUID_VORTICITY_FRAG, FLUID_DIVERGENCE_FRAG, FLUID_CLEAR_FRAG,
  FLUID_PRESSURE_FRAG, FLUID_GRADIENT_FRAG, FLUID_ADVECT_FRAG, FLUID_DISPLAY_FRAG,
} from './b2-shaders.js'

export class LensFlarePass extends Pass {
  flareFrame = 0
  width = 1
  height = 1
  constructor({ flareDownsample: e = 0.5, flareStride: t = 2, starRays: r, intensity: n, threshold: i, streakScale: o, hotspotPower: a, gate: l, tailColor: s, flareFragmentShader: u, compositeFragmentShader: c }) {
    super('LensFlarePass')
    this.flareScale = Math.min(1, Math.max(0.2, e))
    this.flareStride = Math.max(1, Math.floor(t))
    this.flareTarget = new THREE.WebGLRenderTarget(1, 1, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      type: THREE.UnsignedByteType,
      depthBuffer: false,
      stencilBuffer: false,
      generateMipmaps: false,
    })
    this.flareTarget.texture.colorSpace = THREE.LinearSRGBColorSpace
    this.flareTarget.texture.generateMipmaps = false
    this.flareTarget.texture.name = 'LensFlarePass.Target'
    this.flareMaterial = new THREE.ShaderMaterial({
      uniforms: {
        tDiffuse: { value: null },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uEnabled: { value: 1 },
        uStarRays: { value: r },
        uIntensity: { value: n },
        uThreshold: { value: i },
        uStreakScale: { value: o },
        uHotspotPower: { value: a },
        uGate: { value: l },
        uTailColor: { value: new THREE.Color(s) },
      },
      vertexShader: LENS_FLARE_VERT,
      fragmentShader: (u ?? LENS_FLARE_FRAG).replace(/#include\s+<colorspace_fragment>\s*/g, ''),
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
    })
    this.compositeMaterial = new THREE.ShaderMaterial({
      uniforms: { tBase: { value: null }, tFlare: { value: null } },
      vertexShader: LENS_FLARE_VERT,
      fragmentShader: c ?? LENS_FLARE_COMPOSITE_FRAG,
      depthTest: false,
      depthWrite: false,
      transparent: false,
      toneMapped: false,
    })
    this.fullscreenMaterial = this.compositeMaterial
  }
  setParams({ starRays: e, intensity: t, threshold: r, streakScale: n, hotspotPower: i, gate: o, tailColor: a }) {
    const u = this.flareMaterial.uniforms
    u.uStarRays.value = e
    u.uIntensity.value = t
    u.uThreshold.value = r
    u.uStreakScale.value = n
    u.uHotspotPower.value = i
    u.uGate.value = o
    u.uTailColor.value.set(a)
  }
  setFlareDownsample(e) { this.flareScale = Math.min(1, Math.max(0.2, e)); this.resizeFlareTarget() }
  setFlareStride(e) { this.flareStride = Math.max(1, Math.floor(e)) }
  resetFlareCadence() { this.flareFrame = 0 }
  setSize(e, t) {
    this.width = Math.max(1, Math.floor(e))
    this.height = Math.max(1, Math.floor(t))
    this.flareMaterial.uniforms.uResolution.value.set(this.width, this.height)
    this.resizeFlareTarget()
  }
  resizeFlareTarget() {
    const e = Math.max(1, Math.floor(this.width * this.flareScale))
    const t = Math.max(1, Math.floor(this.height * this.flareScale))
    this.flareTarget.setSize(e, t)
    this.resetFlareCadence()
  }
  render(e, t, r) {
    if (!t) return
    if (this.flareFrame % this.flareStride === 0) {
      this.flareMaterial.uniforms.tDiffuse.value = t.texture
      this.fullscreenMaterial = this.flareMaterial
      e.setRenderTarget(this.flareTarget)
      e.clear()
      e.render(this.scene, this.camera)
    }
    this.flareFrame += 1
    this.compositeMaterial.uniforms.tBase.value = t.texture
    this.compositeMaterial.uniforms.tFlare.value = this.flareTarget.texture
    this.fullscreenMaterial = this.compositeMaterial
    e.setRenderTarget(this.renderToScreen ? null : r)
    e.clear()
    e.render(this.scene, this.camera)
  }
  dispose() {
    this.flareTarget.dispose()
    this.flareMaterial.dispose()
    this.compositeMaterial.dispose()
  }
}

export const POINTER_COLOR = '#c0fe04'

class PointerOverlay {
  cssResolution = new THREE.Vector2(1, 1)
  devicePixelRatio = 1
  trail = Array.from({ length: 16 }, () => new THREE.Vector2(0.5, 0.5))
  trailStrength = Array.from({ length: 16 }, () => 0)
  lastPointerCell = new THREE.Vector2(-1, -1)
  pixelSize = 16
  uniforms = {
    uTrail: { value: this.trail },
    uTrailStrength: { value: this.trailStrength },
    uTrailCount: { value: 14 },
    uPointerColor: { value: new THREE.Color(POINTER_COLOR) },
    uPointerOpacity: { value: 1 },
    uPointerDotRadius: { value: 0.8 },
    uPointerPixelSize: { value: this.pixelSize },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uDevicePixelRatio: { value: this.devicePixelRatio },
  }
  setColor(e) { this.uniforms.uPointerColor.value.set(e) }
  setPixelSize(e) { this.pixelSize = e; this.uniforms.uPointerPixelSize.value = e }
  setDisplayMetrics(e, t, r) {
    this.cssResolution.set(Math.max(1, e), Math.max(1, t))
    this.devicePixelRatio = Math.max(1, r)
    this.uniforms.uDevicePixelRatio.value = this.devicePixelRatio
  }
  setResolution(e, t) { this.uniforms.uResolution.value.set(Math.max(1, e), Math.max(1, t)) }
  updatePointer(e, t, r) {
    const n = Math.max(this.pixelSize / Math.max(this.cssResolution.x, 1), 1e-6)
    const i = Math.max(this.pixelSize / Math.max(this.cssResolution.y, 1), 1e-6)
    for (let k = +!!t; k < 14; k += 1) this.trailStrength[k] = THREE.MathUtils.damp(this.trailStrength[k], 0, 2, r)
    if (t) {
      const cx = Math.floor(e.x / n)
      const cy = Math.floor(e.y / i)
      if (cx !== this.lastPointerCell.x || cy !== this.lastPointerCell.y) {
        for (let k = 13; k > 0; k -= 1) {
          this.trail[k].copy(this.trail[k - 1])
          this.trailStrength[k] = this.trailStrength[k - 1]
        }
        this.lastPointerCell.set(cx, cy)
      }
      this.trail[0].set(e.x, e.y)
      this.trailStrength[0] = 1
      return
    }
    this.lastPointerCell.set(-1, -1)
  }
}

function makeTarget(e, t) {
  return new THREE.WebGLRenderTarget(e, t, {
    depthBuffer: false,
    stencilBuffer: false,
    minFilter: THREE.LinearFilter,
    magFilter: THREE.LinearFilter,
    format: THREE.RGBAFormat,
    type: THREE.HalfFloatType,
  })
}
function makeMaterial(frag, uniforms) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader: FLUID_VERT,
    fragmentShader: frag,
    depthTest: false,
    depthWrite: false,
    transparent: false,
    toneMapped: false,
  })
}

export class FluidPushPass extends Pass {
  simWidth = 1
  simHeight = 1
  viewportWidth = 1
  viewportHeight = 1
  effectEnabled = true
  pointerOverlayEnabled = true
  resolution = new THREE.Vector2(1, 1)
  pointerOverlay = new PointerOverlay()
  pointer = new THREE.Vector2(-1, -1)
  pointerDelta = new THREE.Vector2(0, 0)
  velocityRead = makeTarget(1, 1)
  velocityWrite = makeTarget(1, 1)
  curlTarget = makeTarget(1, 1)
  vortTarget = makeTarget(1, 1)
  divergenceTarget = makeTarget(1, 1)
  pressureA = makeTarget(1, 1)
  pressureB = makeTarget(1, 1)
  projectedVelocityTarget = makeTarget(1, 1)
  constructor({ strength: e = 0.3, radius: t = 1.5, velocityScale: r = 1, chromaticStrength: n = 0.002, pressureIterations: i = 4, curlStrength: o = 0, velocityDissipation: a = 3, simResolution: l = 160 } = {}) {
    super('FluidPushPass')
    this.simResolution = l
    this.pressureIterations = i
    const s = new THREE.Vector2(1, 1)
    const u = new THREE.Vector2(1, 1)
    this.curlMaterial = makeMaterial(FLUID_CURL_FRAG, { uVelocity: { value: null }, uTexelSize: { value: s.clone() } })
    this.vorticityMaterial = makeMaterial(FLUID_VORTICITY_FRAG, {
      uVelocity: { value: null },
      uCurl: { value: null },
      uTexelSize: { value: s.clone() },
      uResolution: { value: u.clone() },
      uPointer: { value: this.pointer },
      uPointerDelta: { value: this.pointerDelta },
      uCurlStrength: { value: o },
      uSplatRadius: { value: Math.max(0.002 * t, 5e-4) },
      uSplatForce: { value: Math.max(3e3 * r, 0) },
    })
    this.divergenceMaterial = makeMaterial(FLUID_DIVERGENCE_FRAG, { uVelocity: { value: null }, uTexelSize: { value: s.clone() } })
    this.clearMaterial = makeMaterial(FLUID_CLEAR_FRAG, {})
    this.pressureMaterial = makeMaterial(FLUID_PRESSURE_FRAG, { uPressure: { value: null }, uDivergence: { value: null }, uTexelSize: { value: s.clone() } })
    this.gradientMaterial = makeMaterial(FLUID_GRADIENT_FRAG, { uVelocity: { value: null }, uPressure: { value: null }, uTexelSize: { value: s.clone() } })
    this.advectMaterial = makeMaterial(FLUID_ADVECT_FRAG, { uVelocity: { value: null }, uProjectedVelocity: { value: null }, uTexelSize: { value: s.clone() }, uDissipation: { value: a } })
    this.displayMaterial = makeMaterial(FLUID_DISPLAY_FRAG, {
      tDiffuse: { value: null },
      uVelocity: { value: null },
      uSimSize: { value: new THREE.Vector2(l, l) },
      uDisplacementStrength: { value: Math.max(e / 0.3, 0) },
      uChromaticBoost: { value: Math.max(n / 0.004, 0) },
      uEffectEnabled: { value: 1 },
      ...this.pointerOverlay.uniforms,
    })
    this.fullscreenMaterial = this.displayMaterial
  }
  setEffectEnabled(e) { this.effectEnabled = e; this.displayMaterial.uniforms.uEffectEnabled.value = +!!e }
  setPointerOverlayEnabled(e) { this.pointerOverlayEnabled = e; this.displayMaterial.uniforms.uPointerOpacity.value = 1 * !!e }
  setPointerColor(e) { this.pointerOverlay.setColor(e) }
  setPointerPixelSize(e) {
    this.pointerOverlay.setPixelSize(e)
    this.pointerOverlayEnabled && (this.displayMaterial.uniforms.uPointerOpacity.value = 1)
  }
  setDisplayMetrics(e, t, r) { this.pointerOverlay.setDisplayMetrics(e, t, r) }
  updatePointer(e, t, r) { this.pointerOverlay.updatePointer(e, t, r) }
  setPointer(e) { this.pointer.copy(e) }
  setPointerDelta(e) { this.pointerDelta.copy(e) }
  setSize(e, t) {
    this.viewportWidth = Math.max(1, e)
    this.viewportHeight = Math.max(1, t)
    const r = this.simResolution
    const n = this.viewportWidth / this.viewportHeight
    if (n > 1) { this.simWidth = Math.round(r * n); this.simHeight = r } else { this.simWidth = r; this.simHeight = Math.round(r / Math.max(n, 1e-4)) }
    for (const rt of [this.velocityRead, this.velocityWrite, this.curlTarget, this.vortTarget, this.divergenceTarget, this.pressureA, this.pressureB, this.projectedVelocityTarget]) this.resizeRenderTarget(rt)
    const i = 1 / this.simWidth
    const o = 1 / this.simHeight
    const a = new THREE.Vector2(this.viewportWidth, this.viewportHeight)
    const l = new THREE.Vector2(this.simWidth, this.simHeight)
    this.resolution.copy(a)
    this.pointerOverlay.setResolution(this.viewportWidth, this.viewportHeight)
    for (const m of [this.curlMaterial, this.vorticityMaterial, this.divergenceMaterial, this.pressureMaterial, this.gradientMaterial, this.advectMaterial]) {
      m.uniforms.uTexelSize && m.uniforms.uTexelSize.value.set(i, o)
    }
    this.vorticityMaterial.uniforms.uResolution.value.copy(a)
    this.displayMaterial.uniforms.uSimSize.value.copy(l)
  }
  render(e, t, r) {
    if (!t) return
    const n = e.getRenderTarget()
    if (this.effectEnabled) {
      this.curlMaterial.uniforms.uVelocity.value = this.velocityRead.texture
      this.renderMaterial(e, this.curlMaterial, this.curlTarget)
      this.vorticityMaterial.uniforms.uVelocity.value = this.velocityRead.texture
      this.vorticityMaterial.uniforms.uCurl.value = this.curlTarget.texture
      this.renderMaterial(e, this.vorticityMaterial, this.vortTarget)
      this.divergenceMaterial.uniforms.uVelocity.value = this.vortTarget.texture
      this.renderMaterial(e, this.divergenceMaterial, this.divergenceTarget)
      this.renderMaterial(e, this.clearMaterial, this.pressureA)
      let pa = this.pressureA
      let pb = this.pressureB
      for (let k = 0; k < this.pressureIterations; k += 1) {
        this.pressureMaterial.uniforms.uPressure.value = pa.texture
        this.pressureMaterial.uniforms.uDivergence.value = this.divergenceTarget.texture
        this.renderMaterial(e, this.pressureMaterial, pb)
        const tmp = pa
        pa = pb
        pb = tmp
      }
      this.gradientMaterial.uniforms.uVelocity.value = this.vortTarget.texture
      this.gradientMaterial.uniforms.uPressure.value = pa.texture
      this.renderMaterial(e, this.gradientMaterial, this.projectedVelocityTarget)
      this.advectMaterial.uniforms.uVelocity.value = this.velocityRead.texture
      this.advectMaterial.uniforms.uProjectedVelocity.value = this.projectedVelocityTarget.texture
      this.renderMaterial(e, this.advectMaterial, this.velocityWrite)
      this.swapVelocityTargets()
    }
    this.displayMaterial.uniforms.tDiffuse.value = t.texture
    this.displayMaterial.uniforms.uVelocity.value = this.velocityRead.texture
    this.fullscreenMaterial = this.displayMaterial
    e.setRenderTarget(this.renderToScreen ? null : r)
    e.clear()
    e.render(this.scene, this.camera)
    e.setRenderTarget(n)
  }
  dispose() {
    for (const rt of [this.velocityRead, this.velocityWrite, this.curlTarget, this.vortTarget, this.divergenceTarget, this.pressureA, this.pressureB, this.projectedVelocityTarget]) rt.dispose()
    for (const m of [this.curlMaterial, this.vorticityMaterial, this.divergenceMaterial, this.clearMaterial, this.pressureMaterial, this.gradientMaterial, this.advectMaterial, this.displayMaterial]) m.dispose()
  }
  renderMaterial(e, t, r) {
    this.fullscreenMaterial = t
    e.setRenderTarget(r)
    e.clear()
    e.render(this.scene, this.camera)
  }
  resizeRenderTarget(e) { e.setSize(this.simWidth, this.simHeight) }
  swapVelocityTargets() {
    const e = this.velocityRead
    this.velocityRead = this.velocityWrite
    this.velocityWrite = e
  }
}
