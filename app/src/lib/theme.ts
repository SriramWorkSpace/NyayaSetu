/**
 * Theme controller.
 *
 * The visible behaviour this exists for: flipping the switch wipes the new
 * theme outward *from the switch itself*, rather than cutting the whole page
 * at once. That is a View Transition whose clip-path circle is anchored to the
 * control's live bounding rect, so the animation always starts where the user
 * actually clicked - even if the switch moves.
 */

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'nyayasetu.theme'

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function readStoredTheme(): Theme | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' ? v : null
  } catch {
    // Private mode or blocked storage. Not an error - fall back to system.
    return null
  }
}

export function resolveInitialTheme(): Theme {
  return readStoredTheme() ?? systemTheme()
}

function persist(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme)
  } catch {
    // Storage unavailable. The theme still applies for this session.
  }
}

/** Writes the theme to <html> without any transition. */
export function applyTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (cb: () => void) => { finished: Promise<void> }
}

/**
 * Switch theme, wiping outward from `origin` (the switch element).
 * Falls back to an instant swap when View Transitions are unsupported or the
 * user prefers reduced motion.
 */
export function setTheme(theme: Theme, origin?: Element | null) {
  persist(theme)

  const doc = document as ViewTransitionDocument
  const root = document.documentElement

  if (!doc.startViewTransition || prefersReducedMotion()) {
    applyTheme(theme)
    return
  }

  if (origin) {
    const rect = origin.getBoundingClientRect()
    root.style.setProperty('--wipe-x', `${rect.left + rect.width / 2}px`)
    root.style.setProperty('--wipe-y', `${rect.top + rect.height / 2}px`)
  }
  root.setAttribute('data-wipe', 'active')

  const transition = doc.startViewTransition(() => {
    applyTheme(theme)
  })

  void transition.finished.finally(() => {
    root.removeAttribute('data-wipe')
  })
}
