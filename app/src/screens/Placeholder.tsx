import { ScreenHeader } from '@/components/feature/screen-header'
import { FloatingCard } from '@/components/ui/floating-card'
import { EmptyState } from '@/components/ui/states'

/**
 * Structural stand-in for screens whose real content arrives with the backend
 * (Phase 4). It is a designed empty state, not a "coming soon" sign: the
 * header, stats strip and card frame are the real ones.
 */
export interface PlaceholderScreenProps {
  title: string
  subtitle: string
  stats: { label: string; value: string }[]
  emptyTitle: string
  emptyBody: string
}

export function PlaceholderScreen({
  title,
  subtitle,
  stats,
  emptyTitle,
  emptyBody,
}: PlaceholderScreenProps) {
  return (
    <>
      <ScreenHeader title={title} subtitle={subtitle} stats={stats} />
      <FloatingCard className="p-2">
        <EmptyState title={emptyTitle} body={emptyBody} />
      </FloatingCard>
    </>
  )
}
