import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'motion/react'
import { NavRail } from '@/components/feature/nav-rail'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { pageTransition, pageVariants, usePrefersReducedMotion } from '@/lib/motion'

/**
 * The app shell.
 *
 * The rail's expansion is driven here, on grid-template-columns, so the page
 * content is PUSHED aside rather than covered. Doing it with a transform on
 * the rail would overlap content at the 1024px minimum window width.
 */
export function Shell() {
  const [railExpanded, setRailExpanded] = useState(false)
  const location = useLocation()
  const reduced = usePrefersReducedMotion()

  return (
    <div
      className="grid min-h-[100dvh] bg-paper transition-[grid-template-columns] duration-[var(--duration-rail)] ease-[var(--ease-paper)]"
      style={{
        gridTemplateColumns: railExpanded
          ? 'var(--rail-expanded) 1fr'
          : 'var(--rail-collapsed) 1fr',
      }}
    >
      <div className="p-3">
        <NavRail expanded={railExpanded} onExpandedChange={setRailExpanded} />
      </div>

      <ThemeToggle className="fixed top-5 right-6 z-50 scale-[0.62] origin-top-right" />

      <main className="min-w-0 px-6 pt-6 pb-16 lg:px-8">
        <div className="mx-auto w-full max-w-[var(--content-max)]">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={location.pathname}
              variants={reduced ? undefined : pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={pageTransition}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
