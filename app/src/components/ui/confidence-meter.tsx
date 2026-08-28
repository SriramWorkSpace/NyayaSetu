import { cn } from '@/lib/utils'

/**
 * Confidence as a ruled gauge rather than a filled progress track.
 * A filled bar reads as "progress toward a goal"; this is a measurement, so it
 * is drawn as ticks with a single indicator needle.
 */
export interface ConfidenceMeterProps {
  /** 0 to 1. */
  value: number
  label?: string
  className?: string
}

const TICKS = 40

export function ConfidenceMeter({ value, label = 'Confidence', className }: ConfidenceMeterProps) {
  const clamped = Math.min(1, Math.max(0, value))
  const active = Math.round(clamped * TICKS)

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-baseline justify-between">
        <span className="text-caption uppercase tracking-[0.05em] text-ink-muted">{label}</span>
        <span className="font-mono text-data tabular-nums text-ink">
          {(clamped * 100).toFixed(1)}%
        </span>
      </div>

      <div
        role="meter"
        aria-valuenow={Math.round(clamped * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className="flex h-6 items-end gap-[2px]"
      >
        {Array.from({ length: TICKS }, (_, i) => (
          <span
            key={i}
            aria-hidden
            className={cn(
              'flex-1 rounded-[1px] transition-[height,background-color] duration-300 ease-[var(--ease-paper)]',
              i % 5 === 0 ? 'h-full' : 'h-2/3',
              i < active ? 'bg-ink' : 'bg-rule',
            )}
            style={{ transitionDelay: `${Math.min(i, 20) * 12}ms` }}
          />
        ))}
      </div>
    </div>
  )
}
