import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * The type split is semantic, not decorative (CLAUDE.md 5.2):
 *   Space Mono    -> headings AND anything a machine extracted or measured
 *   Special Elite -> anything a person wrote
 * A reader can tell the two apart without a legend.
 */

export function Display({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('font-mono text-display tabular-nums', className)}>{children}</div>
  )
}

export function H1({ children, className }: { children: ReactNode; className?: string }) {
  return <h1 className={cn('font-mono text-h1 font-bold', className)}>{children}</h1>
}

export function H2({ children, className }: { children: ReactNode; className?: string }) {
  return <h2 className={cn('font-mono text-h2', className)}>{children}</h2>
}

export function Body({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn('max-w-[65ch] text-body text-ink-muted', className)}>{children}</p>
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-label', className)}>{children}</span>
}

export function Caption({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('text-caption uppercase tracking-[0.05em] text-ink-muted', className)}>
      {children}
    </span>
  )
}

/**
 * Identifiers and measured values: case numbers, IPC sections, F1 scores.
 * Anything wrapped in this is asserting "a machine produced me".
 */
export function Data({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono text-data tabular-nums', className)}>{children}</span>
}
