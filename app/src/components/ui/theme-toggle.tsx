import { useEffect, useRef, useState } from 'react'
import { resolveInitialTheme, setTheme, type Theme } from '@/lib/theme'
import './theme-toggle.css'

/**
 * Fixed top-right on every screen. Flipping it wipes the new theme outward
 * from this control (see lib/theme.ts), so the transition visibly originates
 * where the user clicked.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setThemeState] = useState<Theme>(() =>
    typeof document !== 'undefined'
      ? ((document.documentElement.getAttribute('data-theme') as Theme | null) ??
        resolveInitialTheme())
      : 'light',
  )
  const labelRef = useRef<HTMLLabelElement>(null)

  // Follow the OS while the user has not made an explicit choice this session.
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (localStorage.getItem('nyayasetu.theme')) return
      const next: Theme = mq.matches ? 'dark' : 'light'
      setThemeState(next)
      document.documentElement.setAttribute('data-theme', next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const isDark = theme === 'dark'

  function toggle() {
    const next: Theme = isDark ? 'light' : 'dark'
    setThemeState(next)
    setTheme(next, labelRef.current)
  }

  // The positioning class goes on an OUTER element: .toggle-switch sets
  // `position: relative` in its own stylesheet, which would otherwise win over
  // a Tailwind `fixed` utility on the same node by source order.
  return (
    <div className={className}>
      <div className="toggle-switch">
        <label ref={labelRef} className="switch-label" htmlFor="theme-toggle">
          <input
            id="theme-toggle"
            type="checkbox"
            className="checkbox"
            checked={isDark}
            onChange={toggle}
            aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          />
          <span className="slider" />
        </label>
      </div>
    </div>
  )
}
