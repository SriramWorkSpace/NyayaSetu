import { cn } from '@/lib/utils'

/**
 * The compact metric strip along the top of each screen.
 * Label in Special Elite (written), value in Space Mono (measured).
 */
export interface StatPillProps {
  label: string
  value: string
  className?: string
}

export function StatPill({ label, value, className }: StatPillProps) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-2 rounded-full border border-rule bg-paper-raised px-3 py-1.5',
        className,
      )}
    >
      <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">{label}</span>
      <span className="font-mono text-data tabular-nums text-ink">{value}</span>
    </div>
  )
}
