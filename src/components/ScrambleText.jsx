// Port of orig module 71358 (ScrambleText).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../lib/store.js'
import { themeStore } from '../lib/shared.js'
import { useScrambleAllowed } from '../lib/gate.js'
import { useHasEnteredViewport } from '../lib/hooks.js'

const CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*+-=?/<>[]{}'
const DEFAULT_COLORS = { light: ['#c0fe04', '#607F02'], dark: ['#c0fe04', '#DFFF81'] }
const subs = new Set()
let interval = null
const randChar = () => CHARS[Math.floor(Math.random() * CHARS.length)]

const renderSettled = (parts) =>
  parts.map((p, i) => {
    if (p.kind === 'text') {
      const key = `text-${i}`
      return (
        <span key={key}>
          {p.value.split('\n').flatMap((line, j, arr) => (j < arr.length - 1 ? [line, <br key={`${key}-br-${j}`} />] : [line]))}
        </span>
      )
    }
    return <span key={`slot-${i}`}>{p.settled}</span>
  })

export default function ScrambleText({
  text, parts, className, style,
  onClick, onMouseEnter, onMouseLeave, onPointerEnter, onPointerLeave, onPointerDown, onFocus, onBlur,
  colors = DEFAULT_COLORS, startDelayMs = 0, letterDelayMs = 80, reverse = false, scrambleColors = true,
}) {
  const [now, setNow] = useState(0)
  const [done, setDone] = useState(false)
  const resolvedTheme = useStore(themeStore, (s) => s.resolved)
  const allow = useScrambleAllowed()
  const { ref, hasEnteredViewport: entered } = useHasEnteredViewport({ threshold: 0.1 })
  const startRef = useRef(0)
  const startedRef = useRef(false)

  const L = useMemo(
    () =>
      (parts ?? [text ?? '']).map((p) => {
        if (typeof p === 'string') return { kind: 'text', value: p }
        const s = p.scramble ?? (p.length > 0 ? ' '.repeat(p.length) : '')
        return { kind: 'slot', length: p.length, scramble: s.slice(0, p.length).padEnd(p.length, ' '), settled: p.settled, className: p.className }
      }),
    [parts, text],
  )
  const F = useMemo(() => L.reduce((n, p) => n + (p.kind === 'text' ? p.value.length : p.length), 0), [L])
  const j = 2 * letterDelayMs
  const D = 2 * j
  const total = useMemo(() => startDelayMs + (F > 0 ? (F - 1) * letterDelayMs : 0) + D, [F, startDelayMs, letterDelayMs, D])

  useEffect(() => {
    if (done || !entered || !allow) return
    // Deviation from the bundle: the original returns early once started, so a text-length change mid-scramble
    // (e.g. temperature arriving) would freeze the ticker. We keep the original start time and re-subscribe.
    if (!startedRef.current) {
      startedRef.current = true
      startRef.current = performance.now()
      setNow(startRef.current)
    }
    const tick = (t) => {
      setNow(t)
      if (t - startRef.current >= total) { setDone(true); off?.(); off = null }
    }
    subs.add(tick)
    if (interval === null) interval = window.setInterval(() => { const t = performance.now(); for (const f of subs) f(t) }, 40)
    let off = () => {
      subs.delete(tick)
      if (subs.size === 0 && interval !== null) { window.clearInterval(interval); interval = null }
    }
    return () => { off?.(); off = null }
  }, [entered, allow, total, done])

  const V = Math.max(0, now - (startRef.current + startDelayMs))
  const W = allow && entered && now >= startRef.current + startDelayMs
  const palette = useMemo(() => (Array.isArray(colors) ? colors : resolvedTheme === 'dark' ? colors.dark ?? colors.light ?? [] : colors.light ?? colors.dark ?? []), [colors, resolvedTheme])
  const handlers = { onClick, onMouseEnter, onMouseLeave, onPointerEnter, onPointerLeave, onPointerDown, onFocus, onBlur }

  if (done) return <span ref={ref} className={className} style={style} {...handlers}>{renderSettled(L)}</span>
  if (!W) return <span ref={ref} className={className} style={{ ...style, opacity: 0 }} {...handlers}>{renderSettled(L)}</span>

  let H = 0
  const charNode = (ch, key) => {
    const s = reverse ? F - 1 - H : H
    H += 1
    const n = s * letterDelayMs
    if (V < n) return <span key={key} style={{ opacity: 0 }}>{ch}</span>
    if (V < n + D) {
      const c = scrambleColors ? palette[Math.min(1, Math.floor((V - n) / j))] : undefined
      return <span key={key} style={c ? { color: c } : undefined}>{randChar()}</span>
    }
    return <span key={key}>{ch}</span>
  }
  return (
    <span ref={ref} className={className} style={style} {...handlers}>
      {L.map((p, i) => {
        if (p.kind === 'text') {
          return (
            <span key={`text-${i}`}>
              {p.value.split('').map((ch, r) => {
                if (ch === '\n') { H += 1; return <br key={`newline-${i}-${r}`} /> }
                if (ch === ' ') { H += 1; return <span key={`space-${i}-${r}`}> </span> }
                return charNode(ch, `char-${i}-${r}`)
              })}
            </span>
          )
        }
        return (
          <span key={`slot-${i}`} className={p.className}>
            {p.scramble.split('').map((ch, r) => charNode(ch, `slot-char-${i}-${r}`))}
          </span>
        )
      })}
    </span>
  )
}
