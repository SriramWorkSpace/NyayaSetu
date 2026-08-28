import type { ReactNode } from 'react'
import { StatPill } from '@/components/ui/stat-pill'

/**
 * The shared skeleton every shell screen opens with: a strip of compact
 * metrics, the title with a date line, then an optional filter row.
 * Consistency here is what lets one component inventory serve six screens.
 */
export interface ScreenHeaderProps {
  title: string
  subtitle?: string
  stats?: { label: string; value: string }[]
  filters?: ReactNode
}

const DATE_LINE = new Intl.DateTimeFormat('en-IN', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

export function ScreenHeader({ title, subtitle, stats, filters }: ScreenHeaderProps) {
  return (
    <header className="mb-8 flex flex-col gap-6">
      {stats && stats.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {stats.map((s) => (
            <StatPill key={s.label} label={s.label} value={s.value} />
          ))}
        </div>
      )}

      <div className="flex flex-col gap-1">
        <h1 className="font-mono text-h1 font-bold tracking-[-0.01em] text-ink">{title}</h1>
        <p className="text-caption uppercase tracking-[0.05em] text-ink-subtle">
          {DATE_LINE.format(new Date())}
          {subtitle ? ` · ${subtitle}` : ''}
        </p>
      </div>

      {filters && <div className="flex flex-wrap items-center gap-2">{filters}</div>}
    </header>
  )
}
