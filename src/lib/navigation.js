// Route-transition controller state (orig 73475 FullscreenTransitionProvider: targetHref / startNavigation /
// clearNavigation) + the header/footer WORK·CONTACT helper (orig `ti` in 88106 and `w` in 54450).
import { createStore, useStore } from './store.js'
import { routerStore } from './router.js'
import { scrollEnv, PENDING_SCROLL_ANCHOR_SESSION_KEY } from './scroll.js'
import { markHeavyReset } from './gate.js'

export const navStore = createStore({ targetHref: null, replace: false })

// orig startNavigation: setReadyToLoadHeavy(false), setHeavyLoadProgress(0), keep the first pending target.
export function startNavigation(href, opts) {
  markHeavyReset()
  if (navStore.get().targetHref == null) navStore.set({ targetHref: href, replace: !!opts?.replace })
}
export function clearNavigation() { navStore.set({ targetHref: null, replace: false }) }
export const useTargetHref = () => useStore(navStore, (s) => s.targetHref)

// WORK / CONTACT: on "/" scroll there; elsewhere stash the anchor and transition home.
export function goToHomeAnchor(anchor) {
  if (routerStore.get().pathname === '/') scrollEnv.lenisScrollTo(anchor, { lerp: 0.1 })
  else {
    sessionStorage.setItem(PENDING_SCROLL_ANCHOR_SESSION_KEY, anchor)
    startNavigation('/')
  }
}
