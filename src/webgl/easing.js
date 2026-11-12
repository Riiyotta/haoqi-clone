// Port of orig module 29090 (customCubic = cubic-bezier(.66,0,.01,1), easeInOutCubic).
const T = -3 * 0.65 - 1.98
const N = -0.98 - (-3 * 0.65 - 1.98)
const bx = (e) => ((N * e + T) * e + 1.98) * e
const dbx = (e) => (3 * N * e + 2 * T) * e + 1.98

export function customCubic(e) {
  if (e <= 0) return 0
  if (e >= 1) return 1
  let t = e
  let solved = false
  for (let k = 0; k < 8; k++) {
    const n = bx(t) - e
    const a = dbx(t)
    if (Math.abs(n) < 1e-7) { solved = true; break }
    if (Math.abs(a) < 1e-7) break
    t -= n / a
  }
  if (!solved) {
    let lo = 0, hi = 1
    for (t = e; lo < hi;) {
      const i = bx(t)
      if (Math.abs(i - e) < 1e-7) break
      e > i ? (lo = t) : (hi = t)
      t = (hi + lo) / 2
    }
  }
  return (-2 * t + 3) * t * t
}

export const easeInOutCubic = (e) => (e < 0.5 ? 4 * e * e * e : 1 - Math.pow(-2 * e + 2, 3) / 2)
