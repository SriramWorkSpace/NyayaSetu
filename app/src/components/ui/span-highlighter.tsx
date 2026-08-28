import { useEffect, useRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * Renders judgment text with a character-range highlighted in place and
 * scrolled into view - never a separate chat-style answer bubble, since the
 * QA model is extractive and the UI should say so honestly (ARCHITECTURE.md
 * section 4.6).
 */
export interface SpanHighlighterProps {
  text: string
  highlight?: { start: number; end: number } | null
  className?: string
}

export function SpanHighlighter({ text, highlight, className }: SpanHighlighterProps) {
  const markRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (highlight) markRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [highlight])

  if (!highlight) {
    return <p className={cn('whitespace-pre-wrap text-body leading-relaxed text-ink-muted', className)}>{text}</p>
  }

  const before = text.slice(0, highlight.start)
  const span = text.slice(highlight.start, highlight.end)
  const after = text.slice(highlight.end)

  return (
    <p className={cn('whitespace-pre-wrap text-body leading-relaxed text-ink-muted', className)}>
      {before}
      <mark ref={markRef} className="rounded-[2px] bg-caution/25 px-0.5 text-ink">
        {span}
      </mark>
      {after}
    </p>
  )
}
