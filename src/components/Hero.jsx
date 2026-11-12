// Banner section (orig fB banner block + c9 bio with passcode slot).
import ScrambleText from './ScrambleText.jsx'

const PASSCODE_LOCKED_CHAR_CLASS = 'inline-block min-w-[0.62em] text-center text-l1 tabular-nums select-text'
const PASSCODE_LOCKED_SCRAMBLE_CLASS = 'inline-flex items-baseline gap-[0.12em] mx-[0.06em] select-text [&>span]:inline-block [&>span]:min-w-[0.62em] [&>span]:text-center [&>span]:tabular-nums'
const LOCKED = '■■■■■■'

// Locked passcode slot. The unlock route is out of scope for this clone, so activating it is a no-op.
function LockedSlot() {
  const go = () => {}
  return (
    <span
      role="button" tabIndex={0} aria-label="Protected — enter passcode to reveal"
      className="inline-flex items-baseline gap-[0.12em] mx-[0.06em] align-baseline cursor-pointer select-text"
      onClick={go}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go() } }}
    >
      {LOCKED.split('').map((c, i) => <span key={i} aria-hidden className={PASSCODE_LOCKED_CHAR_CLASS}>{c}</span>)}
    </span>
  )
}

const BIO_PARTS = [
  "I'm Haoqi Wen, leading Design Engineering and AI exploration at ",
  { length: 6, scramble: LOCKED, className: PASSCODE_LOCKED_SCRAMBLE_CLASS, settled: <LockedSlot /> },
  ', engineering, and AI at scale. Outside work, I build design tools for team efficiency.',
]

export default function Hero() {
  return (
    <div data-section="banner" className="grid grid-cols-12 grid-rows-[auto_1fr] px-4 lg:px-14 py-18 lg:py-24 w-full h-dvh lg:h-screen">
      <div className="flex flex-col order-2 lg:order-1 lg:grid lg:grid-cols-12 col-span-12 font-mono text-base">
        <span className="hidden lg:block lg:col-span-3 xl:col-span-2 lg:col-start-1 xl:col-start-1 p-2 font-sans font-medium text-[4svw] sm:text-2xl lg:text-3xl leading-tight">
          <ScrambleText text="Design &" startDelayMs={300} letterDelayMs={10} />
          <br />
          <ScrambleText text="Engineering" startDelayMs={300} letterDelayMs={10} />
        </span>
        <ScrambleText
          className="hidden lg:block lg:col-span-3 xl:col-span-2 lg:col-start-4 xl:col-start-5 p-2 text-balance"
          text="Thinking in systems. Designing with care." startDelayMs={300} letterDelayMs={10}
        />
        <ScrambleText
          className="col-span-12 lg:col-span-6 xl:col-span-4 lg:col-start-7 xl:col-start-9 mt-auto lg:mt-0 p-2"
          parts={BIO_PARTS} startDelayMs={300} letterDelayMs={10}
        />
      </div>
      <div
        className="flex flex-col self-end order-1 lg:order-2 col-span-12 px-2 font-bold text-[7.2svw] lg:text-[6svw] 2xl:text-[5svw] xl:text-[5.6svw] uppercase leading-none"
        style={{ fontVariationSettings: '"wdth" 120' }}
      >
        <ScrambleText text="I bring" startDelayMs={300} />
        <ScrambleText text="craft & taste" startDelayMs={500} />
        <ScrambleText text="to digital work" startDelayMs={700} />
      </div>
    </div>
  )
}
