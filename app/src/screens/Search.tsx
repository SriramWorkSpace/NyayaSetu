import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search as SearchIcon } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError, ApiUnreachableError } from '@/lib/api'
import { ScreenHeader } from '@/components/feature/screen-header'
import { PaperPanel } from '@/components/ui/paper-panel'
import { FloatingCard } from '@/components/ui/floating-card'
import { ListRow } from '@/components/ui/list-row'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/ui/states'
import { PrimaryButton } from '@/components/ui/button'

/**
 * Natural-language query to ranked past judgments, with the real similarity
 * score shown, not just rank order (ARCHITECTURE.md section 2.2 #18,
 * section 4.5). Selecting a result opens Case Detail.
 */
export function SearchPrecedent() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [hasSearched, setHasSearched] = useState(false)

  const search = useMutation({
    mutationFn: () => api.searchPrecedent({ query, top_k: 10 }),
  })

  function runSearch() {
    if (!query.trim()) return
    setHasSearched(true)
    search.mutate()
  }

  return (
    <>
      <ScreenHeader
        title="Search Precedent"
        subtitle="Natural language over past judgments"
        stats={[{ label: 'Corpus', value: '35,000' }, { label: 'Index', value: 'FAISS (pending)' }]}
      />

      <PaperPanel variant="record" className="mb-6 px-6 py-6">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            runSearch()
          }}
          className="flex items-center gap-3"
        >
          <SearchIcon size={18} strokeWidth={1.5} className="shrink-0 text-ink-subtle" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. bail granted despite economic offence charges"
            className="flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-subtle"
          />
          <PrimaryButton type="submit" disabled={search.isPending}>
            {search.isPending ? 'Searching...' : 'Search'}
          </PrimaryButton>
        </form>
      </PaperPanel>

      {search.isPending && (
        <FloatingCard className="flex flex-col gap-3 p-6">
          {Array.from({ length: 3 }, (_, i) => (
            <SkeletonBlock key={i} className="h-14 w-full" />
          ))}
        </FloatingCard>
      )}

      {search.isError && (
        <ErrorState
          title={
            search.error instanceof ApiUnreachableError
              ? search.error.message
              : search.error instanceof ApiError
                ? search.error.message
                : 'Search failed.'
          }
          body="Confirm the backend is running, then try again."
          onRetry={runSearch}
        />
      )}

      {search.isSuccess && search.data.results.length === 0 && (
        <FloatingCard className="p-2">
          <EmptyState title="No matches" body="Nothing scored high enough against this query. Try fewer or different terms." />
        </FloatingCard>
      )}

      {search.isSuccess && search.data.results.length > 0 && (
        <FloatingCard className="px-4">
          {search.data.results.map((r) => (
            <ListRow
              key={r.case_id}
              title={r.title}
              subtitle={`${r.court} · ${r.year}`}
              value={r.score.toFixed(2)}
              onClick={() => navigate(`/app/case/${r.case_id}`)}
            />
          ))}
        </FloatingCard>
      )}

      {!hasSearched && (
        <FloatingCard className="mt-6 p-2">
          <EmptyState title="Search for a precedent" body="Results are ranked by similarity score, shown in mono, not just position." />
        </FloatingCard>
      )}
    </>
  )
}
