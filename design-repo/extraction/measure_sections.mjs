// Re-measure semantic section geometry (document Y + height) for every route of the clone (or the live site).
//
//   PLAYWRIGHT_MODULE=<path to an installed playwright package dir or entry file> \
//   BASE_URL=http://localhost:5192 VIEWPORTS=1440x900,390x844 \
//   node extraction/measure_sections.mjs > out.json
//
// No absolute machine path lives in this file: the browser automation package is resolved from the
// PLAYWRIGHT_MODULE env var (falls back to a bare `playwright` import). Chromium runs with SwiftShader so
// the home WebGL scene renders headless. Output is geometry only (no copy text), safe to track.
import { pathToFileURL } from 'node:url'
import { statSync } from 'node:fs'
import { join } from 'node:path'

const modPath = process.env.PLAYWRIGHT_MODULE
let pwSpec = 'playwright'
if (modPath) {
  let p = modPath
  try { if (statSync(p).isDirectory()) p = join(p, 'index.mjs') } catch {}
  pwSpec = pathToFileURL(p).href
}
const { chromium } = await import(pwSpec)
import { collect } from './section_geometry.mjs'
const BASE = (process.env.BASE_URL || 'http://localhost:5192').replace(/\/$/, '')
const VIEWPORTS = (process.env.VIEWPORTS || '1440x900').split(',').map((s) => s.split('x').map(Number))
const ROUTES = (process.env.ROUTES || '/,/reunimos,/inspire_mono,/wasm_design_utils,/adrive,/shore_icon,/teambition,/__not_found_probe__').split(',')

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
const result = { tool: 'extraction/measure_sections.mjs', base: BASE, measuredAt: new Date().toISOString(), viewports: {} }
for (const [w, h] of VIEWPORTS) {
  const key = `${w}x${h}`
  result.viewports[key] = {}
  const page = await browser.newPage({ viewport: { width: w, height: h }, colorScheme: 'light' })
  for (const route of ROUTES) {
    await page.goto(BASE + route + (route === '/' ? '?nogate' : ''), { waitUntil: 'load', timeout: 90000 })
    await page.evaluate(() => document.fonts && document.fonts.ready)
    await page.waitForTimeout(route === '/' ? 6000 : 2500)
    if (route !== '/') {
      // Article figures are loading="lazy" without intrinsic size: walk the page so every image loads, then measure.
      await page.evaluate(async () => {
        const s = document.querySelector('div.fixed.inset-0 > div.overflow-y-auto')
        if (!s) return
        for (let y = 0; y <= s.scrollHeight; y += s.clientHeight / 2) { s.scrollTop = y; await new Promise((r) => setTimeout(r, 120)) }
        const t0 = Date.now()
        while ([...document.images].some((i) => !i.complete) && Date.now() - t0 < 20000) await new Promise((r) => setTimeout(r, 200))
        s.scrollTop = 0
        await new Promise((r) => setTimeout(r, 300))
      })
    }
    const data = await page.evaluate(collect)
    if (data.kind === 'home') {
      // Confirm the 4 stage boundaries against the rendered DOM: scroll to the middle of each stage and record a
      // text-free structural signature of the sticky layer (line count, ring present).
      const sig = []
      for (let k = 0; k < 4; k++) {
        const y = data.stageWrapper.top + (2 * k + 1) * (data.stageWrapper.height / 8)
        await page.evaluate((yy) => { const l = document.querySelector('.lenis'); l.scrollTop = yy; l.dispatchEvent(new Event('scroll')) }, y)
        await page.waitForTimeout(1200)
        sig.push(await page.evaluate(() => {
          const kids = [...document.querySelector('.lenis').firstElementChild.children].filter((e) => getComputedStyle(e).position !== 'fixed')
          const sticky = kids[3].firstElementChild
          return { childBlocks: sticky.children.length, ringEllipses: sticky.querySelectorAll('ellipse').length, lines: sticky.firstElementChild ? sticky.firstElementChild.children.length : 0 }
        }))
      }
      data.stageSignatures = sig
      await page.evaluate(() => { const l = document.querySelector('.lenis'); l.scrollTop = 0 })
    }
    result.viewports[key][route] = data
  }
  await page.close()
}
await browser.close()
process.stdout.write(JSON.stringify(result, null, 1) + '\n')
