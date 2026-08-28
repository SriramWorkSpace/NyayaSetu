import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Gavel, ScanLine, Search } from 'lucide-react'
import { api, ApiUnreachableError } from '@/lib/api'
import { ScreenHeader } from '@/components/feature/screen-header'
import { PaperPanel } from '@/components/ui/paper-panel'
import { FloatingCard } from '@/components/ui/floating-card'
import { StampBadge } from '@/components/ui/stamp-badge'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/ui/states'
import { ListRow } from '@/components/ui/list-row'
import { useAppStore } from '@/lib/store'

const QUICK_ACTIONS = [
  { to: '/app/predict', label: 'Predict Bail', body: 'Structured case facts to a calibrated outcome.', icon: Gavel },
  { to: '/app/scan', label: 'Scan Document', body: 'Photograph a document, extract its fields.', icon: ScanLine },
  { to: '/app/search', label: 'Search Precedent', body: 'Find judgments close to a question.', icon: Search },
]

export function Home() {
  const navigate = useNavigate()
  const activity = useAppStore((s) => s.activity)
  const mostRecent = activity[0]

  // The real round trip: this screen's stat strip renders whatever the
  // backend actually reports, live, over the typed client. Nothing here is
  // hardcoded (CLAUDE.md section 7 - the whole Insights-screen claim starts
  // with connections exactly like this one).
  const health = useQuery({
    queryKey: ['health'],
    queryFn: api.health,
    refetchInterval: 15_000,
  })

  const stats =
    health.data
      ? [
          { label: 'Backend', value: health.data.status },
          { label: 'Modules', value: `${health.data.models_loaded.length} / 5` },
          { label: 'Uptime', value: `${Math.round(health.data.uptime_s)}s` },
        ]
      : undefined

  return (
    <>
      <ScreenHeader
        title="Chambers"
        subtitle={
          health.isPending
            ? 'Checking the local model server'
            : health.isError
              ? 'Local model server unreachable'
              : 'Local model server connected'
        }
        stats={stats}
      />

      {health.isPending && (
        <FloatingCard className="mb-6 flex flex-col gap-3 p-6">
          <SkeletonBlock className="h-5 w-1/3" />
          <SkeletonBlock className="h-4 w-2/3" />
        </FloatingCard>
      )}

      {health.isError && (
        <FloatingCard className="mb-6 p-2">
          <ErrorState
            title={
              health.error instanceof ApiUnreachableError
                ? health.error.message
                : 'The local model server returned an error'
            }
            body="Start the backend with `uvicorn app.main:app --port 8000` in a second terminal, then retry."
            onRetry={() => health.refetch()}
          />
        </FloatingCard>
      )}

      {health.isSuccess && (
        <PaperPanel variant="record" className="mb-6 px-8 py-10">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex flex-col gap-2">
              <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">
                Most recent activity
              </span>
              {mostRecent ? (
                <p className="max-w-[46ch] text-body text-ink-muted">
                  {mostRecent.kind === 'bail'
                    ? `Bail prediction for a ${mostRecent.request.crime_category.toLowerCase()} case, ${new Date(mostRecent.at).toLocaleString()}.`
                    : `Document scan (${mostRecent.fileName}), ${new Date(mostRecent.at).toLocaleString()}.`}
                </p>
              ) : (
                <p className="max-w-[46ch] text-body text-ink-muted">
                  Nothing has been run yet. Predict an outcome or scan a document, and the result
                  appears here with its confidence.
                </p>
              )}
            </div>
            {mostRecent && mostRecent.kind === 'bail' ? (
              <StampBadge tone={mostRecent.response.outcome === 'granted' ? 'granted' : 'denied'} size="lg">
                {`Bail ${mostRecent.response.outcome}`}
              </StampBadge>
            ) : (
              <StampBadge tone="neutral" size="lg">
                {mostRecent ? 'Scanned' : 'No record'}
              </StampBadge>
            )}
          </div>
        </PaperPanel>
      )}

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map(({ to, label, body, icon: Icon }) => (
          <FloatingCard key={to} interactive className="flex flex-col gap-3 p-6" as="article">
            <button type="button" onClick={() => navigate(to)} className="flex flex-col gap-3 text-left">
              <Icon size={20} strokeWidth={1.5} className="text-ink-subtle" />
              <h2 className="font-mono text-h2 text-ink">{label}</h2>
              <p className="text-body text-ink-muted">{body}</p>
            </button>
          </FloatingCard>
        ))}
      </div>

      {activity.length === 0 ? (
        <FloatingCard className="p-2">
          <EmptyState
            title="No activity yet"
            body="Runs are recorded here as you make them, newest first, each with the model that produced it."
          />
        </FloatingCard>
      ) : (
        <FloatingCard className="px-4">
          {activity.slice(0, 5).map((a) => (
            <ListRow
              key={a.id}
              title={a.kind === 'bail' ? `Bail: ${a.request.crime_category}` : `Scan: ${a.fileName}`}
              subtitle={new Date(a.at).toLocaleString()}
              value={
                a.kind === 'bail'
                  ? `${a.response.outcome} · ${(a.response.probability * 100).toFixed(0)}%`
                  : `${Math.round(a.response.ocr_confidence * 100)}%`
              }
            />
          ))}
        </FloatingCard>
      )}
    </>
  )
}
