import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Content sits in detached cards over the paper canvas.
 * Depth in dark mode comes from the paper -> paper-raised step and a hairline,
 * never a drop shadow (CLAUDE.md 5.3).
 */
export interface FloatingCardProps {
  children: ReactNode
  className?: string
  /** Interactive cards get hover lift and a pointer cursor. */
  interactive?: boolean
  as?: 'div' | 'article' | 'section'
}

export function FloatingCard({
  children,
  className,
  interactive = false,
  as: Tag = 'div',
}: FloatingCardProps) {
  return (
    <Tag
      className={cn(
        'rounded-[var(--radius-card)] border border-rule bg-paper-raised',
        'shadow-[0_1px_2px_color-mix(in_srgb,var(--color-ink)_6%,transparent),0_8px_24px_color-mix(in_srgb,var(--color-ink)_5%,transparent)]',
        'dark:shadow-none',
        interactive &&
          'cursor-pointer transition-[transform,border-color] duration-200 ease-[var(--ease-paper)] hover:-translate-y-0.5 hover:border-ink-subtle active:translate-y-0',
        className,
      )}
    >
      {children}
    </Tag>
  )
}
