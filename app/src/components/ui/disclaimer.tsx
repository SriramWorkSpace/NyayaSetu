import { cn } from '@/lib/utils'

/**
 * Persistent and visible on every model output. This is a product rule, not a
 * decoration: no screen shows a prediction without it (ARCHITECTURE.md 2.1).
 */
export function DisclaimerChip({ className }: { className?: string }) {
  return (
    <p
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-dashed border-rule px-3 py-1.5',
        'text-caption uppercase tracking-[0.05em] text-ink-subtle',
        className,
      )}
    >
      Not legal advice. A statistical estimate with a measured error rate.
    </p>
  )
}
