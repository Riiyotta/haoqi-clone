// Ports of orig 95428 (ASCIIThemeToggle) and 96716 (ASCIISoundToggle).
import { useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store.js'
import { themeStore, soundStore } from '../lib/shared.js'
import { setTheme, cycleTheme, setSoundEnabled } from '../lib/shell.js'
import { isEditableTarget } from '../lib/scroll.js'
import ScrambleText from './ScrambleText.jsx'

export function ThemeToggle({ light = '1', dark = '2', system = '3', onClick, onKeyDown, onMouseEnter, onMouseLeave, onFocus, onBlur, startDelayMs = 600, scrambleColors = true, ...rest }) {
  const theme = useStore(themeStore, (s) => s.setting)
  const [clicked, setClicked] = useState(false)
  useEffect(() => {
    const on = (e) => {
      if (e.defaultPrevented || e.repeat || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return
      const k = e.key.toLowerCase()
      if (k === 'l') { setClicked(true); setTheme('light') }
      else if (k === 'd') { setClicked(true); setTheme('dark') }
      else if (k === 'a') { setClicked(true); setTheme('system') }
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
  const label = theme === 'light' ? light : theme === 'dark' ? dark : system
  return (
    <span
      role="button" tabIndex={0} aria-label={`Theme: ${theme}`}
      onClick={(e) => { onClick?.(e); if (!e.defaultPrevented) { setClicked(true); cycleTheme() } }}
      onKeyDown={(e) => { onKeyDown?.(e); if (!e.defaultPrevented && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setClicked(true); cycleTheme() } }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onFocus={onFocus} onBlur={onBlur}
      {...rest}
    >
      <ScrambleText key={theme} text={label} startDelayMs={clicked ? 100 : startDelayMs} scrambleColors={scrambleColors} />
    </span>
  )
}

const SPIN = ['|', '/', '-', '\\']
export function SoundToggle({ onClick, onKeyDown, onMouseEnter, onMouseLeave, onFocus, onBlur, className, startDelayMs = 600, scrambleColors = true, ...rest }) {
  const on = useStore(soundStore, (s) => s.on)
  const [clicked, setClicked] = useState(false)
  const [frame, setFrame] = useState(0)
  const [gen, setGen] = useState(0)
  const first = useRef(true)
  useEffect(() => {
    if (first.current) { first.current = false; return }
    setGen((g) => g + 1)
  }, [on])
  useEffect(() => {
    if (!on) { setFrame(0); return }
    const id = window.setInterval(() => setFrame((f) => (f + 1) % SPIN.length), 130)
    return () => window.clearInterval(id)
  }, [on])
  const delay = clicked ? 100 : startDelayMs
  return (
    <span
      role="button" tabIndex={0}
      aria-label={on ? 'Sound playing, click to pause' : 'Sound paused, click to play'}
      aria-pressed={on}
      onClick={(e) => { onClick?.(e); if (!e.defaultPrevented) { setClicked(true); setSoundEnabled(!on) } }}
      onKeyDown={(e) => { onKeyDown?.(e); if (!e.defaultPrevented && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); setClicked(true); setSoundEnabled(!on) } }}
      onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave} onFocus={onFocus} onBlur={onBlur}
      className={`inline-flex shrink-0 items-baseline gap-0 ${className ?? ''} normal-case`}
      {...rest}
    >
      {on
        ? <ScrambleText key={`sound-on-${gen}`} text={`SOUND[${SPIN[frame]}]`} startDelayMs={delay} letterDelayMs={80} scrambleColors={scrambleColors} />
        : <ScrambleText key={`sound-off-${gen}`} text={'SOUND[·]'} startDelayMs={delay} letterDelayMs={80} scrambleColors={scrambleColors} />}
    </span>
  )
}
