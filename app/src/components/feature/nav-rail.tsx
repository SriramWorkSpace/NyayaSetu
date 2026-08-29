import { NavLink } from 'react-router-dom'
import { Gavel, Home, ScanLine, Search, Library, BarChart3 } from 'lucide-react'
import { Logo } from '@/components/ui/logo'
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
          className="grid size-8 shrink-0 place-items-center rounded-full border-2 border-ink text-ink"
        >
          <Logo size={15} />
        </span>
        <span
          className={cn(
            'overflow-hidden font-mono text-[13px] leading-none whitespace-nowrap uppercase tracking-[0.18em] text-ink transition-[opacity,max-width] duration-200',
            expanded ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0',
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
              {/* Two blobs, cross-faded, not one blob whose box changes
                  shape - measured with Playwright, not eyeballed at one
                  width, to find why: collapsed, this row's own stretched
                  width (38px, dictated by the rail's fixed 64px column
                  minus nav's padding/border) is narrower than a size-8
                  icon plus its px-1.5 padding even needs (32 + 6 + 6 =
                  44px) - the icon (shrink-0, so it never yields) ends up
                  pinned flush against the row's right edge instead of
                  centered, and the row's height (52px, from py-2.5) never
                  matched its width anyway, so an `inset-0` blob rendered
                  as an off-center oval, not a circle around the icon. The
                  row only has enough room for icon+label+padding once
                  expanded (rail-expanded is 240px) - so the full-row pill
                  is kept for that state, and a second, icon-sized blob
                  (exactly the icon wrapper's own already-centered 32x32
                  box) takes over while collapsed. */}
              {isActive && (
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-0 rounded-full border border-rule bg-paper transition-opacity duration-200',
                    expanded ? 'opacity-100' : 'opacity-0',
                  )}
                />
              )}
              <span className="relative grid size-8 shrink-0 place-items-center">
                {isActive && (
                  <span
                    aria-hidden
                    className={cn(
                      'absolute inset-0 rounded-full border border-rule bg-paper transition-opacity duration-200',
                      expanded ? 'opacity-0' : 'opacity-100',
                    )}
                  />
                )}
                <Icon size={18} strokeWidth={1.5} className="relative" />
              </span>
              <span
                className={cn(
                  'relative overflow-hidden whitespace-nowrap text-label leading-none transition-[opacity,max-width] duration-200',
                  expanded ? 'max-w-40 opacity-100' : 'max-w-0 opacity-0',
                )}
              >
                {label}
              </span>
            </>
          )}
        </NavLink>
      ))}

      {/* A block element, not a flex row racing a shrink-0 icon for space -
          the max-width collapse the rows above need (to stop an invisible
          label from still claiming layout width) doesn't apply here, and
          max-w-40 actually clipped this text to "Local models onl" when
          expanded (170px of text in a 160px cap) before this was reverted
          to a plain opacity fade. */}
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
