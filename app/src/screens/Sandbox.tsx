import { useState } from 'react'
import { RotateCcw, FileText, Trash2, Gavel, ScanLine } from 'lucide-react'
import { PaperPanel } from '@/components/ui/paper-panel'
import { FloatingCard } from '@/components/ui/floating-card'
import { PrimaryButton, IconButton } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { StatPill } from '@/components/ui/stat-pill'
import { StatCard } from '@/components/ui/stat-card'
import { StampBadge } from '@/components/ui/stamp-badge'
import { ConfidenceMeter } from '@/components/ui/confidence-meter'
import { BarChart } from '@/components/ui/bar-chart'
import { MetricComparisonBar } from '@/components/ui/metric-comparison-bar'
import { CalibrationCurve } from '@/components/ui/calibration-curve'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { ListRow } from '@/components/ui/list-row'
import { SpanHighlighter } from '@/components/ui/span-highlighter'
import { Sheet } from '@/components/ui/sheet'
import { Typewriter } from '@/components/ui/typewriter'
import { DisclaimerChip } from '@/components/ui/disclaimer'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/ui/states'
import { ThemeToggle } from '@/components/ui/theme-toggle'
import { Body, Caption, Data, Display, H1, H2, Label } from '@/components/ui/typography'
import { Logo } from '@/components/ui/logo'

function Section({ name, children }: { name: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-rule pt-8">
      <Caption>{name}</Caption>
      {children}
    </section>
  )
}

/**
 * Every primitive, in isolation, in both themes. The Phase 1 gate: this route
 * must be complete before a single real screen is built.
 */
const SEGMENTS = [
  { value: 'unknown', label: 'Unknown' },
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
] as const

