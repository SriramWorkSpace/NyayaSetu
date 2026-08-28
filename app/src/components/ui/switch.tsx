import { cn } from '@/lib/utils'

/**
 * A boolean field control (prior record, show-routes style toggles) -
 * distinct from ThemeToggle, which is a fixed physical object with its own
 * literal colours (decisions.md D-011). This one is themed like everything
 * else.
 */
export interface SwitchFieldProps {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  id: string
}

export function SwitchField({ checked, onChange, label, id }: SwitchFieldProps) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4">
      <span className="text-label text-ink">{label}</span>
      <span className="relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border border-rule transition-colors duration-200"
        style={{ backgroundColor: checked ? 'var(--color-ink)' : 'var(--color-paper)' }}
      >
        <input
          id={id}
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="peer absolute inset-0 opacity-0"
        />
        <span
          aria-hidden
          className={cn(
            'inline-block size-4 rounded-full bg-paper-raised shadow-sm transition-transform duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-ink',
            checked ? 'translate-x-[22px]' : 'translate-x-1',
          )}
          style={{ backgroundColor: checked ? 'var(--color-paper)' : 'var(--color-ink-subtle)' }}
        />
      </span>
    </label>
  )
}
