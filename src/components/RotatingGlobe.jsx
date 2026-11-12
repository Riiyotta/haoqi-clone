// Port of orig 54262.
import { useHasEnteredViewport, useReducedMotion } from '../lib/hooks.js'

const ARC = 'M24 23C11.8497 23 2 18.0751 2 12C2 5.92487 11.8497 1 24 1'
const S = { stroke: 'currentColor', strokeWidth: 1, vectorEffect: 'non-scaling-stroke' }

export default function RotatingGlobe({ className }) {
  const { ref, hasEnteredViewport: o } = useHasEnteredViewport({ threshold: 0.1 })
  const reduced = useReducedMotion()
  return (
    <div
      ref={ref}
      className={className}
      style={reduced ? undefined : { opacity: +!!o, transitionProperty: 'opacity', transitionDuration: '300ms', transitionTimingFunction: 'ease', transitionDelay: o ? '600ms' : '0ms', willChange: 'opacity' }}
    >
      <svg width="48" height="24" viewBox="0 0 48 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <ellipse {...S} strokeWidth={1} cx="24" cy="12" rx="22" ry="11" />
        <path {...S} d="M2 12H46" />
        {reduced || !o
          ? <path {...S} d={ARC} />
          : Array.from({ length: 6 }, (_, i) => (
              <g key={`m-${i}`} transform="translate(24 12)">
                <g>
                  <animateTransform attributeName="transform" type="scale" dur="2600ms" repeatCount="indefinite" values="1 1;-1 1" keyTimes="0;1" calcMode="spline" keySplines="0.42 0 0.58 1" begin={`-${(2600 * i) / 6}ms`} />
                  <path {...S} d={ARC} transform="translate(-24 -12)" />
                </g>
              </g>
            ))}
      </svg>
    </div>
  )
}
