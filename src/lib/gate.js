// Loading gates for the HTML layer.
// - scramble: orig `allowScrambleLines` (set by B2's transition canvas 100ms into the reveal).
//   Fallback: if it hasn't become true 2500ms after fonts + heavy assets are ready, start anyway.
// - heavy: orig `readyToLoadHeavy` (home loading gate; hides grid/progress/globe/hamburger until assets are ready).
//   Fallback: opens 2500ms after fontsReady.
// Dev-only `?nogate` forces both open immediately.
import { createStore, useStore } from './store.js'
import { loadStore } from './shared.js'
import { routerStore } from './router.js'

export const NOGATE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('nogate')
export const gateStore = createStore({ scramble: NOGATE, heavy: NOGATE })

// Route navigation (orig startNavigation -> setReadyToLoadHeavy(false)): heavy stays closed until the home scene
// reports its assets again after a fresh mount (counters are zeroed at push time by TransitionCanvas).
let navReset = false
let navSawEmpty = false
export function markHeavyReset() { navReset = true; navSawEmpty = false; recompute() }

let heavyFallback = false
let scrambleFallback = false
let heavyTimer = null
let scrambleTimer = null
function recompute() {
  const s = loadStore.get()
  const assets = s.modelsLoaded >= s.modelsTotal && s.texLoaded >= s.texTotal
  if (navReset) {
    if (!assets) navSawEmpty = true
    else if (navSawEmpty) navReset = false
  }
  const heavy = NOGATE || (!navReset && (assets || s.revealed || heavyFallback))
  const scramble = NOGATE || s.allowScrambleLines || scrambleFallback
  const cur = gateStore.get()
  if (cur.scramble !== scramble || cur.heavy !== heavy) gateStore.set({ scramble, heavy })
  // Fallbacks for when the WebGL tracks never report: heavy opens 2500ms after fontsReady; the scramble gate
  // opens 2500ms after fonts AND heavy are ready (so a slow-loading but working transition canvas still wins).
  if (s.fontsReady && heavyTimer === null) heavyTimer = setTimeout(() => { heavyFallback = true; recompute() }, 2500)
  if (s.fontsReady && heavy && scrambleTimer === null) scrambleTimer = setTimeout(() => { scrambleFallback = true; recompute() }, 2500)
}
if (typeof window !== 'undefined') {
  if (NOGATE && !loadStore.get().allowScrambleLines) loadStore.set({ allowScrambleLines: true })
  loadStore.subscribe(recompute)
  recompute()
}

export const useScrambleAllowed = () => useStore(gateStore, (s) => s.scramble)
// orig useHomeLoadingGate(): true while gating (assets not ready)
// orig 97839: `"/" === pathname && !readyToLoadHeavy`
const subscribeGateAndRoute = (fn) => { const a = gateStore.subscribe(fn); const b = routerStore.subscribe(fn); return () => { a(); b() } }
const homeGating = () => routerStore.get().pathname === '/' && !gateStore.get().heavy
export const useHomeLoadingGate = () => useStore({ subscribe: subscribeGateAndRoute, get: () => homeGating() }, (v) => v)
