import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/motion'

/**
 * Types text on with a caret, at a slightly irregular cadence so it reads as a
 * hand at a keyboard rather than a progress bar.
 *
 * Under reduced motion the full string is present immediately. The text is
 * always in the DOM in full for screen readers; only the visible slice moves.
 */
export interface TypewriterProps {
  text: string
  className?: string
  /** Average ms per character. */
  speed?: number
  /** Delay before the first character, for sequencing several lines. */
  delay?: number
  caret?: boolean
  onDone?: () => void
}

export function Typewriter({
  text,
  className,
  speed = 55,
  delay = 0,
  caret = true,
  onDone,
}: TypewriterProps) {
  const reduced = usePrefersReducedMotion()
  const [count, setCount] = useState(reduced ? text.length : 0)
  const doneRef = useRef(false)

  useEffect(() => {
    doneRef.current = false

    if (reduced) {
      setCount(text.length)
      onDone?.()
      return
    }

    setCount(0)
    let timer = 0
    let i = 0

    const step = () => {
      i += 1
      setCount(i)

      if (i >= text.length) {
        if (!doneRef.current) {
          doneRef.current = true
          onDone?.()
        }
        return
      }

      // Jitter the cadence, and rest a beat longer after a space, so it reads
      // as a hand at a keyboard rather than a progress bar.
      const jitter = speed * (0.6 + Math.random() * 0.8)
      timer = window.setTimeout(step, text[i - 1] === ' ' ? jitter * 1.8 : jitter)
    }

    timer = window.setTimeout(step, delay)
    return () => window.clearTimeout(timer)
  }, [text, speed, delay, reduced, onDone])

  const typed = text.slice(0, count)
  const isTyping = count < text.length

  return (
    <span className={cn('inline-block', className)}>
      <span aria-hidden>{typed}</span>
      {caret && (
        <span
          aria-hidden
          className={cn(
            'ml-[0.08em] inline-block w-[0.5ch] -translate-y-[0.06em] border-b-2 border-current align-baseline',
            !isTyping && !reduced && 'animate-[caret-blink_1.1s_step-end_infinite]',
          )}
        />
      )}
      <span className="sr-only">{text}</span>
    </span>
  )
}
