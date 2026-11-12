// Tiny external store helper (useSyncExternalStore-compatible).
import { useSyncExternalStore } from 'react'
export function createStore(initial) {
  let state = initial
  const subs = new Set()
  return {
    get: () => state,
    set(patch) { state = typeof patch === 'function' ? patch(state) : { ...state, ...patch }; subs.forEach((f) => f(state)) },
    subscribe(fn) { subs.add(fn); return () => subs.delete(fn) },
  }
}
export function useStore(store, selector = (s) => s) {
  return useSyncExternalStore(store.subscribe, () => selector(store.get()), () => selector(store.get()))
}
