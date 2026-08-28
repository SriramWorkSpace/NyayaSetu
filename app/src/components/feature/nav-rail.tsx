import { NavLink } from 'react-router-dom'
import { Gavel, Home, ScanLine, Search, Library, BarChart3 } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Floating left rail. Collapsed to icons, expanding to icon + label on hover.
 *
 * Expansion PUSHES the page rather than covering it: the shell animates its
 * grid-template-columns and this component only fills the column it is given.
 * An overlay drawer would cover content at the 1024px minimum window width.
 */

export const DESTINATIONS = [
  { to: '/app', label: 'Chambers', icon: Home, end: true },
  { to: '/app/predict', label: 'Predict Bail', icon: Gavel, end: false },
  { to: '/app/scan', label: 'Scan Document', icon: ScanLine, end: false },
  { to: '/app/search', label: 'Search Precedent', icon: Search, end: false },
  { to: '/app/library', label: 'Case Library', icon: Library, end: false },
  { to: '/app/insights', label: 'Model Insights', icon: BarChart3, end: false },
] as const

export interface NavRailProps {
  expanded: boolean
  onExpandedChange: (v: boolean) => void
}

export function NavRail({ expanded, onExpandedChange }: NavRailProps) {
  return (
    <nav
      aria-label="Primary"
      onMouseEnter={() => onExpandedChange(true)}
      onMouseLeave={() => onExpandedChange(false)}
      onFocusCapture={() => onExpandedChange(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node)) onExpandedChange(false)
      }}
      className={cn(
        'sticky top-3 flex h-[calc(100dvh-1.5rem)] flex-col gap-1 overflow-hidden',
        'rounded-[var(--radius-card)] border border-rule bg-paper-raised p-3',
        'shadow-[0_8px_24px_color-mix(in_srgb,var(--color-ink)_5%,transparent)] dark:shadow-none',
      )}
    >
      <div className="mb-4 flex items-center gap-3 px-1.5 pt-1">
        <span
          aria-hidden
          className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink font-mono text-[13px] leading-none text-ink"
        >
          N
        </span>
        <span
          className={cn(
            'font-mono text-[13px] whitespace-nowrap uppercase tracking-[0.18em] text-ink transition-opacity duration-200',
            expanded ? 'opacity-100' : 'opacity-0',
          )}
        >
          NyayaSetu
        </span>
      </div>

      {DESTINATIONS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          title={label}
          className={({ isActive }) =>
            cn(
              'group/link relative flex items-center gap-3 rounded-full px-1.5 py-2.5',
              'transition-colors duration-200',
              isActive ? 'text-ink' : 'text-ink-subtle hover:text-ink',
            )
          }
        >
          {({ isActive }) => (
            <>
              {isActive && (
                <span
                  aria-hidden
                  className="absolute inset-0 rounded-full border border-rule bg-paper"
                />
              )}
              <span className="relative grid size-8 shrink-0 place-items-center">
                <Icon size={18} strokeWidth={1.5} />
              </span>
              <span
                className={cn(
                  'relative whitespace-nowrap text-label transition-opacity duration-200',
                  expanded ? 'opacity-100' : 'opacity-0',
                )}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}

      <p
        className={cn(
          'mt-auto px-1.5 pb-1 text-caption uppercase tracking-[0.05em] whitespace-nowrap text-ink-subtle transition-opacity duration-200',
          expanded ? 'opacity-100' : 'opacity-0',
        )}
      >
        Local models only
      </p>
    </nav>
  )
}
