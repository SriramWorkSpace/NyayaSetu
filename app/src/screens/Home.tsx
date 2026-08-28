import { useNavigate } from 'react-router-dom'
import { Gavel, ScanLine, Search } from 'lucide-react'
import { ScreenHeader } from '@/components/feature/screen-header'
import { PaperPanel } from '@/components/ui/paper-panel'
import { FloatingCard } from '@/components/ui/floating-card'
import { StampBadge } from '@/components/ui/stamp-badge'
import { EmptyState } from '@/components/ui/states'

const QUICK_ACTIONS = [
  { to: '/app/predict', label: 'Predict Bail', body: 'Structured case facts to a calibrated outcome.', icon: Gavel },
  { to: '/app/scan', label: 'Scan Document', body: 'Photograph a document, extract its fields.', icon: ScanLine },
  { to: '/app/search', label: 'Search Precedent', body: 'Find judgments close to a question.', icon: Search },
]

export function Home() {
  const navigate = useNavigate()

  return (
    <>
      <ScreenHeader
        title="Chambers"
        subtitle="Awaiting the local model server"
        stats={[
          { label: 'Predictions', value: '0' },
          { label: 'Scans', value: '0' },
          { label: 'Saved cases', value: '0' },
        ]}
      />

      <PaperPanel variant="record" className="mb-6 px-8 py-10">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-2">
            <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">
              Most recent activity
            </span>
            <p className="max-w-[46ch] text-body text-ink-muted">
              Nothing has been run yet. Predict an outcome or scan a document, and the result
              appears here with its confidence.
            </p>
          </div>
          <StampBadge tone="neutral" size="lg">
            No record
          </StampBadge>
        </div>
      </PaperPanel>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_ACTIONS.map(({ to, label, body, icon: Icon }) => (
          <FloatingCard
            key={to}
            interactive
            className="flex flex-col gap-3 p-6"
            as="article"
          >
            <button type="button" onClick={() => navigate(to)} className="flex flex-col gap-3 text-left">
              <Icon size={20} strokeWidth={1.5} className="text-ink-subtle" />
              <h2 className="font-mono text-h2 text-ink">{label}</h2>
              <p className="text-body text-ink-muted">{body}</p>
            </button>
          </FloatingCard>
        ))}
      </div>

      <FloatingCard className="p-2">
        <EmptyState
          title="No activity yet"
          body="Runs are recorded here as you make them, newest first, each with the model that produced it."
        />
      </FloatingCard>
    </>
  )
}
