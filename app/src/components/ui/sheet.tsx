import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'motion/react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { usePrefersReducedMotion } from '@/lib/motion'
import { IconButton } from './button'

/**
 * Side panel. Replaces a mobile bottom sheet - this is a desktop window, so
 * secondary content slides in from the right rather than up from the bottom
 * (ARCHITECTURE.md section 4.3/4.6: the bail result and the "Ask" panel both
 * use this).
 */
export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  widthClassName?: string
}

export function Sheet({ open, onClose, title, children, widthClassName = 'w-full max-w-[520px]' }: SheetProps) {
  const reduced = usePrefersReducedMotion()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return createPortal(
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            aria-hidden
            className="fixed inset-0 z-40 bg-ink/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={cn(
              'fixed inset-y-0 right-0 z-50 flex flex-col overflow-y-auto border-l border-rule bg-paper-raised',
              widthClassName,
            )}
            initial={{ x: reduced ? 0 : '100%' }}
            animate={{ x: 0 }}
            exit={{ x: reduced ? 0 : '100%' }}
            transition={{ duration: reduced ? 0 : 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="flex items-center justify-between border-b border-rule px-6 py-4">
              <h2 className="font-mono text-h2 text-ink">{title}</h2>
              <IconButton label="Close" onClick={onClose}>
                <X size={16} strokeWidth={1.5} />
              </IconButton>
            </div>
            <div className="flex-1 px-6 py-6">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body,
  )
}
