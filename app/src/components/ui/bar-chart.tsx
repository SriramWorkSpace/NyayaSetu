import { scaleLinear } from 'd3-scale'
import { cn } from '@/lib/utils'

/**
 * Hand-rolled SVG bar chart. d3-scale for axis math only, no chart library
 * rendering (ARCHITECTURE.md section 3.5): the visual defaults of an
 * off-the-shelf chart library would fight this token system, and this is the
 * one chart shape the app actually needs - signed horizontal bars diverging
 * from a zero line, for SHAP-style factor attribution.
 */
export interface BarDatum {
  label: string
  value: number
  /** Overrides the sign-based colour when set (e.g. a stamp tone). */
  tone?: 'granted' | 'denied'
}

export interface BarChartProps {
  data: BarDatum[]
  className?: string
  /** Value formatter for the trailing number, defaults to +/-0.00 */
  format?: (v: number) => string
}

export function BarChart({ data, className, format }: BarChartProps) {
  const max = Math.max(0.01, ...data.map((d) => Math.abs(d.value)))
  const scale = scaleLinear().domain([0, max]).range([0, 50]).clamp(true)
  const fmt = format ?? ((v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}`)

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {data.map((d) => {
        const width = scale(Math.abs(d.value))
        const positive = d.value >= 0
        const tone = d.tone ?? (positive ? 'granted' : 'denied')
        return (
          <div key={d.label} className="flex items-start gap-3">
            <span className="w-[38%] shrink-0 text-label leading-snug text-ink-muted">{d.label}</span>
            <div className="relative mt-1.5 h-4 flex-1">
              <span aria-hidden className="absolute left-1/2 top-0 h-full w-px bg-rule" />
              <span
                aria-hidden
                className={cn(
                  'absolute top-1/2 h-2 -translate-y-1/2 rounded-[2px] transition-[width] duration-500 ease-[var(--ease-paper)]',
                  tone === 'granted' ? 'bg-granted/70' : 'bg-denied/70',
                )}
                style={
                  positive
                    ? { left: '50%', width: `${width}%` }
                    : { right: '50%', width: `${width}%` }
                }
              />
            </div>
            <span className="mt-1 w-14 shrink-0 text-right font-mono text-data tabular-nums text-ink">
              {fmt(d.value)}
            </span>
          </div>
        )
      })}
    </div>
  )
}
