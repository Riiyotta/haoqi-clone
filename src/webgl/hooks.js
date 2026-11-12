import { useSyncExternalStore } from 'react'
import { themeStore } from '../lib/shared.js'
import { useStore } from '../lib/store.js'

export const useTheme = () => useStore(themeStore, (s) => s.resolved)

// orig useIsMobileWidth: viewport width < 1024 (live)
const subResize = (cb) => {
  window.addEventListener('resize', cb)
  window.addEventListener('orientationchange', cb)
  window.visualViewport?.addEventListener('resize', cb)
  return () => {
    window.removeEventListener('resize', cb)
    window.removeEventListener('orientationchange', cb)
    window.visualViewport?.removeEventListener('resize', cb)
  }
}
export const useIsMobileWidth = () => useSyncExternalStore(subResize, () => Math.max(1, window.innerWidth || 1) < 1024, () => false)
