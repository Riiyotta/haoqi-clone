// Minimal History-API router (replaces Next.js App Router for this clone).
// routerStore.pathname is what the original reads via usePathname().
import { createStore, useStore } from './store.js'

const loc = () => (typeof window === 'undefined' ? { pathname: '/', hash: '' } : { pathname: window.location.pathname || '/', hash: window.location.hash })

// nav: 'init' | 'push' | 'replace' | 'pop'  — how the current location was reached (used by scroll handling).
export const routerStore = createStore({ ...loc(), nav: 'init', key: 0 })

export function routerPush(href, { replace = false } = {}) {
  const url = new URL(href, window.location.origin)
  const next = url.pathname + url.search + url.hash
  if (replace) history.replaceState(null, '', next)
  else history.pushState(null, '', next)
  routerStore.set((s) => ({ pathname: url.pathname || '/', hash: url.hash, nav: replace ? 'replace' : 'push', key: s.key + 1 }))
}

if (typeof window !== 'undefined') {
  window.addEventListener('popstate', () => {
    const l = loc()
    const s = routerStore.get()
    // hash-only history entries (heading/TOC replaceState never creates these, but keep it safe)
    if (l.pathname === s.pathname) { if (l.hash !== s.hash) routerStore.set({ hash: l.hash }); return }
    routerStore.set({ ...l, nav: 'pop', key: s.key + 1 })
  })
}

export const usePathname = () => useStore(routerStore, (s) => s.pathname)

// Route table (Next.js app/ segments of the original).
export const ARTICLE_SLUGS = ['reunimos', 'inspire_mono', 'wasm_design_utils', 'adrive', 'shore_icon', 'teambition']
export function matchRoute(pathname) {
  if (pathname === '/') return { name: 'home' }
  const slug = pathname.replace(/^\/+|\/+$/g, '')
  if (ARTICLE_SLUGS.includes(slug)) return { name: 'article', slug }
  return { name: 'notFound' }
}
