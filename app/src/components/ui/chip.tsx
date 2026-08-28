import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface ChipProps {
  children: ReactNode
  className?: string
  selected?: boolean
  onClick?: () => void
  /** Identifiers (IPC sections, case numbers) render in mono. */
  mono?: boolean
}

export function Chip({ children, className, selected, onClick, mono }: ChipProps) {
  const interactive = typeof onClick === 'function'
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      aria-pressed={interactive ? Boolean(selected) : undefined}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1',
        mono ? 'font-mono text-data' : 'text-caption uppercase tracking-[0.05em]',
        'transition-[color,border-color,background-color] duration-200 ease-[var(--ease-paper)]',
        selected
          ? 'border-ink bg-ink text-paper'
          : 'border-rule bg-transparent text-ink-muted',
        interactive && !selected && 'hover:border-ink-subtle hover:text-ink',
        !interactive && 'cursor-default',
        className,
      )}
    >
      {children}
    </button>
  )
}
