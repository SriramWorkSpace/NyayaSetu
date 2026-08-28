import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { ArrowLeft, MessageCircleQuestion, Bookmark, BookmarkCheck, ChevronDown } from 'lucide-react'
import { api, ApiError, ApiUnreachableError } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { FloatingCard } from '@/components/ui/floating-card'
import { IconButton, PrimaryButton } from '@/components/ui/button'
import { Sheet } from '@/components/ui/sheet'
import { SpanHighlighter } from '@/components/ui/span-highlighter'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/ui/states'
import { Caption, Data } from '@/components/ui/typography'

/**
 * Full judgment view (ARCHITECTURE.md section 4.6): the extractive summary
 * pinned in a collapsed card at the top, sentence provenance visible on
 * expand, and a floating "Ask" button whose answer highlights a span inside
 * the judgment text itself.
 */
export function CaseDetail() {
  const { caseId = '' } = useParams()
  const navigate = useNavigate()
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [highlight, setHighlight] = useState<{ start: number; end: number } | null>(null)

  const saveCase = useAppStore((s) => s.saveCase)
  const unsaveCase = useAppStore((s) => s.unsaveCase)
  const isCaseSaved = useAppStore((s) => s.isCaseSaved)

  const detail = useQuery({
    queryKey: ['case', caseId],
    queryFn: () => api.caseDetail(caseId),
    enabled: Boolean(caseId),
  })

  const ask = useMutation({
    mutationFn: () => api.qaExtract({ case_id: caseId, question }),
    onSuccess: (data) => {
      setHighlight({ start: data.char_start, end: data.char_end })
      setAskOpen(false)
    },
  })

  const saved = isCaseSaved(caseId)

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-label text-ink-muted transition-colors hover:text-ink"
        >
          <ArrowLeft size={16} strokeWidth={1.5} /> Back
        </button>
        {detail.data && (
          <IconButton
            label={saved ? 'Remove from library' : 'Save to library'}
            onClick={() =>
              saved
                ? unsaveCase(caseId)
                : saveCase({
                    caseId,
                    title: detail.data.title,
                    court: detail.data.court,
                    year: detail.data.year,
                    savedAt: new Date().toISOString(),
                  })
            }
          >
            {saved ? <BookmarkCheck size={16} strokeWidth={1.5} /> : <Bookmark size={16} strokeWidth={1.5} />}
          </IconButton>
        )}
      </div>

      {detail.isPending && (
        <FloatingCard className="flex flex-col gap-3 p-6">
          <SkeletonBlock className="h-7 w-1/2" />
          <SkeletonBlock className="h-4 w-full" />
          <SkeletonBlock className="h-4 w-4/5" />
        </FloatingCard>
      )}

      {detail.isError && (
        <ErrorState
          title={
            detail.error instanceof ApiUnreachableError
              ? detail.error.message
              : detail.error instanceof ApiError
                ? detail.error.message
                : 'Could not load this case.'
          }
          body="Confirm the backend is running, then try again."
          onRetry={() => detail.refetch()}
        />
      )}

      {detail.isSuccess && (
        <div className="flex flex-col gap-6 pb-24">
          <div className="flex flex-col gap-1">
            <h1 className="font-mono text-h1 font-bold text-ink">{detail.data.title}</h1>
            <p className="text-caption uppercase tracking-[0.05em] text-ink-subtle">
              {detail.data.court} · {detail.data.year} · <Data>{detail.data.case_number}</Data>
            </p>
          </div>

          <FloatingCard className="overflow-hidden">
            <button
              type="button"
              onClick={() => setSummaryOpen((v) => !v)}
              className="flex w-full items-center justify-between gap-4 px-6 py-4"
            >
              <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">Extractive summary</span>
              <ChevronDown
                size={16}
                strokeWidth={1.5}
                className={`text-ink-subtle transition-transform duration-200 ${summaryOpen ? 'rotate-180' : ''}`}
              />
            </button>
            <div className="px-6 pb-2">
              <p className="text-body text-ink">{detail.data.summary_sentences[0]}</p>
            </div>
            {summaryOpen && (
              <div className="flex flex-col gap-2 border-t border-rule px-6 py-4">
                <Caption>Sentence provenance</Caption>
                {detail.data.summary_sentences.map((s, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Data className="mt-0.5 shrink-0 text-ink-subtle">
                      &sect;{detail.data.source_indices[i]}
                    </Data>
                    <p className="text-body text-ink-muted">{s}</p>
                  </div>
                ))}
              </div>
            )}
          </FloatingCard>

          <FloatingCard className="p-6">
            <SpanHighlighter text={detail.data.full_text} highlight={highlight} />
          </FloatingCard>
        </div>
      )}

      {/* Floating "Ask" button (ARCHITECTURE.md section 4.6). */}
      {detail.isSuccess && (
        <div className="fixed bottom-8 right-8 z-30">
          <PrimaryButton onClick={() => setAskOpen(true)}>
            <MessageCircleQuestion size={16} strokeWidth={1.5} /> Ask
          </PrimaryButton>
        </div>
      )}

      <Sheet open={askOpen} onClose={() => setAskOpen(false)} title="Ask this judgment">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (question.trim()) ask.mutate()
          }}
          className="flex flex-col gap-4"
        >
          <p className="text-body text-ink-muted">
            The answer is a span highlighted inside the judgment itself, not generated text.
          </p>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="e.g. On what terms was bail granted?"
            className="resize-none rounded-[var(--radius-input)] border border-rule bg-paper px-3 py-2 text-body text-ink outline-none placeholder:text-ink-subtle focus:border-ink-subtle"
          />
          <PrimaryButton type="submit" disabled={ask.isPending || !question.trim()}>
            {ask.isPending ? 'Searching the text...' : 'Find the answer'}
          </PrimaryButton>
          {ask.isError && (
            <ErrorState
              title={ask.error instanceof ApiError ? ask.error.message : 'Could not find an answer.'}
              body="Try rephrasing the question."
            />
          )}
        </form>
      </Sheet>

      {!detail.isPending && !detail.isSuccess && !detail.isError && (
        <FloatingCard className="p-2">
          <EmptyState title="Case not found" body="This case is not in the current corpus." />
        </FloatingCard>
      )}
    </>
  )
}
