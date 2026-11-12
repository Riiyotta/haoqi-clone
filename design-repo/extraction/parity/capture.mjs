// Live-vs-clone viewport capture for the R12 parity harness (geometry/score output only is tracked).
//
//   PLAYWRIGHT_MODULE=<playwright package dir> CLONE_URL=http://localhost:5192 LIVE_URL=https://haoqi.design \
//   OUT_DIR=<scratch dir OUTSIDE the repo> VIEWPORTS=1440x900,390x844 RUN_ID=run1 node extraction/parity/capture.mjs
//
// Writes PNG screenshots + capture-manifest.json into OUT_DIR/RUN_ID. Live screenshots are NOT committed (R12).
//
// Capture state - identical on both sides (documented in extraction/parity/README.md):
// - Virtual animation time: an init script replaces requestAnimationFrame / performance.now / Date so every
//   animation frame advances time by exactly 1000/60 ms and Date is pinned to a fixed instant (clock line).
//   Frames are pumped by the real rAF, and the harness FREEZES the pump (callbacks held) before each screenshot,
//   so the WebGL scene, Lenis and every rAF-driven animation are captured at an exact virtual frame count.
//   (Playwright's fake timer clock was tried first: the live bundle's zero-delay timer chains never let it settle.)
// - Math.random replaced by a seeded PRNG before any page script runs.
// - Both weather endpoints aborted (neither status row shows a temperature).
// - Light colour scheme, no pointer movement, no clicks, no consent banner exists. Finite CSS animations are
//   completed by the screenshot call (animations: 'disabled').
// - Sections are reached by setting the scroll container's scrollTop to the same offsets on both sides; offsets
//   and crops come from the CLONE's measured section geometry (section_geometry.mjs).
// Time-driven regions that still differ by design (sticker spawn frame depends on asset-load timing, bokeh noise)
// are NOT masked; they are reported per section and diagnosed in the README.
import { pathToFileURL } from 'node:url'
import { statSync, mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { collect } from '../section_geometry.mjs'

const modPath = process.env.PLAYWRIGHT_MODULE
let spec = 'playwright'
if (modPath) { let p = modPath; try { if (statSync(p).isDirectory()) p = join(p, 'index.mjs') } catch {} spec = pathToFileURL(p).href }
const { chromium } = await import(spec)

const CLONE = (process.env.CLONE_URL || 'http://localhost:5192').replace(/\/$/, '')
const LIVE = (process.env.LIVE_URL || 'https://haoqi.design').replace(/\/$/, '')
const OUT = process.env.OUT_DIR
if (!OUT) { console.error('OUT_DIR is required (a scratch directory outside the repo)'); process.exit(2) }
const RUN = process.env.RUN_ID || 'run1'
const VIEWPORTS = (process.env.VIEWPORTS || '1440x900').split(',').map((s) => s.split('x').map(Number))
const ROUTES = (process.env.ROUTES || '/,/reunimos,/inspire_mono,/wasm_design_utils,/adrive,/shore_icon,/teambition,/__not_found_probe__').split(',')
const FIXED_TIME = Date.parse('2026-11-12T02:00:00Z')
const SEED = 20261112
const SETTLE_FRAMES = 600 // 10 s of virtual time after load
const OFFSET_FRAMES = 120 // 2 s of virtual time after each scroll
const VERBOSE = !!process.env.PARITY_VERBOSE

const initScript = `(() => {
  let s = ${SEED} >>> 0
  Math.random = function () { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const realRAF = window.requestAnimationFrame.bind(window)
  let vt = 0, frame = 0, target = Infinity, nextId = 1
  const q = new Map()
  performance.now = () => vt
  const RD = Date, BASE = ${FIXED_TIME}
  function FD(...a) { if (!new.target) return new RD(BASE + vt).toString(); return a.length ? new RD(...a) : new RD(BASE + vt) }
  FD.prototype = RD.prototype; FD.now = () => BASE + vt; FD.parse = RD.parse; FD.UTC = RD.UTC
  window.Date = FD
  window.requestAnimationFrame = (cb) => { const id = nextId++; q.set(id, cb); return id }
  window.cancelAnimationFrame = (id) => { q.delete(id) }
  function pump() {
    realRAF(pump)
    if (frame >= target) return
    frame++; vt += 1000 / 60
    const cbs = [...q.values()]; q.clear()
    for (const cb of cbs) { try { cb(vt) } catch (e) { console.error(e) } }
  }
  realRAF(pump)
  window.__vt = { run(n) { target = frame + n }, freeze() { target = frame }, get frame() { return frame }, get target() { return target } }
})()`

async function frames(page, n) {
  await page.evaluate((k) => window.__vt.run(k), n)
  await page.waitForFunction(() => window.__vt.frame >= window.__vt.target, null, { timeout: 600000, polling: 100 })
}

async function scrollTo(page, y) {
  await page.evaluate((yy) => {
    const s = document.querySelector('.lenis') || document.querySelector('div.fixed.inset-0 > div.overflow-y-auto')
    if (!s) return
    s.scrollTop = yy
    s.dispatchEvent(new Event('scroll'))
  }, y)
}

async function openPage(browser, base, route, w, h) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: 'light', reducedMotion: 'no-preference' })
  await ctx.route(/open-meteo\.com|qweather\.com/, (r) => r.abort())
  await ctx.addInitScript(initScript)
  const page = await ctx.newPage()
  const T0 = Date.now()
  const log = (m) => VERBOSE && console.error(`[${base === CLONE ? 'clone' : 'live'} ${route} ${w}] ${m} +${Date.now() - T0}ms`)
  await page.goto(base + route + (route === '/' && base === CLONE ? '?nogate' : ''), { waitUntil: 'load', timeout: 180000 })
  await page.evaluate(() => document.fonts && document.fonts.ready)
  log('loaded')
  await frames(page, SETTLE_FRAMES)
  await page.waitForTimeout(2500) // real-time setInterval scramble settles
  log('settled')
  if (route !== '/') {
    const sh = await page.evaluate(() => document.querySelector('div.fixed.inset-0 > div.overflow-y-auto')?.scrollHeight || 0)
    for (let y = 0; y <= sh; y += h / 2) { await scrollTo(page, y); await frames(page, 4) }
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 60000 }).catch(() => {})
    await scrollTo(page, 0)
    await frames(page, 60)
  }
  return { ctx, page }
}

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const manifest = { tool: 'extraction/parity/capture.mjs', run: RUN, clone: CLONE, live: LIVE, fixedTime: new Date(FIXED_TIME).toISOString(), seed: SEED,
  settleFrames: SETTLE_FRAMES, offsetFrames: OFFSET_FRAMES, capturedAt: new Date().toISOString(), pages: [] }
