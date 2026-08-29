import { scaleLinear } from 'd3-scale'
import { cn } from '@/lib/utils'
import { Chip } from './chip'

export interface ComparisonTier {
  label: string
  value: number
  /** Marks the tier the backend actually calls at request time - not
   * necessarily the one labeled "final" (ARCHITECTURE.md section 4.7,
   * decisions.md D-029: bail's fused tier is trained and evaluated but the
   * live endpoint serves XGBoost+TF-IDF instead). */
  served?: boolean
}

export interface MetricComparisonBarProps {
  tiers: ComparisonTier[]
  className?: string
  format?: (v: number) => string
}

/**
 * Baseline -> final progression as ordered horizontal bars (ARCHITECTURE.md
 * section 4.7's "three bars, one metric"). A styled track is enough for a
 * single magnitude bar - no SVG needed here, unlike BarChart's diverging
 * SHAP layout - but the width math still goes through d3-scale rather than
 * a hand-rolled ratio, per CLAUDE.md section 2's "d3 for axis/scale math
 * only" rule.
 */
export function MetricComparisonBar({ tiers, className, format }: MetricComparisonBarProps) {
  const max = Math.max(0.01, ...tiers.map((t) => t.value))
  const scale = scaleLinear().domain([0, max]).range([0, 100]).clamp(true)
  const fmt = format ?? ((v: number) => v.toFixed(4))

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {tiers.map((t) => (
        <div key={t.label} className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-label text-ink-muted">
              {t.label}
              {t.served && <Chip className="px-2 py-0.5">Served</Chip>}
            </span>
            <span className="font-mono text-data tabular-nums text-ink">{fmt(t.value)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-rule/50">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500 ease-[var(--ease-paper)]"
              style={{ width: `${scale(t.value)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
