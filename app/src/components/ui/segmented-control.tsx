import { cn } from '@/lib/utils'

export interface SegmentedControlProps<T extends string> {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
  className?: string
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex items-center gap-1 rounded-full border border-rule bg-paper p-1', className)}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="tab"
          aria-selected={opt.value === value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-caption uppercase tracking-[0.05em] transition-colors duration-150',
            opt.value === value ? 'bg-ink text-paper' : 'text-ink-muted hover:text-ink',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
