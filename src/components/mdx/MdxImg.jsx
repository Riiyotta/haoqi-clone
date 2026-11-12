// Port of orig 46318 (MdxImg + zoomable image lightbox).
// framer-motion is not a dependency of this clone, so the shared-layout (layoutId) flight is reproduced with a
// FLIP transform using framer's default layout transition (0.45 s, ease [0.4, 0, 0.1, 1]); backdrop opacity 0.25 s,
// exit opacity 0.25 s, backdrop colour transition 500 ms ease-out — values from the bundle / framer defaults.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useStore } from '../../lib/store.js'
import { themeStore } from '../../lib/shared.js'
import { scrollEnv } from '../../lib/scroll.js'
import { computeBackdrop, cachedBackdrop, defaultBackdrop } from '../../lib/wasm/designUtils.js'

const LAYOUT_EASE = 'cubic-bezier(0.4, 0, 0.1, 1)'
const LAYOUT_MS = 450
const FADE_MS = 250

// Animate `el` from rect `from` to its current layout box (FLIP).
function flip(el, from) {
  const to = el.getBoundingClientRect()
  if (!from || !to.width || !to.height) return
  el.style.transition = 'none'
  el.style.transformOrigin = '0 0'
  el.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`
  void el.offsetWidth
  el.style.transition = `transform ${LAYOUT_MS}ms ${LAYOUT_EASE}`
  el.style.transform = ''
  const done = () => { el.style.transition = ''; el.style.transformOrigin = ''; el.removeEventListener('transitionend', done) }
  el.addEventListener('transitionend', done)
}

function ZoomableImage({ src, alt, width, height, className }) {
  const theme = useStore(themeStore, (s) => s.resolved)
  const [open, setOpen] = useState(false)
  const [present, setPresent] = useState(false)
  const [bg, setBg] = useState(() => defaultBackdrop('dark'))
  const [shown, setShown] = useState(false) // backdrop opacity 0 -> 1
  const [exiting, setExiting] = useState(false)
  const imgRef = useRef(null)
  const overlayImgRef = useRef(null)
  const fromRect = useRef(null)

  const currentBg = useCallback(() => {
    const A = imgRef.current
    const e = defaultBackdrop(theme)
    return A ? cachedBackdrop(A.currentSrc || A.src, theme) ?? e : e
  }, [theme])
  const precompute = useCallback(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    const A = imgRef.current
    if (A?.complete) computeBackdrop(A, theme)
  }, [theme])

  useLayoutEffect(() => { if (open) setBg(currentBg()) }, [open, currentBg])
  useEffect(() => {
    if (!open) return
    const A = imgRef.current
    if (!A) return
    let dead = false
    computeBackdrop(A, theme).then((c) => { if (!dead && c) setBg(c) })
    return () => { dead = true }
  }, [open, theme, src])
  useEffect(() => {
    if (!open) return
    const onKey = (A) => { if (A.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    const e = scrollEnv.getContainerEl()
    const t = e?.style.overflow ?? ''
    if (e) e.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); if (e) e.style.overflow = t }
  }, [open])

  // enter: mount overlay, fly the image from its in-flow box to the centred box
  useLayoutEffect(() => {
    if (!open) return
    setPresent(true)
    setExiting(false)
  }, [open])
  useLayoutEffect(() => {
    if (!present || !open) return
    const el = overlayImgRef.current
    if (!el) return
    const run = () => flip(el, fromRect.current)
    if (el.complete && el.naturalWidth) run()
    else el.addEventListener('load', run, { once: true })
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [present, open])

  // exit: fade overlay 0.25 s, fly the in-flow image back from the overlay box
  useLayoutEffect(() => {
    if (open || !present) return
    const ov = overlayImgRef.current
    const from = ov?.getBoundingClientRect()
    setExiting(true)
    const img = imgRef.current
    if (img && from) flip(img, from)
    const t = setTimeout(() => {
      setPresent(false); setShown(false); setExiting(false)
      setBg(defaultBackdrop(theme)) // onExitComplete
    }, FADE_MS)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  return (
    <>
      <img
        ref={imgRef}
        src={src}
        alt={alt}
        width={width}
        height={height}
        crossOrigin="anonymous"
        loading="lazy"
        decoding="async"
        onLoad={precompute}
        onMouseEnter={precompute}
        onClick={() => {
          fromRect.current = imgRef.current?.getBoundingClientRect() ?? null
          setBg(currentBg())
          setOpen(true)
        }}
        style={{ opacity: open ? 0 : 1 }}
        className={`block w-full h-auto cursor-zoom-in select-none ${className ?? ''}`}
      />
      {present && createPortal(
        <div
          className="z-1000 fixed inset-0 isolate flex justify-center items-center overflow-hidden cursor-zoom-out"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={alt}
          style={{ opacity: exiting ? 0 : 1, transition: exiting ? `opacity ${FADE_MS}ms ease` : undefined }}
        >
          <div
            aria-hidden
            className="z-0 absolute inset-0 backface-hidden"
            style={{ backgroundColor: bg, opacity: shown ? 1 : 0, transition: `background-color 500ms ease-out, opacity ${FADE_MS}ms ease` }}
          />
          <img
            ref={overlayImgRef}
            src={src}
            alt={alt}
            crossOrigin="anonymous"
            className="z-10 relative max-w-[92vw] max-h-[92vh] object-contain pointer-events-none select-none backface-hidden"
          />
        </div>,
        document.body,
      )}
    </>
  )
}

export default function MdxImg({ src, alt, width, height, className, title }) {
  const g = width != null ? Number(width) : NaN
  const i = height != null ? Number(height) : NaN
  const s = typeof title === 'string' ? title.trim() : ''
  return (
    <span data-mdx-figure="true" className="my-6 block w-full">
      <ZoomableImage
        src={typeof src === 'string' ? src : ''}
        alt={alt ?? ''}
        width={Number.isFinite(g) && g > 0 ? g : undefined}
        height={Number.isFinite(i) && i > 0 ? i : undefined}
        className={['border border-line bg-[rgba(var(--label-d),0.05)]', className].filter(Boolean).join(' ')}
      />
      {s ? <span data-mdx-caption="true" className="mt-1.5 block text-center text-[14px] leading-relaxed text-l2">{s}</span> : null}
    </span>
  )
}
