import { cn } from '@/lib/utils'

export interface LogoProps {
  size?: number
  className?: string
}

/**
 * The NyayaSetu mark: a single signature-stroke glyph, `currentColor` filled
 * so it inherits ink/paper from wherever it sits (nav rail badge, favicon)
 * rather than carrying its own fixed color - the same convention every
 * lucide-react icon in this app already follows.
 */
export function Logo({ size = 18, className }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={size}
      width={size}
      viewBox="0 -960 960 960"
      fill="currentColor"
      aria-hidden
      className={cn(className)}
    >
      <path d="M160-120v-80h480v80H160Zm226-194L160-540l84-86 228 226-86 86Zm254-254L414-796l86-84 226 226-86 86Zm184 408L302-682l56-56 522 522-56 56Z" />
    </svg>
  )
}
