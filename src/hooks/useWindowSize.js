import { useEffect, useState } from 'react'
export function useWindowSize() {
  const get = () => ({ width: window.innerWidth, height: window.innerHeight })
  const [s, set] = useState(get)
  useEffect(() => { const on = () => set(get()); window.addEventListener('resize', on); return () => window.removeEventListener('resize', on) }, [])
  return s
}
