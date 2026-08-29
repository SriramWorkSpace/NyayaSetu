import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, ApiError, ApiUnreachableError } from '@/lib/api'
import { ScreenHeader } from '@/components/feature/screen-header'
import { FloatingCard } from '@/components/ui/floating-card'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { MetricComparisonBar } from '@/components/ui/metric-comparison-bar'
import { CalibrationCurve } from '@/components/ui/calibration-curve'
import { DisclaimerChip } from '@/components/ui/disclaimer'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/ui/states'
import { Caption, Data } from '@/components/ui/typography'
import type { MetricModule, MetricPoint, ModuleMetrics } from '@/lib/api-types'

/**
 * The Model Insights screen (ARCHITECTURE.md section 4.7): the DS-transparency
 * surface this project's whole priority order (CLAUDE.md section 1) exists to
 * justify. Everything a number appears on comes from a live /metrics/{module}
 * call at render time - retraining a model and restarting the backend must
 * change this screen with zero frontend edits (CLAUDE.md section 7's literal
 * claim). The per-module config below supplies labels, which tier(s) to
 * compare, and which metric_name feeds which cell - never a value.
 */

const MODULES: { value: MetricModule; label: string }[] = [
  { value: 'bail', label: 'Bail' },
  { value: 'qa', label: 'QA' },
  { value: 'summarization', label: 'Summarize' },
  { value: 'retrieval', label: 'Retrieval' },
  { value: 'ner', label: 'NER' },
]

// Formatting only - which words a metric_name renders as. Never a value
// source (CLAUDE.md section 7: no metric is ever hardcoded into the UI).
const METRIC_LABELS: Record<string, string> = {
  f1: 'F1',
  f1_xgboost_tfidf: 'F1',
  pr_auc: 'PR-AUC',
  pr_auc_xgboost_tfidf: 'PR-AUC',
  exact_match: 'Exact Match',
  rouge1: 'ROUGE-1',
  rouge2: 'ROUGE-2',
  rougeL: 'ROUGE-L',
  precision_at_5: 'Precision@5',
  recall_at_5: 'Recall@5',
  mrr: 'MRR',
  minilm_at_comparison_scale_precision_at_5: 'Precision@5',
  minilm_at_comparison_scale_recall_at_5: 'Recall@5',
  minilm_at_comparison_scale_mrr: 'MRR',
  entity_f1: 'Entity F1 (overall)',
  entity_f1_court: 'Entity F1 - Court',
  entity_f1_party: 'Entity F1 - Party',
  entity_f1_date: 'Entity F1 - Date',
  entity_f1_ipc_section: 'Entity F1 - IPC Section',
  demographic_parity_gap: 'Demographic Parity Gap',
}

function prettyMetric(metricName: string): string {
  return METRIC_LABELS[metricName] ?? metricName.replace(/_/g, ' ')
}

function findMetric(points: MetricPoint[], metricName: string): number | null {
  return points.find((p) => p.metric_name === metricName)?.value ?? null
}

interface Cell {
  columnLabel: string
  metricName: string
  source: 'baseline' | 'final'
  /** The tier `/predict`, `/qa/extract`, `/summarize`, `/search/precedent`,
   * or `/scan/extract` actually calls - see each module's note() below for
   * why this isn't always "final" (decisions.md D-029). */
  served?: boolean
}

interface ModuleConfig {
  comparison: { label: string; metricName: string; source: 'baseline' | 'final'; served?: boolean }[]
  tableRows: { rowLabel: string; cells: Cell[] }[]
  note: (data: ModuleMetrics) => string
}

