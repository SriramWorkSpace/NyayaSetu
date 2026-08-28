import { useState, type KeyboardEvent } from 'react'
import { X } from 'lucide-react'
import { Chip } from '@/components/ui/chip'

/**
 * Searchable multi-select with mono-styled chips (ARCHITECTURE.md section
 * 4.2). "Searchable" here is a datalist against common sections rather than
 * a full combobox - the fixture set is small enough that a typeahead list
 * covers the real need without a heavier dependency.
 */
const COMMON_SECTIONS = [
  '34', '120B', '147', '302', '304', '307', '323', '324', '354', '363',
  '376', '379', '380', '406', '420', '447', '452', '467', '468', '471', '506',
]

export interface IpcSectionPickerProps {
  value: string[]
  onChange: (v: string[]) => void
  id: string
}

export function IpcSectionPicker({ value, onChange, id }: IpcSectionPickerProps) {
  const [draft, setDraft] = useState('')

  function add(section: string) {
    const clean = section.trim()
    if (!clean || value.includes(clean)) return
    onChange([...value, clean])
    setDraft('')
  }

  function remove(section: string) {
    onChange(value.filter((s) => s !== section))
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault()
      add(draft)
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      remove(value[value.length - 1])
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 rounded-[var(--radius-input)] border border-rule bg-paper px-3 py-2">
        {value.map((section) => (
          <Chip key={section} mono onClick={() => remove(section)}>
            IPC {section}
            <X size={12} strokeWidth={2} />
          </Chip>
        ))}
        <input
          id={id}
          list={`${id}-options`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={value.length === 0 ? 'Type a section, press Enter' : ''}
          className="min-w-[8ch] flex-1 bg-transparent font-mono text-data text-ink outline-none placeholder:font-body placeholder:text-ink-subtle"
        />
        <datalist id={`${id}-options`}>
          {COMMON_SECTIONS.map((s) => (
            <option key={s} value={s} />
          ))}
        </datalist>
      </div>
    </div>
  )
}
