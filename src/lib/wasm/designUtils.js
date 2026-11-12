// Port of the inlined @wenhaoqi/wasm_design_utils@0.2.0 runtime + the zoom-backdrop colour logic from the original
// MdxImg module (4d1355f59cfb8a8f.js, module 46318). Same WASM binaries (base64 copied verbatim), same imports,
// same sampling/sorting, same OKLCH clamp. WASM is only instantiated on first image hover/zoom.
import { EXTRACT_COLORS_WASM_B64, OKLCH2RGB_WASM_B64, RGB2OKLCH_WASM_B64 } from './blobs.js'

function b64ToBytes(A) {
  const e = atob(A)
  const t = new Uint8Array(e.length)
  for (let i = 0; i < e.length; i++) t[i] = e.charCodeAt(i)
  return t
}
async function instantiate(base64, imports) {
  const { instance } = await WebAssembly.instantiate(b64ToBytes(base64), imports)
  return instance
}

// orig `I`: emscripten-style WASI shim for the colour modules
function wasiImports({ initialPages = 256, maximumPages = 16384 } = {}) {
  const mem = new WebAssembly.Memory({ initial: initialPages, maximum: maximumPages })
  const zero = () => 0
  const sizes = (a, b) => { try { const dv = new DataView(mem.buffer); dv.setUint32(a >>> 0, 0, true); dv.setUint32(b >>> 0, 0, true) } catch {} return 0 }
  return {
    wasi_snapshot_preview1: {
      args_get: zero,
      args_sizes_get: sizes,
      environ_get: zero,
      environ_sizes_get: sizes,
      fd_write: (e, t, a, n) => { try { new DataView(mem.buffer).setUint32(n >>> 0, 0, true) } catch {} return 0 },
      random_get: (e, t) => { try { crypto.getRandomValues(new Uint8Array(mem.buffer, e >>> 0, t >>> 0)) } catch {} return 0 },
      proc_exit: (A) => { throw Error('WASI proc_exit: ' + A) },
    },
    env: { memory: mem, abort() {}, emscripten_notify_memory_growth() {} },
  }
}

// ---- extract-colors ----
const C = new WebAssembly.Memory({ initial: 256, maximum: 2048 })
const table = new WebAssembly.Table({ initial: 0, element: 'anyfunc' })
let ex = null
let exMem = null
let exInit = null
let canvas = null
let ctx = null
const getCanvas = () => canvas || (canvas = document.createElement('canvas'))

function initExtract() {
  return exInit || (exInit = (async () => {
    const e = () => 0
    const t = { args_get: e, args_sizes_get: e, environ_get: e, environ_sizes_get: e, fd_close: e, fd_fdstat_get: e, fd_seek: e, fd_write: e, proc_exit: e, random_get: e, clock_time_get: e }
    const n = (await instantiate(EXTRACT_COLORS_WASM_B64, {
      wasi_snapshot_preview1: t,
      wasi_unstable: t,
      env: {
        abort: () => {}, abort_: () => {}, __assert_fail: () => {}, emscripten_notify_memory_growth: () => {},
        memory: C, table,
        __stack_pointer: new WebAssembly.Global({ value: 'i32', mutable: true }, 0),
        __data_end: new WebAssembly.Global({ value: 'i32', mutable: false }, 0),
        __heap_base: new WebAssembly.Global({ value: 'i32', mutable: false }, 0),
      },
    })).exports
    ex = n
    const a = n && n.memory
    exMem = a instanceof WebAssembly.Memory ? a : C
    if (!exMem) throw Error('wasm memory not found')
    return n
  })())
}

const clamp01 = (A) => Math.min(1, Math.max(0, Number(A)))

// orig `k`: downsample to ~`pixels` px with smoothing off and read RGBA
function imageToData(A, pixels = 64e3) {
  const t = getCanvas()
  const a = ctx || (ctx = getCanvas().getContext('2d', { willReadFrequently: true }))
  const n = A.naturalWidth ?? A.videoWidth ?? A.width
  const o = A.naturalHeight ?? A.videoHeight ?? A.height
  const r = Math.min(1, Math.sqrt(Math.max(1, Math.floor(pixels)) / Math.max(1, (0 | n) * (0 | o))))
  const g = Math.max(1, Math.round(n * r))
  const i = Math.max(1, Math.round(o * r))
  if (t.width !== g || t.height !== i) {
    t.width = g; t.height = i
    a.imageSmoothingEnabled = false
    a.imageSmoothingQuality = 'low'
  } else a.clearRect(0, 0, g, i)
  a.drawImage(A, 0, 0, g, i)
  return a.getImageData(0, 0, g, i)
}