const CONFIG: Record<MetricModule, ModuleConfig> = {
  bail: {
    comparison: [
      { label: 'Baseline - Logistic Regression', metricName: 'f1', source: 'baseline' },
      { label: 'XGBoost + TF-IDF', metricName: 'f1_xgboost_tfidf', source: 'baseline', served: true },
      { label: 'InLegalBERT-fused (trained, not served)', metricName: 'f1', source: 'final' },
    ],
    tableRows: [
      {
        rowLabel: 'F1',
        cells: [
          { columnLabel: 'Baseline', metricName: 'f1', source: 'baseline' },
          { columnLabel: 'XGBoost + TF-IDF', metricName: 'f1_xgboost_tfidf', source: 'baseline', served: true },
          { columnLabel: 'Fused', metricName: 'f1', source: 'final' },
        ],
      },
      {
        rowLabel: 'PR-AUC',
        cells: [
          { columnLabel: 'Baseline', metricName: 'pr_auc', source: 'baseline' },
          { columnLabel: 'XGBoost + TF-IDF', metricName: 'pr_auc_xgboost_tfidf', source: 'baseline', served: true },
          { columnLabel: 'Fused', metricName: 'pr_auc', source: 'final' },
        ],
      },
    ],
    note: () =>
      "Three tiers, all trained in-house on IndianBailJudgments-1200, no generative AI in this measured path. /predict/bail actually serves XGBoost + TF-IDF (decisions.md D-029): better PR-AUC and calibration than the InLegalBERT-fused tier, which improves F1 only marginally while regressing both. The fused model is trained and evaluated here, not discarded, but a live prediction does not run on it.",
  },
  qa: {
    comparison: [
      { label: 'Baseline - TF-IDF similarity', metricName: 'f1', source: 'baseline' },
      { label: 'Final - InLegalBERT (fine-tuned)', metricName: 'f1', source: 'final', served: true },
    ],
    tableRows: [
      {
        rowLabel: 'Exact Match',
        cells: [
          { columnLabel: 'Baseline', metricName: 'exact_match', source: 'baseline' },
          { columnLabel: 'Final', metricName: 'exact_match', source: 'final', served: true },
        ],
      },
      {
        rowLabel: 'F1',
        cells: [
          { columnLabel: 'Baseline', metricName: 'f1', source: 'baseline' },
          { columnLabel: 'Final', metricName: 'f1', source: 'final', served: true },
        ],
      },
    ],
    note: () =>
      "Fine-tuned in-house on IndianBailJudgments-1200's legal_issues/judgment_reason pairs, no generative AI. Gold spans are a semantic-similarity proxy, not hand-annotated ground truth (MODEL_CARD_qa.md). Real answers on the live retrieval corpus's longer documents and naturally-phrased questions score materially lower than this held-out number - the per-answer score shown in the Ask flow reflects that honestly.",
  },
  summarization: {
    comparison: [
      { label: 'Baseline - position + length heuristic', metricName: 'rouge1', source: 'baseline' },
      { label: 'Final - trained sentence classifier', metricName: 'rouge1', source: 'final', served: true },
    ],
    tableRows: [
      {
        rowLabel: 'ROUGE-1',
        cells: [
          { columnLabel: 'Baseline', metricName: 'rouge1', source: 'baseline' },
          { columnLabel: 'Final', metricName: 'rouge1', source: 'final', served: true },
        ],
      },
      {
        rowLabel: 'ROUGE-2',
        cells: [
          { columnLabel: 'Baseline', metricName: 'rouge2', source: 'baseline' },
          { columnLabel: 'Final', metricName: 'rouge2', source: 'final', served: true },
        ],
      },
      {
        rowLabel: 'ROUGE-L',
        cells: [
          { columnLabel: 'Baseline', metricName: 'rougeL', source: 'baseline' },
          { columnLabel: 'Final', metricName: 'rougeL', source: 'final', served: true },
        ],
      },
    ],
    note: () =>
      'Extractive only - every sentence in a summary is copied verbatim from the source judgment, never generated (decisions.md D-008).',
  },
  retrieval: {
    comparison: [
      {
        label: 'Baseline - MiniLM (fair comparison scale)',
        metricName: 'minilm_at_comparison_scale_precision_at_5',
        source: 'baseline',
        served: true,
      },
      { label: 'InLegalBERT (frozen, same scale)', metricName: 'precision_at_5', source: 'final' },
    ],
    tableRows: [
      {
        rowLabel: 'Precision@5',
        cells: [
          { columnLabel: 'MiniLM (comparison scale)', metricName: 'minilm_at_comparison_scale_precision_at_5', source: 'baseline', served: true },
          { columnLabel: 'InLegalBERT', metricName: 'precision_at_5', source: 'final' },
        ],
      },
      {
        rowLabel: 'Recall@5',
        cells: [
          { columnLabel: 'MiniLM (comparison scale)', metricName: 'minilm_at_comparison_scale_recall_at_5', source: 'baseline', served: true },
          { columnLabel: 'InLegalBERT', metricName: 'recall_at_5', source: 'final' },
        ],
      },
      {
        rowLabel: 'MRR',
        cells: [
          { columnLabel: 'MiniLM (comparison scale)', metricName: 'minilm_at_comparison_scale_mrr', source: 'baseline', served: true },
          { columnLabel: 'InLegalBERT', metricName: 'mrr', source: 'final' },
        ],
      },
    ],
    note: (data) => {
      const p5 = findMetric(data.baseline, 'precision_at_5')
      return `/search/precedent actually serves MiniLM at the full 10,000-document production scale${p5 !== null ? ` - Precision@5 ${p5.toFixed(4)} there` : ''}, a separate, larger run from the fairly-matched comparison above (MODEL_CARD_retrieval.md) - the two are not directly comparable point-for-point. No labeled query-relevance judgments exist for this corpus; every number here is a self-retrieval proxy (does a chunk retrieve siblings of its own document), not measured legal relevance.`
    },
  },
  ner: {
    comparison: [
      { label: 'Baseline - regex heuristic (eval only)', metricName: 'entity_f1', source: 'baseline' },
      { label: 'Final - trained spaCy NER', metricName: 'entity_f1', source: 'final', served: true },
    ],
    tableRows: [
      {
        rowLabel: 'Entity F1 (overall)',
        cells: [
          { columnLabel: 'Baseline', metricName: 'entity_f1', source: 'baseline' },
          { columnLabel: 'Final', metricName: 'entity_f1', source: 'final', served: true },
        ],
      },
      {
        rowLabel: 'Court',
        cells: [
          { columnLabel: 'Baseline', metricName: 'entity_f1_court', source: 'baseline' },
          { columnLabel: 'Final', metricName: 'entity_f1_court', source: 'final', served: true },
        ],
      },
      {
        rowLabel: 'Party',
        cells: [
          { columnLabel: 'Baseline', metricName: 'entity_f1_party', source: 'baseline' },
          { columnLabel: 'Final', metricName: 'entity_f1_party', source: 'final', served: true },
        ],
      },
      {
        rowLabel: 'Date',
        cells: [
          { columnLabel: 'Baseline', metricName: 'entity_f1_date', source: 'baseline' },
          { columnLabel: 'Final', metricName: 'entity_f1_date', source: 'final', served: true },
        ],
      },
      {
        rowLabel: 'IPC Section',
        cells: [
          { columnLabel: 'Baseline', metricName: 'entity_f1_ipc_section', source: 'baseline' },
          { columnLabel: 'Final', metricName: 'entity_f1_ipc_section', source: 'final', served: true },
        ],
      },
    ],
    note: () =>
      'Trained and evaluated on synthetically assembled text in a rigid template (MODEL_CARD_ner.md) - these near-perfect scores describe that template, not real scanned-document accuracy, which is materially lower (decisions.md D-030). case_number is never trained at all; it stays a standalone regex at serving time.',
  },
}

