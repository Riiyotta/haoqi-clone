// Port of orig module 88106 (header / HUD, hint panel, mobile menu) + scroll-edge shortcuts.
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '../lib/store.js'
import { pointerStore, themeStore, soundStore } from '../lib/shared.js'
import { menuStore, setMenuOpen } from '../lib/menu.js'
import { useHomeLoadingGate } from '../lib/gate.js'
import { scrollEnv, isEditableTarget } from '../lib/scroll.js'
import {
  useIsMobile, useNearBottom, useArrowFullscreenPastThreshold, readArrowFullscreenPastThreshold,
  ARROW_FULLSCREEN_DOM_COLOR_TRANSITION as ARROW_T, useWeatherTemp, useBrowserName,
} from '../lib/hooks.js'
import { useWindowSize } from '../hooks/useWindowSize.js'
import ScrambleText from './ScrambleText.jsx'
import { ThemeToggle, SoundToggle } from './Toggles.jsx'
import RotatingGlobe from './RotatingGlobe.jsx'
import ScrollProgress from './ScrollProgress.jsx'
import GridOverlay from './GridOverlay.jsx'
import TransitionLink from './TransitionLink.jsx'
import { DOTTED_BORDER_BASE, DOTTED_BORDER_BASE_WHITE } from '../lib/dotted.js'
import { usePathname } from '../lib/router.js'
import { goToHomeAnchor } from '../lib/navigation.js'

export { DOTTED_BORDER_BASE, DOTTED_BORDER_BASE_WHITE }

const SELECTED_WORK_SECTION_ID = 'selected-work'
const CONTACT_SECTION_ID = 'contact'
const HINT_KEYS = new Set(['l', 'd', 'a', 's', 't', 'b'])

// orig scrollEnv.useScrollEdgeShortcuts (T / B)
function useScrollEdgeShortcuts() {
  const held = useRef(null)
  useEffect(() => {
    const down = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return
      const k = e.key.toLowerCase()
      if ((k === 't' || k === 'b') && held.current !== k) { held.current = k; scrollEnv.scrollToEdge(k === 't' ? 'top' : 'bottom', 'smooth') }
    }
    const up = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return
      if (held.current === e.key.toLowerCase()) held.current = null
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [])
}

// framer-motion AnimatePresence fade replacement: opacity 0.4s cubic-bezier(.25,1,.5,1), unmount after exit.
function useFadePresence(show, ms = 400) {
  const [mounted, setMounted] = useState(show)
  const [opaque, setOpaque] = useState(false)
  useEffect(() => {
    if (show) {
      setMounted(true)
      let r2 = 0
      const r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => setOpaque(true)) })
      return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
    }
    setOpaque(false)
    const t = setTimeout(() => setMounted(false), ms)
    return () => clearTimeout(t)
  }, [show, ms])
  return { mounted, opaque }
}

