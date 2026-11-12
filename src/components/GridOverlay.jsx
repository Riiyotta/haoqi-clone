import { useMemo } from 'react'
import { useWindowSize } from '../hooks/useWindowSize.js'

// Ported from original bundle (module 13717): viewport-driven 3-row grid with crosshairs.
const LINE = 'rgba(255, 255, 255, 0.1)'

export default function GridOverlay() {
  const { width: t, height: r } = useWindowSize()
  const n = t < 1024 ? 16 : 56
  const { verticalPath, horizontalPath, crossPath } = useMemo(() => {
    const e = Math.max(0, t - 2 * n)
    const i = Math.max(0, r / 3 - 12)
    const s = i + 24
    const a = s + i
    const o = t < 1280 ? 2 : 3
    const h = Array.from({ length: o + 1 }, (_, k) => n + (k / o) * e).map((x) => Math.round(x) + 0.5)
    const rows = [{ startY: 0, endY: i }, { startY: s, endY: a }, { startY: a + 24, endY: r }]
    const ys = [i + 12, a + 12]
    const verticalPath = rows.map(({ startY, endY }) => h.map((x) => `M${x} ${startY}V${endY}`).join('')).join('')
    const horizontalPath = ys.map((y) => {
      if (h.length < 2) return ''
      const first = h[0], last = h[h.length - 1]
      const mids = h.slice(0, -1).map((x, k) => `M${x + 12} ${y}H${h[k + 1] - 12}`)
      return [`M0 ${y}H${first - 12}`, ...mids, `M${last + 12} ${y}H${t}`].join('')
    }).join('')
    const crossPath = h.flatMap((x) => ys.flatMap((y) => [`M${x} ${y - 6}V${y + 6}`, `M${x - 6} ${y}H${x + 6}`])).join('')
    return { verticalPath, horizontalPath, crossPath }
  }, [r, n, t])

  return (
    <div className="z-20 fixed inset-0 w-full h-full pointer-events-none mix-blend-difference">
      <svg viewBox={`0 0 ${t} ${r}`} className="block shape-rendering-crispEdges">
        <path d={verticalPath} stroke={LINE} strokeWidth="1" fill="none" />
        <path d={horizontalPath} stroke={LINE} strokeWidth="1" fill="none" />
        <path d={crossPath} stroke="#FFFFFF" strokeWidth="1" fill="none" opacity={0.4} />
      </svg>
    </div>
  )
}