mkdirSync(join(OUT, RUN), { recursive: true })
for (const [w, h] of VIEWPORTS) {
  for (const route of ROUTES) {
    const slug = route === '/' ? 'home' : route.replace(/\W+/g, '_').replace(/^_|_$/g, '')
    const c = await openPage(browser, CLONE, route, w, h)
    const geom = await c.page.evaluate(collect)
    const maxScroll = Math.max(0, geom.pageHeight - h)
    const offsets = new Set()
    for (const s of geom.sections) {
      const n = Math.max(1, Math.ceil(s.height / h))
      for (let k = 0; k < n; k++) offsets.add(Math.round(Math.min(maxScroll, Math.max(0, s.top + k * h))))
    }
    const list = [...offsets].sort((a, b) => a - b)
    const entry = { route, viewport: `${w}x${h}`, geometry: geom, offsets: list, shots: {} }
    const l = await openPage(browser, LIVE, route, w, h)
    entry.liveGeometry = await l.page.evaluate(collect)
    for (const [side, pg] of [['clone', c.page], ['live', l.page]]) {
      entry.shots[side] = []
      for (const y of list) {
        await scrollTo(pg, y)
        await frames(pg, OFFSET_FRAMES) // pump stops (freezes) exactly at the target frame
        await pg.waitForTimeout(400)
        const actual = await pg.evaluate(() => (document.querySelector('.lenis') || document.querySelector('div.fixed.inset-0 > div.overflow-y-auto'))?.scrollTop ?? 0)
        const vframe = await pg.evaluate(() => window.__vt.frame)
        const file = `${slug}-${w}-${side}-${String(y).padStart(5, '0')}.png`
        await pg.screenshot({ path: join(OUT, RUN, file), animations: 'disabled', caret: 'hide' })
        entry.shots[side].push({ offset: y, actualScrollTop: Math.round(actual), virtualFrame: vframe, file })
        if (VERBOSE) console.error(`  shot ${side} ${route} ${w} @${y} frame ${vframe}`)
      }
    }
    await c.ctx.close(); await l.ctx.close()
    manifest.pages.push(entry)
    writeFileSync(join(OUT, RUN, 'capture-manifest.json'), JSON.stringify(manifest, null, 1))
    console.error(`captured ${route} @${w}x${h}: ${list.length} offsets`)
  }
}
await browser.close()
writeFileSync(join(OUT, RUN, 'capture-manifest.json'), JSON.stringify(manifest, null, 1))
console.error('manifest:', join(RUN, 'capture-manifest.json'))
