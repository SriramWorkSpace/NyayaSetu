import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type Variant = 'primary' | 'secondary' | 'ghost'

export interface PrimaryButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  children: ReactNode
}

/**
 * Contrast is checked in both themes: `primary` is ink-on-paper inverted, so it
 * stays legible when the ramp flips. `:active` gives a physical push.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-ink text-paper border-ink hover:opacity-90',
  secondary: 'bg-paper-raised text-ink border-rule hover:border-ink-subtle',
  ghost: 'bg-transparent text-ink-muted border-transparent hover:text-ink',
}

export function PrimaryButton({
  variant = 'primary',
  className,
  children,
  ...props
}: PrimaryButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-full border px-6 py-2.5',
        'text-label transition-[transform,opacity,border-color,color] duration-200 ease-[var(--ease-paper)]',
        'active:translate-y-px disabled:pointer-events-none disabled:opacity-45',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string
  children: ReactNode
}

export function IconButton({ label, className, children, ...props }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-9 items-center justify-center rounded-full border border-rule bg-paper-raised text-ink-muted',
        'transition-[color,border-color,transform] duration-200 ease-[var(--ease-paper)]',
        'hover:border-ink-subtle hover:text-ink active:translate-y-px',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}
