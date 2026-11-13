// Live-vs-clone viewport capture for the R12 parity harness (geometry/score output only is tracked).
//
//   PLAYWRIGHT_MODULE=<playwright package dir> CLONE_URL=http://localhost:5192 LIVE_URL=https://haoqi.design \
//   OUT_DIR=<scratch dir OUTSIDE the repo> VIEWPORTS=1440x900,390x844 RUN_ID=run1 node extraction/parity/capture.mjs
//
// Resumable: re-running the same command skips finished (route, viewport, side) units; failed units are retried
// up to 2 times; progress is appended to <OUT_DIR>/<RUN_ID>/progress.log.
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
import { statSync, mkdirSync, writeFileSync, appendFileSync, readFileSync, existsSync, unlinkSync } from 'node:fs'
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
const ALIGN_FRAME = 400 // both sides are advanced to this ABSOLUTE frame before settling (load-phase frame counts differ)
const SETTLE_FRAMES = 600 // then 10 s of virtual time
const SCRAMBLE_WAIT_MS = 3000 // real-time wait per capture: the scramble text runs on a real 40 ms interval (longest: 23 chars x 80 ms + 600 ms)
const OFFSET_FRAMES = 120 // 2 s of virtual time after each scroll
const VERBOSE = !!process.env.PARITY_VERBOSE

