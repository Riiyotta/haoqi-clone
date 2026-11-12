// Port of orig 80894: transition Link. Same-path click scrolls to top; otherwise runs the dot-iris route transition.
import { usePathname } from '../lib/router.js'
import { startNavigation } from '../lib/navigation.js'
import { scrollEnv } from '../lib/scroll.js'
import { DOTTED_BORDER_BASE, DOTTED_BORDER_BASE_WHITE } from '../lib/dotted.js'

export default function TransitionLink({ href, children, className, dotted = false, dottedTone = 'default', style, onClick, ...rest }) {
  const pathname = usePathname()
  const base = dottedTone === 'white' ? DOTTED_BORDER_BASE_WHITE : DOTTED_BORDER_BASE
  const cls = [dotted && base, className].filter(Boolean).join(' ')
  return (
    <a
      href={href}
      className={cls || undefined}
      style={style}
      onClick={(e) => {
        if (typeof onClick === 'function') onClick(e)
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.altKey || e.ctrlKey || e.shiftKey) return
        e.preventDefault()
        if (!href) return
        if (href === pathname) return void scrollEnv.lenisScrollTo(0, { lerp: 0.1 })
        startNavigation(href)
      }}
      {...rest}
    >
      {children}
    </a>
  )
}
