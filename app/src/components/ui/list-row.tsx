import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * A search result, an activity entry, a case in the library: icon chip,
 * title, subtitle, right-aligned value in mono (ARCHITECTURE.md section
 * 4.1/4.5).
 */
export interface ListRowProps {
  icon?: ReactNode
  title: string
  subtitle?: string
  value?: string
  onClick?: () => void
  className?: string
}

export function ListRow({ icon, title, subtitle, value, onClick, className }: ListRowProps) {
  const interactive = typeof onClick === 'function'
  const Tag = interactive ? 'button' : 'div'

  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-4 border-b border-rule px-1 py-4 text-left last:border-b-0',
        interactive && 'transition-colors duration-150 hover:bg-paper',
        className,
      )}
    >
      {icon && (
        <span className="grid size-9 shrink-0 place-items-center rounded-full border border-rule text-ink-subtle">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-label text-ink">{title}</span>
        {subtitle && (
          <span className="block truncate text-caption uppercase tracking-[0.05em] text-ink-subtle">
            {subtitle}
          </span>
        )}
      </span>
      {value && <span className="shrink-0 font-mono text-data tabular-nums text-ink-muted">{value}</span>}
    </Tag>
  )
}
