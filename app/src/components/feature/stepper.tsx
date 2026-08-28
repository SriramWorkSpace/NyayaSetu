import { Minus, Plus } from 'lucide-react'
import { IconButton } from '@/components/ui/button'

export interface StepperProps {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  id: string
  suffix?: string
}

export function Stepper({ value, onChange, min = 0, max = 20000, step = 1, id, suffix }: StepperProps) {
  function clamp(v: number) {
    return Math.min(max, Math.max(min, v))
  }
  return (
    <div className="flex items-center gap-3">
      <IconButton label="Decrease" onClick={() => onChange(clamp(value - step))}>
        <Minus size={14} strokeWidth={2} />
      </IconButton>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(clamp(Number(e.target.value) || 0))}
        className="w-20 rounded-[var(--radius-input)] border border-rule bg-paper px-3 py-2 text-center font-mono text-data text-ink outline-none focus:border-ink-subtle"
      />
      {suffix && <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">{suffix}</span>}
      <IconButton label="Increase" onClick={() => onChange(clamp(value + step))}>
        <Plus size={14} strokeWidth={2} />
      </IconButton>
    </div>
  )
}
