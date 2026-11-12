// Shell providers ported to module-level stores: theme (orig 90975), sound + fonts (orig 23525), pointer (orig 16265).
import { themeStore, soundStore, pointerStore, loadStore } from './shared.js'
import { isEditableTarget } from './scroll.js'

const THEMES = ['light', 'dark', 'system']
const mq = () => window.matchMedia('(prefers-color-scheme: dark)')
const resolve = (setting) => (setting === 'system' ? (mq().matches ? 'dark' : 'light') : setting)

function applyTheme() {
  const { setting } = themeStore.get()
  const resolved = resolve(setting)
  const html = document.documentElement
  html.classList.remove('light', 'dark')
  html.classList.add(resolved)
  if (themeStore.get().resolved !== resolved) themeStore.set({ resolved })
}

export function setTheme(setting) {
  if (!THEMES.includes(setting)) return
  try { localStorage.setItem('theme', setting) } catch {}
  if (themeStore.get().setting !== setting) themeStore.set({ setting })
  applyTheme()
}
export const cycleTheme = () => setTheme(THEMES[(THEMES.indexOf(themeStore.get().setting) + 1) % THEMES.length])

export function setSoundEnabled(on) {
  try { localStorage.setItem('sound', on ? 'on' : 'off') } catch {}
  if (soundStore.get().on !== on) soundStore.set({ on })
}

async function loadFonts() {
  const origin = window.location.origin.split('#')[0]
  const tiktok = new FontFace('tiktok', `url(${origin}/fonts/TikTokSans.ttf)`, { display: 'block', weight: '100 900' })
  await tiktok.load(); document.fonts.add(tiktok)
  const mono = new FontFace('mono', `url(${origin}/fonts/GeistMono[wght].ttf)`, { display: 'block', weight: '100 900' })
  await mono.load(); document.fonts.add(mono)
  const dep = new FontFace('tronica-mono', `url(${origin}/fonts/DepartureMono-Regular.otf)`, { display: 'block', weight: '400' })
  await dep.load(); document.fonts.add(dep)
  return true
}

export function initShell() {
  const cleanups = []

  // ---- theme
  try {
    const t = localStorage.getItem('theme')
    if (t && THEMES.includes(t)) themeStore.set({ setting: t })
  } catch {}
  applyTheme()
  const m = mq()
  const onMq = () => { if (themeStore.get().setting === 'system') applyTheme() }
  m.addEventListener('change', onMq)
  cleanups.push(() => m.removeEventListener('change', onMq))

  // ---- fonts
  let alive = true
  loadFonts()
    .then((ok) => { if (alive) loadStore.set({ fontsReady: !!ok }) })
    .catch((e) => { console.warn('Failed to load fonts:', e) })
  cleanups.push(() => { alive = false })

  // ---- sound
  try {
    const s = localStorage.getItem('sound')
    if (s === 'off') soundStore.set({ on: false })
    else if (s === 'on') soundStore.set({ on: true })
  } catch {}
  const ac = new AbortController()
  let audio = null
  let url = null
  let offPointer = null
  const sync = () => {
    offPointer?.(); offPointer = null
    if (!audio) return
    if (!soundStore.get().on) { audio.pause(); return }
    const play = () => { audio.play().catch(() => {}) }
    play()
    const onDown = () => { play(); document.removeEventListener('pointerdown', onDown) }
    document.addEventListener('pointerdown', onDown, { passive: true })
    offPointer = () => document.removeEventListener('pointerdown', onDown)
  }
  fetch('/bgm.mp3', { signal: ac.signal })
    .then((r) => { if (!r.ok) throw Error(`HTTP ${r.status}`); return r.blob() })
    .then((b) => {
      if (ac.signal.aborted) return
      audio = new Audio((url = URL.createObjectURL(b)))
      audio.loop = true
      audio.volume = 0.35
      audio.addEventListener('play', () => soundStore.set({ playing: true }))
      audio.addEventListener('pause', () => soundStore.set({ playing: false }))
      sync()
    })
    .catch((e) => { if (!ac.signal.aborted) console.warn('Failed to load BGM:', e) })
  let lastOn = soundStore.get().on
  const unsubSound = soundStore.subscribe((s) => { if (s.on !== lastOn) { lastOn = s.on; sync() } })
  const onKey = (e) => {
    if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return
    if (e.key.toLowerCase() === 's') setSoundEnabled(!soundStore.get().on)
  }
  window.addEventListener('keydown', onKey)
  cleanups.push(() => {
    ac.abort(); unsubSound(); offPointer?.()
    window.removeEventListener('keydown', onKey)
    if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load() }
    if (url) URL.revokeObjectURL(url)
    soundStore.set({ playing: false })
  })

  // ---- pointer
  let raf = null
  let pending = null
  const flush = () => { raf = null; if (pending) { pointerStore.set(pending); pending = null } }
  const push = (p) => {
    const cur = pending ?? pointerStore.get()
    if (cur.x === p.x && cur.yUp === p.yUp && cur.inside === p.inside) return
    pending = { ...cur, ...p }
    if (raf === null) raf = requestAnimationFrame(flush)
  }
  const onMove = (e) => {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight)
    push({ x: e.clientX / w, yUp: 1 - e.clientY / h, clientX: e.clientX, clientY: e.clientY, inside: true, hasPointer: true, lastMoveAt: performance.now() })
  }
  const onLeave = () => push({ x: 0.5, yUp: 0.5, inside: false })
  const opt = { capture: true, passive: true }
  window.addEventListener('pointermove', onMove, opt)
  window.addEventListener('pointerdown', onMove, opt)
  window.addEventListener('pointerover', onMove, opt)
  window.addEventListener('blur', onLeave, opt)
  document.addEventListener('mouseleave', onLeave, opt)
  document.addEventListener('visibilitychange', onLeave, opt)
  cleanups.push(() => {
    window.removeEventListener('pointermove', onMove, true)
    window.removeEventListener('pointerdown', onMove, true)
    window.removeEventListener('pointerover', onMove, true)
    window.removeEventListener('blur', onLeave, true)
    document.removeEventListener('mouseleave', onLeave, true)
    document.removeEventListener('visibilitychange', onLeave, true)
    if (raf !== null) cancelAnimationFrame(raf)
  })

  return () => cleanups.forEach((f) => f())
}