const initScript = `(() => {
  let s = ${SEED} >>> 0
  Math.random = function () { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  const realRAF = window.requestAnimationFrame.bind(window)
  let vt = 0, frame = 0, target = ${ALIGN_FRAME}, nextId = 1 // free-running during load (freezing at 0 stalled the WebGL page) but capped at ALIGN_FRAME, so both sides align there
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
  await page.waitForFunction(() => window.__vt.frame >= window.__vt.target, null, { timeout: 900000, polling: 250 }) // frame count, not wall time, decides state: allow slow software rendering
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
  await page.goto(base + route + (route === '/' && base === CLONE ? '?nogate' : ''), { waitUntil: 'domcontentloaded', timeout: 300000 })
  await page.waitForLoadState('load', { timeout: 600000 })
  await page.evaluate(() => document.fonts && document.fonts.ready)
  const loadFrames = await page.evaluate(() => { window.__vt.freeze(); return window.__vt.frame })
  log(`loaded (frames during load: ${loadFrames})`)
  await frames(page, ALIGN_FRAME - loadFrames + SETTLE_FRAMES) // identical absolute virtual time on both sides from here on
  await page.waitForTimeout(SCRAMBLE_WAIT_MS)
  log('settled')
  if (route !== '/') {
    const sh = await page.evaluate(() => document.querySelector('div.fixed.inset-0 > div.overflow-y-auto')?.scrollHeight || 0)
    for (let y = 0; y <= sh; y += h / 2) { await scrollTo(page, y); await frames(page, 4) }
    await page.waitForFunction(() => [...document.images].every((i) => i.complete), null, { timeout: 60000 }).catch(() => {})
    await scrollTo(page, 0)
    await frames(page, 60)
  }
  return { ctx, page, loadFrames }
}

// Renderer: SwiftShader (portable default) or a hardware backend via PARITY_ANGLE (e.g. metal, d3d11, gl, vulkan).
// Both sides always use the same renderer; state is decided by virtual frame count, so the backend only changes speed
// and rasterisation details that apply identically to clone and live.
const ANGLE = process.env.PARITY_ANGLE || 'swiftshader'
// vsync / frame-rate cap off: rAF is otherwise tied to the display link and throttles to <1 fps when the display sleeps.
// Frame COUNT (not rate) decides captured state, so this only changes speed.
const UNTHROTTLE = ['--disable-gpu-vsync', '--disable-frame-rate-limit']

// ---------------- resumable driver
// Work is split into units (route, viewport, side). A unit writes unit-<slug>-<w>-<side>.json only after ALL its
// screenshots exist, so a re-run skips finished units and redoes partial ones. Clone geometry (offsets + crops) is
// measured once per (route, viewport) and stored as geom-<slug>-<w>.json, so both sides always use the same offsets.
// A unit that throws (timeout, crash, network) is retried up to MAX_RETRIES times in a fresh browser context.
// Progress lines go to <OUT_DIR>/<RUN_ID>/progress.log (tail -f it).
const MAX_RETRIES = 2
const DIR = join(OUT, RUN)
mkdirSync(DIR, { recursive: true })
const PROGRESS = join(DIR, 'progress.log')
// single-writer lock: a second capture process on the same run directory would interleave screenshots
const LOCK = join(DIR, '.lock')
{
  const other = existsSync(LOCK) ? Number(readFileSync(LOCK, 'utf8')) : 0
  let alive = false
  if (other && other !== process.pid) { try { process.kill(other, 0); alive = true } catch {} }
  if (alive) { console.error(`another capture (pid ${other}) holds ${LOCK}; refusing to share the run directory`); process.exit(3) }
  writeFileSync(LOCK, String(process.pid))
  process.on('exit', () => { try { if (readFileSync(LOCK, 'utf8') === String(process.pid)) unlinkSync(LOCK) } catch {} })
}
const say = (m) => { const line = `${new Date().toISOString()} ${m}`; appendFileSync(PROGRESS, line + '\n'); console.error(line) }
const readJSON = (f) => { try { return JSON.parse(readFileSync(f, 'utf8')) } catch { return null } }
// Structural guard: the page kind must match the route, on both sides. A different server answering on the clone
// port (it happened: another process took over the port mid-run) or a redirect fails the unit instead of being scored.
const expectedKind = (route) => (route === '/' ? 'home' : route.startsWith('/__not_found') ? 'not-found' : 'article')
function assertKind(geom, route, side) {
  if (geom.kind !== expectedKind(route)) throw new Error(`${side} ${route}: page kind '${geom.kind}', expected '${expectedKind(route)}' (wrong server or redirect)`)
}

async function measureGeometry(browser, route, w, h, slug) {
  const f = join(DIR, `geom-${slug}-${w}.json`)
  const have = readJSON(f)
  if (have) return have
  const c = await openPage(browser, CLONE, route, w, h)
  try {
    const geom = await c.page.evaluate(collect)
    assertKind(geom, route, 'clone')
    const maxScroll = Math.max(0, geom.pageHeight - h)
    const offsets = new Set()
    for (const s of geom.sections) {
      const n = Math.max(1, Math.ceil(s.height / h))
      for (let k = 0; k < n; k++) offsets.add(Math.round(Math.min(maxScroll, Math.max(0, s.top + k * h))))
    }
    const out = { geometry: geom, offsets: [...offsets].sort((a, b) => a - b) }
    writeFileSync(f, JSON.stringify(out, null, 1))
    return out
  } finally { await c.ctx.close() }
}

async function captureUnit(browser, route, w, h, slug, side, offsets) {
  const f = join(DIR, `unit-${slug}-${w}-${side}.json`)
  const have = readJSON(f)
  if (have && have.complete && have.shots.length === offsets.length && have.shots.every((s) => existsSync(join(DIR, s.file)))) {
    say(`skip  ${side} ${route} ${w}x${h} (already complete, ${have.shots.length} shots)`)
    return have
  }
  const pg = await openPage(browser, side === 'clone' ? CLONE : LIVE, route, w, h)
  try {
    const unit = { route, viewport: `${w}x${h}`, side, loadFrames: pg.loadFrames, geometry: await pg.page.evaluate(collect), shots: [], complete: false }
    assertKind(unit.geometry, route, side)
    for (const y of offsets) {
      await scrollTo(pg.page, y)
      await frames(pg.page, OFFSET_FRAMES) // pump stops (freezes) exactly at the target frame
      await pg.page.waitForTimeout(SCRAMBLE_WAIT_MS)
      const actual = await pg.page.evaluate(() => (document.querySelector('.lenis') || document.querySelector('div.fixed.inset-0 > div.overflow-y-auto'))?.scrollTop ?? 0)
      const vframe = await pg.page.evaluate(() => window.__vt.frame)
      const prev = unit.shots.length ? unit.shots[unit.shots.length - 1].virtualFrame : 0
      if (vframe < prev + OFFSET_FRAMES) throw new Error(`virtual frame went from ${prev} to ${vframe}: the document reloaded mid-unit, redoing the unit`)
      const file = `${slug}-${w}-${side}-${String(y).padStart(5, '0')}.png`
      await pg.page.screenshot({ path: join(DIR, file), animations: 'disabled', caret: 'hide', timeout: 120000 })
      unit.shots.push({ offset: y, actualScrollTop: Math.round(actual), virtualFrame: vframe, file })
      say(`  shot ${side} ${route} ${w}x${h} @${y} frame ${vframe}`)
    }
    unit.complete = true
    writeFileSync(f, JSON.stringify(unit, null, 1))
    return unit
  } finally { await pg.ctx.close() }
}

async function withRetries(label, fn) {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      say(`start ${label}${attempt ? ` (retry ${attempt}/${MAX_RETRIES})` : ''}`)
      const r = await fn()
      say(`done  ${label}`)
      return r
    } catch (e) {
      say(`FAIL  ${label} attempt ${attempt + 1}: ${String(e && e.message || e).split('\n')[0].slice(0, 200)}`)
      try { await browser?.close() } catch {}
      browser = await launch() // never retry on a possibly-dead browser
      say('relaunched browser after failure')
    }
  }
  return null
}

const launch = () => chromium.launch({ args: [...(ANGLE === 'swiftshader' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [`--use-angle=${ANGLE}`, '--enable-gpu', '--ignore-gpu-blocklist']), ...UNTHROTTLE] })
let browser = await launch()
// a unit always gets a live browser: relaunched if it disconnected, and after any failed attempt
async function liveBrowser() {
  if (!browser || !browser.isConnected()) { say('relaunch browser (was disconnected)'); try { await browser?.close() } catch {} browser = await launch() }
  return browser
}
const manifest = { tool: 'extraction/parity/capture.mjs', run: RUN, clone: CLONE, live: LIVE, fixedTime: new Date(FIXED_TIME).toISOString(), seed: SEED,
  renderer: ANGLE, alignFrame: ALIGN_FRAME, settleFrames: SETTLE_FRAMES, scrambleWaitMs: SCRAMBLE_WAIT_MS, offsetFrames: OFFSET_FRAMES, capturedAt: new Date().toISOString(), pages: [], failedUnits: [] }
say(`run ${RUN}: ${ROUTES.length} routes x ${VIEWPORTS.length} viewports x 2 sides, renderer ${ANGLE}`)
for (const [w, h] of VIEWPORTS) {
  for (const route of ROUTES) {
    const slug = route === '/' ? 'home' : route.replace(/\W+/g, '_').replace(/^_|_$/g, '')
    const g = await withRetries(`geometry ${route} ${w}x${h}`, async () => measureGeometry(await liveBrowser(), route, w, h, slug))
    if (!g) { manifest.failedUnits.push({ route, viewport: `${w}x${h}`, unit: 'geometry' }); continue }
    const units = {}
    for (const side of ['clone', 'live']) {
      units[side] = await withRetries(`${side} ${route} ${w}x${h}`, async () => captureUnit(await liveBrowser(), route, w, h, slug, side, g.offsets))
      if (!units[side]) manifest.failedUnits.push({ route, viewport: `${w}x${h}`, unit: side })
    }
    if (units.clone && units.live) {
      manifest.pages.push({ route, viewport: `${w}x${h}`, geometry: g.geometry, offsets: g.offsets, liveGeometry: units.live.geometry,
        loadFrames: { clone: units.clone.loadFrames, live: units.live.loadFrames }, shots: { clone: units.clone.shots, live: units.live.shots } })
    }
    writeFileSync(join(DIR, 'capture-manifest.json'), JSON.stringify(manifest, null, 1))
  }
}
await browser.close()
writeFileSync(join(DIR, 'capture-manifest.json'), JSON.stringify(manifest, null, 1))
say(`finished: ${manifest.pages.length} route/viewport pairs complete, ${manifest.failedUnits.length} failed units`)
process.exit(manifest.failedUnits.length ? 1 : 0)
