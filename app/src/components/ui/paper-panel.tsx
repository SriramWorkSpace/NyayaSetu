import type { ReactNode } from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * The signature surface: a sheet rolled into a typewriter.
 *
 * Drawn procedurally (SVG feTurbulence grain + ruled platen baselines) rather
 * than shipped as an image, so it follows the light/dark toggle. Variants are
 * parameters on this one component, not four separate assets.
 */

type PanelVariant = 'record' | 'verdict' | 'scan' | 'ledger'

interface VariantSpec {
  /** Distance between ruled baselines, in px. Tighter reads more technical. */
  ruleSpacing: number
  grainOpacity: number
  vignette: number
}

const VARIANTS: Record<PanelVariant, VariantSpec> = {
  record: { ruleSpacing: 34, grainOpacity: 0.055, vignette: 0.16 },
  verdict: { ruleSpacing: 26, grainOpacity: 0.07, vignette: 0.28 },
  scan: { ruleSpacing: 30, grainOpacity: 0.05, vignette: 0.2 },
  ledger: { ruleSpacing: 20, grainOpacity: 0.045, vignette: 0.14 },
}

export interface PaperPanelProps {
  variant?: PanelVariant
  children?: ReactNode
  className?: string
  /** Full-bleed panels (the startup screen) drop the border and radius. */
  bleed?: boolean
}

export function PaperPanel({
  variant = 'record',
  children,
  className,
  bleed = false,
}: PaperPanelProps) {
  const spec = VARIANTS[variant]
  const id = useId().replace(/:/g, '')

  return (
    <div
      className={cn(
        'relative isolate overflow-hidden bg-paper-raised',
        !bleed && 'rounded-[var(--radius-panel)] border border-rule',
        className,
      )}
    >
      {/* Ruled platen baselines. currentColor keeps them theme-aware. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 text-ink opacity-[0.07]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(to bottom, currentColor 0 1px, transparent 1px var(--rule-gap))',
          ['--rule-gap' as string]: `${spec.ruleSpacing}px`,
        }}
      />

      {/* Paper grain. */}
      <svg aria-hidden className="pointer-events-none absolute inset-0 h-full w-full">
        <filter id={`grain-${id}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves={3} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect
          width="100%"
          height="100%"
          filter={`url(#grain-${id})`}
          opacity={spec.grainOpacity}
        />
      </svg>

      {/* Vignette: the shadow a curved sheet casts against the platen. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background: `radial-gradient(120% 90% at 50% 40%, transparent 55%, color-mix(in srgb, var(--color-ink) ${
            spec.vignette * 100
          }%, transparent) 100%)`,
        }}
      />

      <div className="relative">{children}</div>
    </div>
  )
}