export default function Header() {
  const menuOpen = useStore(menuStore, (s) => s.open)
  const gating = useHomeLoadingGate()
  const openedPastRef = useRef(false)
  const [hintCount, setHintCount] = useState(0)
  const hintEnter = useCallback(() => setHintCount((n) => n + 1), [])
  const hintLeave = useCallback(() => setHintCount((n) => Math.max(0, n - 1)), [])
  const hintReset = useCallback(() => setHintCount(0), [])
  const theme = useStore(themeStore, (s) => s.setting)
  const soundOn = useStore(soundStore, (s) => s.on)
  const prevTS = useRef({ theme, soundOn })
  useEffect(() => {
    const p = prevTS.current
    if (p.theme !== theme || p.soundOn !== soundOn) { prevTS.current = { theme, soundOn }; setHintCount((n) => (n > 0 ? 0 : n)) }
  }, [theme, soundOn])
  useEffect(() => { if (!menuOpen) openedPastRef.current = false }, [menuOpen])
  useEffect(() => {
    const on = (e) => {
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey || isEditableTarget(e.target)) return
      const k = e.key.length === 1 ? e.key.toLowerCase() : ''
      if (HINT_KEYS.has(k)) hintReset()
    }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [hintReset])

  const pointer = useStore(pointerStore, (s) => s.x + ',' + s.yUp)
  const { width: q, height: G } = useWindowSize()
  const isMobile = useIsMobile()
  const browser = useBrowserName()
  const past = useArrowFullscreenPastThreshold()
  const dotted = past ? DOTTED_BORDER_BASE_WHITE : DOTTED_BORDER_BASE
  const barBg = menuOpen ? 'bg-l1' : past ? 'bg-white' : 'bg-l1'
  const bar = `h-0.5 ${barBg} absolute transition-all duration-[1200ms] ease-66`
  const menuWhite = menuOpen && openedPastRef.current
  const menuDotted = menuWhite ? DOTTED_BORDER_BASE_WHITE : DOTTED_BORDER_BASE
  const menuToggleCls = `${DOTTED_BORDER_BASE} p-2 text-l1 uppercase cursor-pointer pointer-events-auto ${ARROW_T}`
  const nearBottom = useNearBottom(0.5)
  useScrollEdgeShortcuts()

  const pathname = usePathname()
  // orig `ti`
  const goTo = (anchor) => {
    setMenuOpen(false)
    goToHomeAnchor(anchor)
  }
  useEffect(() => { if (gating) setMenuOpen(false) }, [gating])
  useEffect(() => { if (!isMobile) setMenuOpen(false) }, [isMobile])

  const [px, py] = pointer.split(',').map(Number)
  const cx = Math.round(px * q).toString().padStart(4, '0')
  const cy = Math.round((1 - py) * G).toString().padStart(4, '0')
  const [clock, setClock] = useState('--:--')
  useEffect(() => {
    const tick = () => { const d = new Date(); setClock(`${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`) }
    tick()
    const id = window.setInterval(tick, 60000)
    return () => window.clearInterval(id)
  }, [])
  const year = new Date().getFullYear()
  const temp = useWeatherTemp()
  const tempStr = temp != null ? ` ${temp}°C` : ''
  const hint = useFadePresence(hintCount > 0)

  return (
    <>
      <header className={`z-50 fixed inset-0 flex flex-col justify-between font-mono-2 pointer-events-none ${ARROW_T} ${past ? 'text-white' : 'text-l1'}`}>
        <div className="flex justify-between items-center px-4 lg:px-14 py-4 lg:py-7 text-base">
          <TransitionLink
            href="/"
            dotted
            dottedTone={menuOpen ? 'default' : past ? 'white' : 'default'}
            className={`p-2 font-sans font-bold uppercase pointer-events-auto ${ARROW_T} ${menuOpen ? 'text-l1' : ''}`}
            style={{ fontVariationSettings: '"wght" 700, "wdth" 120' }}
          >
            <ScrambleText text="haoqi" startDelayMs={300} scrambleColors={false} />
            <ScrambleText text=".design" startDelayMs={300} scrambleColors={false} />
          </TransitionLink>
          <div className="hidden lg:flex flex-wrap justify-between items-center gap-x-3 gap-y-2 pointer-events-auto basis-1/2 xl:basis-1/3">
            <button type="button" className={`${dotted} p-2 uppercase cursor-pointer`} onClick={() => goTo(`#${SELECTED_WORK_SECTION_ID}`)}>
              <ScrambleText text="Work" startDelayMs={300} scrambleColors={false} />
            </button>
            <button type="button" className={`${dotted} p-2 uppercase cursor-pointer`} onClick={() => goTo(`#${CONTACT_SECTION_ID}`)}>
              <ScrambleText text="Contact" startDelayMs={300} scrambleColors={false} />
            </button>
            <ThemeToggle
              className={`${dotted} p-2 uppercase cursor-pointer pointer-events-auto`}
              light="THEME[L]" dark="THEME[D]" system="THEME[A]" startDelayMs={300} scrambleColors={false}
              onPointerEnter={hintEnter} onPointerLeave={hintLeave} onPointerDown={hintReset}
            />
            <SoundToggle
              className={`${dotted} p-2 uppercase cursor-pointer pointer-events-auto`}
              startDelayMs={300} scrambleColors={false}
              onPointerEnter={hintEnter} onPointerLeave={hintLeave} onPointerDown={hintReset}
            />
          </div>
          {!gating && (
            <div
              className="lg:hidden flex flex-row justify-end items-center gap-4 col-span-6 p-2 cursor-pointer pointer-events-auto"
              onClick={() => setMenuOpen((open) => { const next = !open; if (next) openedPastRef.current = readArrowFullscreenPastThreshold(); return next })}
            >
              <div className="relative w-6 h-6">
                <div className={`${menuOpen ? 'w-0 delay-150 opacity-0' : 'w-6'} top-1.5 ${bar}`} />
                <div className={`${menuOpen ? 'w-0 opacity-0' : 'w-6 delay-150'} bottom-1.5 ${bar}`} />
                <div className={`${menuOpen ? 'w-6 delay-150' : 'w-0 opacity-0'} right-0 rotate-45 ${bar} top-2.75`} />
                <div className={`${menuOpen ? 'w-6' : 'w-0 opacity-0 delay-150'} right-0 -rotate-45 ${bar} bottom-2.75`} />
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-between px-4 lg:px-14 py-4 lg:py-7">
          {pathname === '/' && nearBottom ? (
            <ScrambleText key="copy" className="p-2 uppercase" text={`Haoqi (c) ${year}`} startDelayMs={300} letterDelayMs={40} scrambleColors={false} />
          ) : (
            <>
              <ScrambleText key="time-mobile" className={`lg:hidden p-2 uppercase ${ARROW_T} ${menuOpen ? 'text-l1' : ''}`} text={`${clock}${tempStr}`} startDelayMs={300} letterDelayMs={40} scrambleColors={false} />
              <ScrambleText key="time-desktop" className="hidden lg:inline p-2 uppercase" text={`GMT+8 CN ${clock}${tempStr}`} startDelayMs={300} letterDelayMs={40} scrambleColors={false} />
            </>
          )}
          <ScrambleText
            className={`${dotted} hidden lg:inline lg:bottom-7 lg:left-1/2 lg:fixed p-2 lg:-translate-x-1/2 cursor-pointer pointer-events-auto`}
            onClick={() => scrollEnv.scrollToTop('smooth')}
            onPointerEnter={hintEnter} onPointerLeave={hintLeave} onPointerDown={hintReset}
            text={`${cx} X ${cy} Y`} startDelayMs={300} letterDelayMs={40} scrambleColors={false}
          />
          {!gating && <RotatingGlobe className="hidden lg:block p-2 shrink-0" />}
          {menuOpen && (
            <>
              <ThemeToggle className={menuToggleCls} light="THEME[L]" dark="THEME[D]" system="THEME[A]" startDelayMs={300} scrambleColors={false} />
              <SoundToggle className={menuToggleCls} startDelayMs={300} scrambleColors={false} />
            </>
          )}
        </div>
        {!gating && <ScrollProgress hidden={menuOpen} />}
      </header>
      {!gating && pathname === '/' && <GridOverlay />}
      {hint.mounted && (
        <div
          className="hidden top-24 right-0 left-0 z-50 fixed lg:flex flex-row-reverse px-4 lg:px-14 w-full pointer-events-none"
          style={{ opacity: hint.opaque ? 1 : 0, transition: 'opacity 0.4s cubic-bezier(0.25, 1, 0.5, 1)' }}
        >
          <div className="*:z-1 *:relative flex flex-col bg-be p-2 font-mono-2 text-l1 xl:basis-1/3 basis-1/2">
            <ScrambleText
              text="Press [L] for light mode, [D] for dark mode, [A] for auto mode, or click THEME. Press [S] to pause or resume background music, or click SOUND; your choice is saved in this browser. [T] scroll to top, [B] scroll to bottom."
              startDelayMs={0} letterDelayMs={10}
            />
            <br />
            <span className="flex flex-row justify-between">
              <ScrambleText text={browser} startDelayMs={200} letterDelayMs={10} />
              <ScrambleText text={`${q} × ${G}`} startDelayMs={200} letterDelayMs={10} />
            </span>
          </div>
        </div>
      )}
      {menuOpen && (
        <div className="lg:hidden z-40 fixed inset-0 flex flex-col justify-center items-start px-6 lg:px-16 py-6 lg:py-8 font-mono-2 text-[10svw] text-l1">
          <TransitionLink href="/" dotted dottedTone={menuWhite ? 'white' : 'default'} className="uppercase" onClick={() => setMenuOpen(false)}>
            <ScrambleText text="Home" startDelayMs={300} />
          </TransitionLink>
          <button type="button" className={`${menuDotted} uppercase text-left cursor-pointer`} onClick={() => goTo(`#${SELECTED_WORK_SECTION_ID}`)}>
            <ScrambleText text="Work" startDelayMs={400} />
          </button>
          <button type="button" className={`${menuDotted} uppercase text-left cursor-pointer`} onClick={() => goTo(`#${CONTACT_SECTION_ID}`)}>
            <ScrambleText text="Contact" startDelayMs={500} />
          </button>
        </div>
      )}
    </>
  )
}
