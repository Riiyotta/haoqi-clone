import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import Header from './components/Header.jsx'
import Hero from './components/Hero.jsx'
import About from './components/About.jsx'
import SelectedWork from './components/SelectedWork.jsx'
import Innovate from './components/Innovate.jsx'
import Footer from './components/Footer.jsx'
import CanvasHost from './components/CanvasHost.jsx'
import TransitionCanvas from './webgl/TransitionCanvas.jsx'
import ArticlePage from './pages/ArticlePage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import { useStore } from './lib/store.js'
import { loadStore, lenisRef } from './lib/shared.js'
import { initLenis, scrollEnv, PENDING_SCROLL_ANCHOR_SESSION_KEY } from './lib/scroll.js'
import { initShell } from './lib/shell.js'
import { routerStore, matchRoute } from './lib/router.js'
import './lib/gate.js'

const HOME_TITLE = typeof document !== 'undefined' ? document.title : ''

// orig 82536: content stays invisible until fonts are ready.
function FontsGate({ children }) {
  const ready = useStore(loadStore, (s) => s.fontsReady)
  return <div className={ready ? '' : 'invisible pointer-events-none select-none'} aria-hidden={!ready}>{children}</div>
}

function useContainerEl() {
  const [el, set] = useState(() => scrollEnv.getContainerEl())
  useEffect(() => { set(scrollEnv.getContainerEl()); return scrollEnv.subscribeContainerEl((e) => set(e)) }, [])
  return el
}

// orig 95212 `u`: Lenis wrapper, home only.
function LenisScroller({ children }) {
  const wrapperRef = useRef(null)
  const contentRef = useRef(null)
  useEffect(() => {
    const destroy = initLenis(wrapperRef.current, contentRef.current)
    // pending anchor from another route (orig 4d3f3 ~20206: home component effect on [lenis]); runs under the cover.
    const pending = sessionStorage.getItem(PENDING_SCROLL_ANCHOR_SESSION_KEY)
    if (pending) {
      sessionStorage.removeItem(PENDING_SCROLL_ANCHOR_SESSION_KEY)
      const l = lenisRef.current
      l?.resize()
      requestAnimationFrame(() => { l?.resize(); l?.scrollTo(pending, { lerp: 0.1, force: true }) })
    }
    return destroy
  }, [])
  return (
    <div ref={wrapperRef} className="w-full h-full overflow-y-auto overscroll-contain no-scrollbar lenis">
      <div ref={contentRef}>{children}</div>
    </div>
  )
}

// orig 95212 `c`: plain native-scroll container for every non-home route.
function PlainScroller({ children, pathname }) {
  const ref = useRef(null)
  useEffect(() => {
    scrollEnv.setContainerEl(ref.current)
    return () => scrollEnv.setContainerEl(null)
  }, [])
  // Next.js App Router ScrollAndFocusHandler equivalent: on a push/pop between two plain-container routes, if the new
  // page segment (article > div) is not in view, scroll it into view (lands at scrollTop 96 = article padding-top).
  const prev = useRef(pathname)
  useLayoutEffect(() => {
    if (prev.current === pathname) return
    prev.current = pathname
    const c = ref.current
    // hash target (if it exists) wins, otherwise the segment node — the hash effect in ScrollShell then applies −96
    let hashEl = null
    if (window.location.hash) { try { hashEl = document.getElementById(decodeURIComponent(window.location.hash.slice(1))) } catch {} }
    const seg = hashEl ?? c?.querySelector('article[data-mdx-article] > div')
    if (!c || !seg) return
    const top = seg.getBoundingClientRect().top - c.getBoundingClientRect().top
    if (top >= 0 && top <= c.clientHeight) return
    c.scrollTop = Math.max(0, top + c.scrollTop)
  }, [pathname])
  return <div ref={ref} className="w-full h-full overflow-y-auto overscroll-contain no-scrollbar">{children}</div>
}

// orig 95212 `d`: scroll restoration + hash-on-load + container switch.
function ScrollShell({ pathname, children }) {
  const s = useContainerEl()
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual'
    const toTop = () => {
      if (window.location.hash) return
      if (s) {
        s.scrollTo({ top: 0, left: 0, behavior: 'auto' })
        requestAnimationFrame(() => s.scrollTo({ top: 0, left: 0, behavior: 'auto' }))
        return
      }
      window.scrollTo(0, 0)
      requestAnimationFrame(() => window.scrollTo(0, 0))
    }
    toTop()
    const onShow = (e) => { if (e.persisted) toTop() }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [s])
  useEffect(() => {
    if (!s || !window.location.hash) return
    let id = window.location.hash.slice(1)
    try { id = decodeURIComponent(id) } catch {}
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = document.getElementById(id)
      if (!el) return
      const top = el.getBoundingClientRect().top - s.getBoundingClientRect().top + s.scrollTop - 96
      scrollEnv.lenisScrollTo(Math.max(0, top), { immediate: true })
    }))
  }, [pathname, s])
  return (
    <div className="fixed inset-0 w-full h-full">
      {pathname === '/' ? <LenisScroller>{children}</LenisScroller> : <PlainScroller pathname={pathname}>{children}</PlainScroller>}
    </div>
  )
}

function HomePage() {
  useEffect(() => { document.title = HOME_TITLE }, [])
  return (
    <>
      <Hero />
      <About />
      <SelectedWork />
      <Innovate />
      <Footer />
      <CanvasHost />
    </>
  )
}

export default function App() {
  const pathname = useStore(routerStore, (s) => s.pathname)
  useEffect(() => initShell(), [])
  const route = matchRoute(pathname)
  return (
    <>
      <FontsGate>
        <Header />
        <ScrollShell pathname={pathname}>
          {route.name === 'home' ? <HomePage /> : route.name === 'article' ? <ArticlePage key={route.slug} slug={route.slug} /> : <NotFoundPage />}
        </ScrollShell>
      </FontsGate>
      <TransitionCanvas />
    </>
  )
}
