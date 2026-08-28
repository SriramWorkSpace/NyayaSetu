import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Extracted-field cards for Scan Document's two-column grid (ARCHITECTURE.md
 * section 4.4): a label, a value, and a per-field confidence indicator.
 */
export interface StatCardProps {
  label: string
  value: ReactNode
  confidence?: number
  className?: string
}

export function StatCard({ label, value, confidence, className }: StatCardProps) {
  const low = typeof confidence === 'number' && confidence < 0.5
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-rule bg-paper-raised p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">{label}</span>
        {typeof confidence === 'number' && (
          <span className={cn('font-mono text-[11px] tabular-nums', low ? 'text-caution' : 'text-ink-subtle')}>
            {Math.round(confidence * 100)}%
          </span>
        )}
      </div>
      <div className={cn('font-mono text-data text-ink', !value && 'text-ink-subtle')}>{value || 'Not found'}</div>
    </div>
  )
}