// orig `m` (extractColors) — <img> input path only (what MdxImg uses)
export async function extractColors(img, opts = {}) {
  await initExtract()
  const { width: n, height: o, data: r } = imageToData(img, opts.pixels)
  const i = r.byteLength >>> 0
  const s = ex.get_pixels_buffer(i) >>> 0
  if (!s) throw Error('get_pixels_buffer 失败')
  new Uint8Array(exMem.buffer, s, i).set(r)
  const I = Math.max(1, Math.floor(opts.pixels ?? 64e3))
  const Q = ex.extract_colors_from_rgba_js(s, 0 | n, 0 | o, 0 | I,
    +clamp01(opts.distance ?? 0.22), +clamp01(opts.saturationDistance ?? 0.2), +clamp01(opts.lightnessDistance ?? 0.2), +clamp01(opts.hueDistance ?? 1 / 12),
    250, 64) >>> 0
  if (!Q) throw Error('extract_colors_from_rgba_js 失败')
  const y = new Float64Array(exMem.buffer, Q, 513)
  const d = Math.max(0, Math.min(64, Math.floor(y[0])))
  const w = []
  for (let A = 0; A < d; A++) {
    const e = 1 + 8 * A
    const red = Math.round(y[e]); const green = Math.round(y[e + 1]); const blue = Math.round(y[e + 2])
    w.push({
      hex: `#${[red, green, blue].map((x) => x.toString(16).padStart(2, '0')).join('')}`,
      red, green, blue, hue: y[e + 3], intensity: y[e + 4], lightness: y[e + 5], saturation: y[e + 6], area: y[e + 7],
    })
  }
  w.sort((A, e) => (e.intensity + 0.1) * (0.9 - e.area) - (A.intensity + 0.1) * (0.9 - A.area))
  return w
}

// ---- color (oklch2rgb / rgb2oklch) ----
let N = null, R = null, X = null, S = null, colorInit = null
function initColor() {
  return colorInit || (colorInit = (async () => {
    const [a, n] = await Promise.all([
      instantiate(OKLCH2RGB_WASM_B64, wasiImports({ initialPages: 256 })),
      instantiate(RGB2OKLCH_WASM_B64, wasiImports({ initialPages: 256 })),
    ])
    N = a.exports; R = N.memory; X = n.exports; S = X.memory
  })())
}
export async function oklch2rgb_abs(L, Cc, h) {
  await initColor()
  const a = N.oklch2rgb_calc_js(+L, +Cc, +h) >>> 0
  const n = new Int32Array(R.buffer, a, 3)
  return { R: 0 | n[0], G: 0 | n[1], B: 0 | n[2] }
}
export async function rgb2oklch(r, g, b) {
  await initColor()
  const a = X.rgb2oklch_calc_js(0 | r, 0 | g, 0 | b) >>> 0
  const n = new Float64Array(S.buffer, a, 3)
  return { L: n[0], C: n[1], h: n[2] }
}

// ---- zoom backdrop colour (orig U/T/Y/O/H/J/z + _ / $ / AA) ----
const LIGHTNESS = { dark: 0.17, light: 0.8 }
const ALPHA = { dark: 0.95, light: 0.92 }
const MAX_CHROMA = { dark: 0.018, light: 0.012 }
const EXTRACT_OPTS = { pixels: 12e3, distance: 0.22, saturationDistance: 0.2, lightnessDistance: 0.2, hueDistance: 1 / 12, crossOrigin: 'anonymous' }
let ready = null
const dominantCache = new Map()
export const backdropCache = new Map()
const pending = new Map()
const ensureReady = () => (ready ??= Promise.all([initExtract(), initColor()]).then(() => undefined))
const byte = (A) => Math.max(0, Math.min(255, Math.round(A)))
const rgba = (r, g, b, theme) => `rgba(${byte(r)},${byte(g)},${byte(b)},${ALPHA[theme]})`
export const defaultBackdrop = (theme) => `rgba(0,0,0,${ALPHA[theme]})`
const srcOf = (img) => img.currentSrc || img.src

async function dominant(img) {
  const e = srcOf(img)
  if (!e) return null
  const t = dominantCache.get(e)
  if (t) return t
  await ensureReady()
  const [a] = await extractColors(img, EXTRACT_OPTS)
  if (!a) return null
  const n = { red: a.red, green: a.green, blue: a.blue }
  dominantCache.set(e, n)
  return n
}
async function tone(c, theme) {
  await ensureReady()
  const t = await rgb2oklch(c.red, c.green, c.blue)
  const a = MAX_CHROMA[theme]
  const { R: r, G: g, B: b } = await oklch2rgb_abs(LIGHTNESS[theme], t.C <= a ? t.C : a, t.h)
  return rgba(r, g, b, theme)
}
export function cachedBackdrop(src, theme) { return src ? backdropCache.get(`${theme}:${src}`) ?? null : null }
export function computeBackdrop(img, theme) {
  const t = srcOf(img)
  if (!t) return Promise.resolve(null)
  const a = `${theme}:${t}`
  const n = backdropCache.get(a)
  if (n) return Promise.resolve(n)
  const o = pending.get(a)
  if (o) return o
  const r = (async () => {
    try {
      const c = await dominant(img)
      if (!c) return null
      try {
        const v = await tone(c, theme)
        backdropCache.set(a, v)
        return v
      } catch {
        const v = rgba(c.red, c.green, c.blue, theme)
        backdropCache.set(a, v)
        return v
      }
    } catch (A) {
      console.warn('Failed to extract zoom backdrop color', A)
      return null
    } finally {
      pending.delete(a)
    }
  })()
  pending.set(a, r)
  return r
}
