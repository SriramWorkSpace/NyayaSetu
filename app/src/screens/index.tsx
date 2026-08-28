import { useNavigate } from 'react-router-dom'
import { Gavel, ScanLine, Library, Trash2 } from 'lucide-react'
import { useAppStore } from '@/lib/store'
import { ScreenHeader } from '@/components/feature/screen-header'
import { FloatingCard } from '@/components/ui/floating-card'
import { ListRow } from '@/components/ui/list-row'
import { EmptyState } from '@/components/ui/states'
import { IconButton } from '@/components/ui/button'
import { PlaceholderScreen } from './Placeholder'

export { Predict } from './Predict'
export { Scan } from './Scan'
export { SearchPrecedent } from './Search'
export { CaseDetail } from './CaseDetail'

/**
 * Saved cases and activity history, both from the session store
 * (decisions.md D-012 - Zustand + localStorage, not SQLite, for a
 * single-user local app).
 */
export function CaseLibrary() {
  const navigate = useNavigate()
  const activity = useAppStore((s) => s.activity)
  const savedCases = useAppStore((s) => s.savedCases)
  const unsaveCase = useAppStore((s) => s.unsaveCase)

  return (
    <>
      <ScreenHeader
        title="Case Library"
        subtitle="Saved cases and activity history"
        stats={[{ label: 'Saved', value: String(savedCases.length) }, { label: 'Activity', value: String(activity.length) }]}
      />

      <div className="mb-6 flex flex-col gap-3">
        <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">Saved cases</span>
        {savedCases.length === 0 ? (
          <FloatingCard className="p-2">
            <EmptyState title="Nothing saved yet" body="Save a case from its detail view to find it here later." />
          </FloatingCard>
        ) : (
          <FloatingCard className="px-4">
            {savedCases.map((c) => (
              <div key={c.caseId} className="flex items-center gap-2 border-b border-rule last:border-b-0">
                <ListRow
                  className="flex-1 border-b-0"
                  icon={<Library size={16} strokeWidth={1.5} />}
                  title={c.title}
                  subtitle={`${c.court} · ${c.year}`}
                  onClick={() => navigate(`/app/case/${c.caseId}`)}
                />
                <IconButton label="Remove from library" onClick={() => unsaveCase(c.caseId)}>
                  <Trash2 size={14} strokeWidth={1.5} />
                </IconButton>
              </div>
            ))}
          </FloatingCard>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">Activity</span>
        {activity.length === 0 ? (
          <FloatingCard className="p-2">
            <EmptyState title="No activity yet" body="Predictions and scans you run are recorded here, newest first." />
          </FloatingCard>
        ) : (
          <FloatingCard className="px-4">
            {activity.map((a) => (
              <ListRow
                key={a.id}
                icon={a.kind === 'bail' ? <Gavel size={16} strokeWidth={1.5} /> : <ScanLine size={16} strokeWidth={1.5} />}
                title={a.kind === 'bail' ? `Bail: ${a.request.crime_category}` : `Scan: ${a.fileName}`}
                subtitle={new Date(a.at).toLocaleString()}
                value={a.kind === 'bail' ? `${a.response.outcome} · ${(a.response.probability * 100).toFixed(0)}%` : `${Math.round(a.response.ocr_confidence * 100)}%`}
              />
            ))}
          </FloatingCard>
        )}
      </div>
    </>
  )
}

export function Insights() {
  return (
    <PlaceholderScreen
      title="Model Insights"
      subtitle="Evaluation, served live"
      stats={[{ label: 'Modules', value: '0 / 5' }, { label: 'Last trained', value: 'never' }]}
      emptyTitle="Built last, on purpose"
      emptyBody="This screen depends on every module's real metrics existing. It renders baselines against final models, the calibration curve and the fairness audit, read from the backend at request time rather than hardcoded here."
    />
  )
}