export function Sandbox() {
  const [selected, setSelected] = useState('bail')
  const [conf, setConf] = useState(0.78)
  const [segment, setSegment] = useState<(typeof SEGMENTS)[number]['value']>('unknown')
  const [sheetOpen, setSheetOpen] = useState(false)

  return (
    <div className="min-h-[100dvh] bg-paper px-8 py-12">
      <ThemeToggle className="fixed top-5 right-6 z-50 origin-top-right scale-[0.62]" />

      <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-8">
        <div>
          <H1>Component sandbox</H1>
          <Body>Toggle the theme at top right. Every primitive must hold up in both.</Body>
        </div>

        <Section name="Logo">
          <div className="flex items-center gap-6">
            <span className="grid size-8 place-items-center rounded-full border-2 border-ink text-ink">
              <Logo size={15} />
            </span>
            <Logo size={24} className="text-ink" />
            <Logo size={40} className="text-ink" />
          </div>
        </Section>

        <Section name="Typography">
          <Display>0.784</Display>
          <H1>Screen title in Space Mono</H1>
          <H2>Section header</H2>
          <Body>
            Body copy is Special Elite. It carries everything a person wrote. The face ships one
            weight, so hierarchy here comes from size, tracking and opacity rather than boldness.
          </Body>
          <div className="flex flex-wrap items-center gap-4">
            <Label>Field label</Label>
            <Caption>Eyebrow caption</Caption>
            <Data>CRL.A. 1274/2019</Data>
            <Data>IPC 302, 34</Data>
            <Data>F1 0.841</Data>
          </div>
        </Section>

        <Section name="Paper panels">
          <div className="grid gap-4 lg:grid-cols-2">
            {(['record', 'verdict', 'scan', 'ledger'] as const).map((v) => (
              <PaperPanel key={v} variant={v} className="px-6 py-8">
                <Caption>{v}</Caption>
                <p className="mt-2 font-mono text-h2 text-ink">Procedural grain</p>
              </PaperPanel>
            ))}
          </div>
        </Section>

        <Section name="Typewriter">
          <p className="font-mono text-h1 text-ink">
            <Typewriter key={String(conf)} text="In the matter of bail." speed={60} />
          </p>
        </Section>

        <Section name="Buttons and controls">
          <div className="flex flex-wrap items-center gap-3">
            <PrimaryButton>Run prediction</PrimaryButton>
            <PrimaryButton variant="secondary">Compare baseline</PrimaryButton>
            <PrimaryButton variant="ghost">Cancel</PrimaryButton>
            <PrimaryButton disabled>Disabled</PrimaryButton>
            <IconButton label="Retry"><RotateCcw size={16} strokeWidth={1.5} /></IconButton>
            <IconButton label="Open document"><FileText size={16} strokeWidth={1.5} /></IconButton>
            <IconButton label="Remove"><Trash2 size={16} strokeWidth={1.5} /></IconButton>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {['bail', 'qa', 'retrieval'].map((m) => (
              <Chip key={m} selected={selected === m} onClick={() => setSelected(m)}>
                {m}
              </Chip>
            ))}
            <Chip mono>IPC 420</Chip>
            <Chip mono>Section 437 CrPC</Chip>
          </div>
          <div className="flex flex-wrap gap-2">
            <StatPill label="Predictions" value="128" />
            <StatPill label="Avg confidence" value="74.2%" />
            <StatPill label="Corpus" value="35,121" />
          </div>
          <SegmentedControl options={SEGMENTS} value={segment} onChange={setSegment} />
        </Section>

        <Section name="Stat cards">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Case number" value="CRL.A. 1274/2019" confidence={0.94} />
            <StatCard label="Court" value={null} confidence={0.12} />
            <StatCard label="IPC sections" value="420, 406, 34" />
          </div>
        </Section>

        <Section name="List rows">
          <FloatingCard className="px-4">
            <ListRow
              icon={<Gavel size={16} strokeWidth={1.5} />}
              title="Bail: Extortion"
              subtitle="29 August 2026, 4:12 PM"
              value="granted · 82%"
            />
            <ListRow
              icon={<ScanLine size={16} strokeWidth={1.5} />}
              title="Scan: fir-copy.jpg"
              subtitle="29 August 2026, 3:58 PM"
              value="96%"
            />
          </FloatingCard>
        </Section>

        <Section name="Verdict stamps">
          <div className="flex flex-wrap items-center gap-6">
            <StampBadge tone="granted" size="lg">Bail granted</StampBadge>
            <StampBadge tone="denied" size="lg">Bail denied</StampBadge>
            <StampBadge tone="caution">Low OCR quality</StampBadge>
            <StampBadge tone="neutral">Baseline</StampBadge>
          </div>
        </Section>

        <Section name="Confidence meter">
          <FloatingCard className="flex flex-col gap-4 p-6">
            <ConfidenceMeter value={conf} />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={conf}
              aria-label="Sample confidence"
              onChange={(e) => setConf(Number(e.target.value))}
              className="accent-ink"
            />
          </FloatingCard>
        </Section>

        <Section name="Charts">
          <FloatingCard className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-3">
              <Caption>Factor bars (SHAP-style, diverging)</Caption>
              <BarChart
                data={[
                  { label: 'Prior record: No', value: 0.46, tone: 'granted' },
                  { label: 'Mentions "cooperated"', value: 0.31, tone: 'granted' },
                  { label: 'Crime type: Extortion', value: -0.22, tone: 'denied' },
                ]}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Caption>Baseline to final</Caption>
              <MetricComparisonBar
                tiers={[
                  { label: 'Baseline', value: 0.781 },
                  { label: 'Final', value: 0.8258, served: true },
                ]}
              />
            </div>
            <div className="flex flex-col gap-3">
              <Caption>Calibration curve</Caption>
              <CalibrationCurve
                points={[
                  { predicted: 0.17, observed: 0.15 },
                  { predicted: 0.5, observed: 0.38 },
                  { predicted: 0.76, observed: 0.79 },
                  { predicted: 0.98, observed: 0.96 },
                ]}
              />
            </div>
          </FloatingCard>
        </Section>

        <Section name="Span highlighter">
          <FloatingCard className="p-6">
            <SpanHighlighter
              text="The petitioner has been in judicial custody since 20.01.2021 and has cooperated fully with the investigation."
              highlight={{ start: 38, end: 58 }}
            />
          </FloatingCard>
        </Section>

        <Section name="Sheet">
          <PrimaryButton onClick={() => setSheetOpen(true)}>Open sheet</PrimaryButton>
          <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Sample sheet">
            <Body>Secondary content slides in from the right, never up from the bottom.</Body>
          </Sheet>
        </Section>

        <Section name="States">
          <div className="grid gap-4 lg:grid-cols-2">
            <FloatingCard className="flex flex-col gap-3 p-6">
              <Caption>Loading</Caption>
              <SkeletonBlock className="h-7 w-1/2" />
              <SkeletonBlock className="h-4 w-full" />
              <SkeletonBlock className="h-4 w-4/5" />
            </FloatingCard>
            <FloatingCard className="p-2">
              <EmptyState title="No results" body="Nothing matched that query. Try fewer terms." />
            </FloatingCard>
          </div>
          <ErrorState
            title="Could not reach the local model server"
            body="Confirm the backend is running on port 8000, then try again."
            onRetry={() => undefined}
          />
        </Section>

        <Section name="Disclaimer">
          <DisclaimerChip />
        </Section>
      </div>
    </div>
  )
}