function resolve(source: 'baseline' | 'final', metricName: string, data: ModuleMetrics): number | null {
  return findMetric(source === 'baseline' ? data.baseline : data.final, metricName)
}

/**
 * Split out so `data` is a required, non-optional prop rather than a value
 * narrowed off `query.isSuccess` inside the parent - TanStack Query narrows
 * `query.data` itself on `query.isSuccess`, not a variable it was copied
 * into, so this is the cleaner fix over a non-null assertion.
 */
function ModuleMetricsView({ module, data }: { module: MetricModule; data: ModuleMetrics }) {
  const config = CONFIG[module]

  if (data.last_trained === null) {
    return (
      <FloatingCard className="p-2">
        <EmptyState title="Not yet trained" body="This module has no reports on disk yet - train it, then restart the backend." />
      </FloatingCard>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <FloatingCard className="flex flex-col gap-4 p-6">
        <Caption>Baseline to final</Caption>
        <MetricComparisonBar
          tiers={config.comparison.map((t) => ({
            label: t.label,
            value: resolve(t.source, t.metricName, data) ?? 0,
            served: t.served,
          }))}
        />
      </FloatingCard>

      <FloatingCard className="overflow-x-auto p-6">
        <Caption className="mb-4 block">Full metric table</Caption>
        <table className="w-full min-w-[420px] border-collapse text-left">
          <tbody>
            {config.tableRows.map((row) => (
              <tr key={row.rowLabel} className="border-b border-rule last:border-b-0">
                <td className="py-2.5 pr-4 align-top text-label text-ink-muted">{row.rowLabel}</td>
                {row.cells.map((cell) => {
                  const value = resolve(cell.source, cell.metricName, data)
                  return (
                    <td key={cell.columnLabel} className="py-2.5 pr-4 align-top">
                      <div className="flex items-center gap-1.5">
                        <Data>{value !== null ? value.toFixed(4) : '—'}</Data>
                      </div>
                      <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">
                        {cell.columnLabel}
                        {cell.served ? ' · served' : ''}
                      </span>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </FloatingCard>

      {data.calibration_points && data.calibration_points.length > 0 && (
        <FloatingCard className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <Caption>Calibration</Caption>
            <p className="max-w-[42ch] text-body text-ink-muted">
              How well a predicted probability matches the real outcome rate at that probability, measured on
              held-out data never used to fit the model.
            </p>
          </div>
          <CalibrationCurve points={data.calibration_points} />
        </FloatingCard>
      )}

      {data.fairness && (
        <FloatingCard className="flex flex-col gap-4 p-6">
          <Caption>Fairness audit - {prettyMetric(data.fairness.metric)}</Caption>
          <div className="flex items-center gap-10">
            <div className="flex flex-col gap-1">
              <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">Before controls</span>
              <Data className="text-h2">{data.fairness.gap_before.toFixed(4)}</Data>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">
                After controlling for crime type
              </span>
              <Data className="text-h2">{data.fairness.gap_after.toFixed(4)}</Data>
            </div>
          </div>
          <p className="text-body text-ink-muted">
            {data.fairness.gap_after > data.fairness.gap_before
              ? 'The gap widened after controlling for legitimate factors - the opposite of a reassuring result, and the number to read as the headline (bail_fairness.md).'
              : 'The gap narrowed after controlling for legitimate factors.'}
          </p>
        </FloatingCard>
      )}

      <FloatingCard className="flex flex-col gap-3 p-6">
        <Caption>Independently trained, and what an API touches</Caption>
        <p className="text-body text-ink-muted">{config.note(data)}</p>
      </FloatingCard>

      <DisclaimerChip className="self-start" />
    </div>
  )
}

export function Insights() {
  const [module, setModule] = useState<MetricModule>('bail')
  const query = useQuery({
    queryKey: ['metrics', module],
    queryFn: () => api.metrics(module),
  })

  return (
    <>
      <ScreenHeader
        title="Model Insights"
        subtitle="Evaluation, served live"
        stats={[
          { label: 'Dataset size', value: query.data ? query.data.dataset_size.toLocaleString('en-IN') : 'pending' },
          {
            label: 'Last trained',
            value: query.data?.last_trained
              ? new Date(query.data.last_trained).toLocaleDateString('en-IN')
              : 'pending',
          },
        ]}
        filters={<SegmentedControl options={MODULES} value={module} onChange={setModule} />}
      />

      {query.isPending && (
        <FloatingCard className="flex flex-col gap-4 p-6">
          <SkeletonBlock className="h-6 w-1/3" />
          <SkeletonBlock className="h-24 w-full" />
          <SkeletonBlock className="h-40 w-full" />
        </FloatingCard>
      )}

      {query.isError && (
        <ErrorState
          title={
            query.error instanceof ApiUnreachableError
              ? query.error.message
              : query.error instanceof ApiError
                ? query.error.message
                : 'Could not load these metrics.'
          }
          body="Confirm the backend is running, then try again."
          onRetry={() => query.refetch()}
        />
      )}

      {query.isSuccess && <ModuleMetricsView module={module} data={query.data} />}
    </>
  )
}
