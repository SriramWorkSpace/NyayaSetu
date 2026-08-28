import { useReducedMotion } from 'motion/react'

/**
 * Single gate for every animation in the app (CLAUDE.md 5.4).
 * Components read this rather than calling useReducedMotion directly, so the
 * rule is enforced in one place and is greppable.
 */
export function usePrefersReducedMotion(): boolean {
  return useReducedMotion() ?? false
}

/** Page transition: a sheet of paper lifting and settling. */
export const pageVariants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
}

export const pageTransition = {
  duration: 0.22,
  ease: [0.16, 1, 0.3, 1] as const,
}
