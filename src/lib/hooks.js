import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { useStore } from './store.js'
import { scrollStore, arrowStore, ARROW_THRESHOLD } from './shared.js'
import { useWindowSize } from '../hooks/useWindowSize.js'

// orig 19668
export function useHasEnteredViewport(opts) {
  const { once = true, threshold = 0.1, root = null, rootMargin } = opts ?? {}
  const [el, setEl] = useState(null)
  const [entered, setEntered] = useState(false)
  const ref = useCallback((n) => setEl(n), [])
  useEffect(() => {
    if (!el || (once && entered)) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e) return
        if (e.isIntersecting) { setEntered(true); if (once) io.disconnect() } else if (!once) setEntered(false)
      },
      { threshold, root, rootMargin },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [el, once, entered, threshold, root, rootMargin])
  return { ref, hasEnteredViewport: entered }
}

export const useIsMobile = () => useWindowSize().width < 1024

// orig 35231 useNearBottom
const nearBottom = (f) => {
  const { scrollTop, limit, viewportHeight } = scrollStore.get()
  if (limit <= 1) return false // bus not bound yet
  return Math.max(0, limit - scrollTop) <= viewportHeight * Math.min(1, Math.max(0, f))
}
export function useNearBottom(f = 0.5) {
  const sub = useCallback((cb) => {
    let prev = nearBottom(f)
    return scrollStore.subscribe(() => { const n = nearBottom(f); if (n !== prev) { prev = n; cb() } })
  }, [f])
  return useSyncExternalStore(sub, () => nearBottom(f), () => false)
}

export const useLenisScrollTop = () => useStore(scrollStore, (s) => s.scrollTop)

// orig 1111
export const ARROW_FULLSCREEN_DOM_COLOR_TRANSITION = 'transition-colors duration-300 ease-out motion-reduce:transition-none'
export const readArrowFullscreenPastThreshold = (t = ARROW_THRESHOLD) => arrowStore.get().dampedScaleT >= t
export const useArrowFullscreenPastThreshold = (t = ARROW_THRESHOLD) => useStore(arrowStore, (s) => s.dampedScaleT >= t)

export function useReducedMotion() {
  const [r, set] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => set(m.matches)
    on(); m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return r
}

// Weather: Open-Meteo (keyless) current temperature for Shanghai. Undefined on failure -> clock only.
let weatherPromise = null
const fetchWeather = () =>
  (weatherPromise ??= fetch('https://api.open-meteo.com/v1/forecast?latitude=31.23&longitude=121.47&current=temperature_2m')
    .then((r) => (r.ok ? r.json() : undefined))
    .then((d) => { const t = d?.current?.temperature_2m; return typeof t === 'number' ? Math.round(t) : undefined })
    .catch(() => undefined))
export function useWeatherTemp() {
  const [t, set] = useState(undefined)
  useEffect(() => { let alive = true; fetchWeather().then((v) => alive && set(v)); return () => { alive = false } }, [])
  return t
}

// orig useBrowserName
const brandOf = (brands, re) => brands.find(({ brand }) => re.test(brand))?.brand ?? null
export function useBrowserName() {
  const [n, set] = useState('Unknown')
  useEffect(() => {
    const ua = navigator.userAgent
    const brands = Array.isArray(navigator.userAgentData?.brands) ? navigator.userAgentData.brands : []
    for (const re of [/Microsoft Edge/i, /Opera/i, /Brave/i, /Arc/i, /Vivaldi/i, /Samsung Internet/i, /Yandex/i, /Firefox/i, /Google Chrome/i, /Chromium/i, /Safari/i]) {
      const b = brandOf(brands, re)
      if (b) return set(b)
    }
    set(/Edg\//.test(ua) ? 'Microsoft Edge' : /OPR\//.test(ua) ? 'Opera' : /Brave\//.test(ua) ? 'Brave' : /Arc\//.test(ua) ? 'Arc' : /Vivaldi\//.test(ua) ? 'Vivaldi'
      : /SamsungBrowser\//.test(ua) ? 'Samsung Internet' : /YaBrowser\//.test(ua) ? 'Yandex Browser' : /Firefox\//.test(ua) || /FxiOS\//.test(ua) ? 'Firefox'
      : /Chrome\/|CriOS\//.test(ua) ? 'Google Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Unknown')
  }, [])
  return n
}
