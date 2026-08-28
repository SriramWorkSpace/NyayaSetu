import { useState } from 'react'
import { ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/motion'

/**
 * The startup screen's hand-off control.
 *
 * Retuned from components/ui/lets-work-section.tsx (kept verbatim there as the
 * reference implementation): heading lifts away, the arrow flies off-corner,
 * the ring scales out, and the app shell takes over. Same interaction, none of
 * that component's placeholder contact details. See decisions.md D-007.
 */
export interface EnterSuiteProps {
  onEnter: () => void
  className?: string
}

export function EnterSuite({ onEnter, className }: EnterSuiteProps) {
  const [hovered, setHovered] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const reduced = usePrefersReducedMotion()

  function handleEnter() {
    if (leaving) return
    if (reduced) {
      onEnter()
      return
    }
    setLeaving(true)
    // Let the exit play out before the route changes.
    window.setTimeout(onEnter, 620)
  }

  const lift = hovered && !leaving

  return (
    <button
      type="button"
      onClick={handleEnter}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label="Enter NyayaSetu"
      className={cn('group relative flex flex-col items-center gap-6', className)}
      style={{ pointerEvents: leaving ? 'none' : 'auto' }}
    >
      <span
        className="font-mono text-h1 uppercase tracking-[0.18em] text-ink transition-all duration-700 ease-[var(--ease-paper)] sm:text-display sm:tracking-[0.14em]"
        style={{
          opacity: leaving ? 0 : 1,
          transform: leaving ? 'translateY(-40px) scale(0.95)' : 'translateY(0) scale(1)',
        }}
      >
        <span className="block overflow-hidden">
          <span
            className="block transition-transform duration-700 ease-[var(--ease-paper)]"
            style={{ transform: lift ? 'translateY(-8%)' : 'translateY(0)' }}
          >
            Enter the
          </span>
        </span>
        <span className="block overflow-hidden">
          <span
            className="block text-ink-subtle transition-transform delay-75 duration-700 ease-[var(--ease-paper)]"
            style={{ transform: lift ? 'translateY(-8%)' : 'translateY(0)' }}
          >
            Suite
          </span>
        </span>
      </span>

      <span className="relative mt-2 flex size-16 items-center justify-center sm:size-20">
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full border transition-all ease-out"
          style={{
            borderColor: lift || leaving ? 'var(--color-ink)' : 'var(--color-rule)',
            backgroundColor: lift ? 'var(--color-ink)' : 'transparent',
            transform: leaving ? 'scale(3)' : lift ? 'scale(1.1)' : 'scale(1)',
            opacity: leaving ? 0 : 1,
            transitionDuration: leaving ? '700ms' : '500ms',
          }}
        />
        <ArrowUpRight
          strokeWidth={1.5}
          className="size-6 transition-all ease-[var(--ease-paper)] sm:size-7"
          style={{
            transform: leaving
              ? 'translate(100px, -100px) scale(0.5)'
              : lift
                ? 'translate(2px, -2px)'
                : 'translate(0, 0)',
            opacity: leaving ? 0 : 1,
            color: lift ? 'var(--color-paper)' : 'var(--color-ink)',
            transitionDuration: leaving ? '600ms' : '500ms',
          }}
        />
      </span>

      {/* Hairlines that stretch on hover and retract on exit. */}
      <span
        aria-hidden
        className="absolute top-1/2 -left-10 h-px w-8 -translate-y-1/2 bg-rule transition-all duration-500 sm:-left-20 sm:w-14"
        style={{
          transform: leaving ? 'scaleX(0) translateX(-20px)' : lift ? 'scaleX(1.5)' : 'scaleX(1)',
          opacity: leaving ? 0 : lift ? 1 : 0.5,
        }}
      />
      <span
        aria-hidden
        className="absolute top-1/2 -right-10 h-px w-8 -translate-y-1/2 bg-rule transition-all duration-500 sm:-right-20 sm:w-14"
        style={{
          transform: leaving ? 'scaleX(0) translateX(20px)' : lift ? 'scaleX(1.5)' : 'scaleX(1)',
          opacity: leaving ? 0 : lift ? 1 : 0.5,
        }}
      />
    </button>
  )
}
