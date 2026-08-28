import { useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { motion } from 'motion/react'
import { PaperPanel } from '@/components/ui/paper-panel'
import { Typewriter } from '@/components/ui/typewriter'
import { EnterSuite } from '@/components/feature/enter-suite'
import { usePrefersReducedMotion } from '@/lib/motion'

/**
 * First impression, and the reference for every transition that follows:
 * paper, type, and deliberate movement. The wordmark types itself, the
 * subtitle follows, then the hand-off control fades in.
 */
export function Startup() {
  const navigate = useNavigate()
  const reduced = usePrefersReducedMotion()
  const [stage, setStage] = useState<0 | 1 | 2>(reduced ? 2 : 0)

  return (
    <PaperPanel variant="record" bleed className="min-h-[100dvh]">
      <div className="mx-auto flex min-h-[100dvh] max-w-[var(--content-max)] flex-col items-center justify-center gap-12 px-6 py-24">
        <div className="flex flex-col items-center gap-4 text-center">
          <h1 className="font-mono text-[clamp(2.5rem,9vw,5.5rem)] leading-none font-bold tracking-[-0.03em] text-ink">
            <Typewriter text="NyayaSetu" speed={110} onDone={() => setStage(1)} />
          </h1>

          <div className="min-h-[1.75rem]">
            {stage >= 1 && (
              <p className="text-body text-ink-muted">
                <Typewriter
                  text="A bridge to justice. Five models, running on this machine."
                  speed={26}
                  delay={220}
                  caret={false}
                  onDone={() => setStage(2)}
                />
              </p>
            )}
          </div>
        </div>

        <motion.div
          initial={reduced ? false : { opacity: 0, y: 14 }}
          animate={stage >= 2 ? { opacity: 1, y: 0 } : { opacity: 0, y: 14 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        >
          <EnterSuite onEnter={() => navigate('/app')} />
        </motion.div>

        <motion.p
          initial={reduced ? false : { opacity: 0 }}
          animate={stage >= 2 ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="absolute bottom-8 text-caption uppercase tracking-[0.05em] text-ink-subtle"
        >
          Not legal advice
        </motion.p>
      </div>
    </PaperPanel>
  )
}
