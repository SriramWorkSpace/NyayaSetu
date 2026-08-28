import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { PrimaryButton } from './button'

/**
 * Every screen owes an empty, loading and error state (CLAUDE.md 5.5).
 * Loading is a skeleton shaped like the content, never a bare spinner.
 */

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden rounded-[var(--radius-input)] bg-rule/50',
        'after:absolute after:inset-0 after:animate-[shimmer_1.6s_infinite]',
        'after:bg-gradient-to-r after:from-transparent after:via-paper-raised/60 after:to-transparent',
        className,
      )}
    />
  )
}

export interface EmptyStateProps {
  title: string
  body: string
  action?: { label: string; onClick: () => void }
  icon?: ReactNode
  className?: string
}

export function EmptyState({ title, body, action, icon, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center gap-3 px-6 py-16 text-center', className)}>
      {icon && <div className="mb-1 text-ink-subtle">{icon}</div>}
      <h3 className="font-mono text-h2 text-ink">{title}</h3>
      <p className="max-w-[42ch] text-body text-ink-muted">{body}</p>
      {action && (
        <PrimaryButton className="mt-3" onClick={action.onClick}>
          {action.label}
        </PrimaryButton>
      )}
    </div>
  )
}

export interface ErrorStateProps {
  /** What broke, in plain language. */
  title: string
  /** What the user should do about it. Never a status code alone. */
  body: string
  onRetry?: () => void
  className?: string
}

export function ErrorState({ title, body, onRetry, className }: ErrorStateProps) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center gap-3 rounded-[var(--radius-card)] border-2 border-dashed border-caution/50 px-6 py-12 text-center',
        className,
      )}
    >
      <span className="text-caption uppercase tracking-[0.16em] text-caution">Could not continue</span>
      <h3 className="font-mono text-h2 text-ink">{title}</h3>
      <p className="max-w-[46ch] text-body text-ink-muted">{body}</p>
      {onRetry && (
        <PrimaryButton variant="secondary" className="mt-2" onClick={onRetry}>
          Try again
        </PrimaryButton>
      )}
    </div>
  )
}
