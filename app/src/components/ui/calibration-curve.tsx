import { scaleLinear } from 'd3-scale'
import { cn } from '@/lib/utils'

export interface CalibrationCurvePoint {
  predicted: number
  observed: number
}

export interface CalibrationCurveProps {
  points: CalibrationCurvePoint[]
  className?: string
}

const SIZE = 220
const PAD = 10

/**
 * Predicted probability against observed outcome rate, quantile-binned on
 * held-out data (ml/reports/bail.json's calibration_points). The dashed
 * diagonal is what perfect calibration would look like - not a real series,
 * just a reference. Hand-rolled SVG, d3-scale for the axis math only
 * (CLAUDE.md section 2).
 */
export function CalibrationCurve({ points, className }: CalibrationCurveProps) {
  const scale = scaleLinear().domain([0, 1]).range([PAD, SIZE - PAD])
  const toX = (v: number) => scale(v)
  const toY = (v: number) => SIZE - scale(v)

  const sorted = [...points].sort((a, b) => a.predicted - b.predicted)
  const pathD = sorted.map((p, i) => `${i === 0 ? 'M' : 'L'} ${toX(p.predicted)} ${toY(p.observed)}`).join(' ')

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="h-auto w-full max-w-[240px]"
        role="img"
        aria-label="Calibration curve: predicted probability against observed outcome rate, against a perfectly-calibrated reference diagonal"
      >
        <line x1={toX(0)} y1={toY(0)} x2={toX(1)} y2={toY(1)} stroke="var(--color-rule)" strokeWidth={1} strokeDasharray="3 3" />
        <line x1={PAD} y1={SIZE - PAD} x2={SIZE - PAD} y2={SIZE - PAD} stroke="var(--color-rule)" strokeWidth={1} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={SIZE - PAD} stroke="var(--color-rule)" strokeWidth={1} />
        <path d={pathD} fill="none" stroke="var(--color-ink)" strokeWidth={1.5} />
        {sorted.map((p) => (
          <circle key={p.predicted} cx={toX(p.predicted)} cy={toY(p.observed)} r={3} fill="var(--color-ink)" />
        ))}
      </svg>
      <div className="flex justify-between text-caption uppercase tracking-[0.05em] text-ink-subtle">
        <span>Predicted 0%</span>
        <span>Predicted 100%</span>
      </div>
    </div>
  )
}
