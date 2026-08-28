import { cn } from '@/lib/utils'

/**
 * The verdict element: an outlined, slightly rotated rubber stamp.
 * Never a filled pill - semantic tones are ink, not status lights, so the
 * colour sits in the stroke and the text only (CLAUDE.md 5.1).
 */
export type StampTone = 'granted' | 'denied' | 'caution' | 'neutral'

const TONES: Record<StampTone, string> = {
  granted: 'text-granted border-granted',
  denied: 'text-denied border-denied',
  caution: 'text-caution border-caution',
  neutral: 'text-ink-muted border-ink-subtle',
}

export interface StampBadgeProps {
  tone?: StampTone
  children: string
  className?: string
  size?: 'sm' | 'lg'
}

export function StampBadge({ tone = 'neutral', children, className, size = 'sm' }: StampBadgeProps) {
  return (
    <span
      className={cn(
        'inline-block -rotate-[4deg] select-none rounded-[4px] border-2 font-mono uppercase',
        size === 'lg'
          ? 'px-4 py-1.5 text-h2 tracking-[0.14em]'
          : 'px-2.5 py-1 text-caption tracking-[0.16em]',
        'opacity-90',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
