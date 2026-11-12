// Mobile menu open state (orig FullscreenTransitionProvider.menuOpen). Track B2's transition canvas reads it.
import { createStore } from './store.js'
export const menuStore = createStore({ open: false })
export const setMenuOpen = (v) => {
  const cur = menuStore.get().open
  const next = typeof v === 'function' ? v(cur) : !!v
  if (next !== cur) menuStore.set({ open: next })
}
