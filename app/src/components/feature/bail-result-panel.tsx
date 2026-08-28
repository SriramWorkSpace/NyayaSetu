import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { BailPredictRequest, BailPredictResponse } from '@/lib/api-types'
import { StampBadge } from '@/components/ui/stamp-badge'
import { ConfidenceMeter } from '@/components/ui/confidence-meter'
import { BarChart, type BarDatum } from '@/components/ui/bar-chart'
import { DisclaimerChip } from '@/components/ui/disclaimer'
import { PrimaryButton } from '@/components/ui/button'
import { ErrorState, SkeletonBlock } from '@/components/ui/states'
import { Display } from '@/components/ui/typography'

/**
 * The bail Result panel (ARCHITECTURE.md section 4.3): probability as the
 * focal number, ConfidenceMeter, SHAP-style factor bars, a calibration note
 * pulled from /metrics live (never hardcoded), and the live baseline toggle
 * that re-queries /predict/bail/baseline with the same inputs.
 */
export interface BailResultPanelProps {
  request: BailPredictRequest
  response: BailPredictResponse
}

function calibrationNote(
  probability: number,
  points: { predicted: number; observed: number }[] | null | undefined,
): string | null {
  if (!points || points.length === 0) return null
  const nearest = points.reduce((best, p) =>
    Math.abs(p.predicted - probability) < Math.abs(best.predicted - probability) ? p : best,
  )
  return `When this model says ~${Math.round(nearest.predicted * 100)}% confident, it is right about ${Math.round(nearest.observed * 100)}% of the time.`
}

export function BailResultPanel({ request, response }: BailResultPanelProps) {
  const [showBaseline, setShowBaseline] = useState(false)

  const metrics = useQuery({
    queryKey: ['metrics', 'bail'],
    queryFn: () => api.metrics('bail'),
  })

  const baseline = useQuery({
    queryKey: ['predict-bail-baseline', request],
    queryFn: () => api.predictBailBaseline(request),
    enabled: showBaseline,
  })

  const tone = response.outcome === 'granted' ? 'granted' : 'denied'
  const bars: BarDatum[] = response.factors.map((f) => ({
    label: f.name,
    value: f.weight,
    tone: f.direction === 'for_grant' ? 'granted' : 'denied',
  }))
  const note = calibrationNote(response.probability, metrics.data?.calibration_points)

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between gap-4">
        <Display>{(response.probability * 100).toFixed(1)}%</Display>
        <StampBadge tone={tone} size="lg">{`Bail ${response.outcome}`}</StampBadge>
      </div>

      <ConfidenceMeter value={response.probability} label="Model confidence" />

      <div className="flex flex-col gap-3">
        <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">Factors, by weight</span>
        <BarChart data={bars} />
      </div>

      {metrics.isPending && <SkeletonBlock className="h-10 w-full" />}
      {note && (
        <p className="rounded-[var(--radius-input)] border border-rule bg-paper px-4 py-3 text-body text-ink-muted">
          {note}
        </p>
      )}

      <div className="flex flex-col gap-3 border-t border-rule pt-6">
        {!showBaseline ? (
          <PrimaryButton variant="secondary" onClick={() => setShowBaseline(true)}>
            Compare against baseline
          </PrimaryButton>
        ) : (
          <div className="flex flex-col gap-3">
            <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">
              Baseline (logistic regression)
            </span>
            {baseline.isPending && <SkeletonBlock className="h-16 w-full" />}
            {baseline.isError && (
              <ErrorState
                title="Could not load the baseline"
                body="The baseline model did not respond. Try again."
                onRetry={() => baseline.refetch()}
              />
            )}
            {baseline.isSuccess && (
              <div className="flex items-center justify-between rounded-[var(--radius-input)] border border-dashed border-rule px-4 py-3">
                <span className="text-label text-ink-muted">{baseline.data.model_name}</span>
                <span className="font-mono text-data tabular-nums text-ink">
                  {baseline.data.outcome} · {(baseline.data.probability * 100).toFixed(1)}%
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <DisclaimerChip className="self-start" />
    </div>
  )
}
