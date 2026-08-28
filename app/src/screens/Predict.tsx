import { useState } from 'react'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm, Controller } from 'react-hook-form'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError, ApiUnreachableError } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { ScreenHeader } from '@/components/feature/screen-header'
import { FloatingCard } from '@/components/ui/floating-card'
import { Chip } from '@/components/ui/chip'
import { IpcSectionPicker } from '@/components/feature/ipc-section-picker'
import { Stepper } from '@/components/feature/stepper'
import { SwitchField } from '@/components/ui/switch'
import { PrimaryButton } from '@/components/ui/button'
import { ErrorState } from '@/components/ui/states'
import { Sheet } from '@/components/ui/sheet'
import { BailResultPanel } from '@/components/feature/bail-result-panel'
import type { BailPredictResponse } from '@/lib/api-types'

const CRIME_CATEGORIES = [
  'Theft', 'Assault', 'Economic offence', 'Narcotics', 'Cybercrime', 'Forgery', 'Other',
]

const formSchema = z.object({
  crime_category: z.string().min(1, 'Choose a crime category.'),
  ipc_sections: z.array(z.string()).min(1, 'Add at least one IPC section.'),
  custody_days: z.number().int().min(0).max(20000),
  prior_record: z.boolean(),
  narrative: z.string().max(8000).optional(),
})

type FormValues = z.infer<typeof formSchema>

export function Predict() {
  const [sheetOpen, setSheetOpen] = useState(false)
  const [result, setResult] = useState<BailPredictResponse | null>(null)
  const recordActivity = useAppStore((s) => s.recordActivity)

  const { control, handleSubmit, watch, formState } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { crime_category: '', ipc_sections: [], custody_days: 30, prior_record: false, narrative: '' },
  })

  const mutation = useMutation({
    mutationFn: api.predictBail,
    onSuccess: (data, variables) => {
      setResult(data)
      setSheetOpen(true)
      recordActivity({
        kind: 'bail',
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        request: variables,
        response: data,
      })
    },
  })

  const values = watch()

  return (
    <>
      <ScreenHeader
        title="Predict Bail"
        subtitle="Structured case facts"
        stats={[
          { label: 'Model', value: 'xgboost-stub' },
          { label: 'Baseline', value: 'logreg-stub' },
        ]}
      />

      <form
        onSubmit={handleSubmit((v) => mutation.mutate(v))}
        className="flex flex-col gap-6 pb-28"
      >
        <FloatingCard className="flex flex-col gap-6 p-6">
          <div className="flex flex-col gap-2">
            <label className="text-label text-ink">Crime category</label>
            <Controller
              control={control}
              name="crime_category"
              render={({ field }) => (
                <div className="flex flex-wrap gap-2">
                  {CRIME_CATEGORIES.map((c) => (
                    <Chip key={c} selected={field.value === c} onClick={() => field.onChange(c)}>
                      {c}
                    </Chip>
                  ))}
                </div>
              )}
            />
            {formState.errors.crime_category && (
              <span className="text-caption text-denied">{formState.errors.crime_category.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="ipc" className="text-label text-ink">IPC sections</label>
            <Controller
              control={control}
              name="ipc_sections"
              render={({ field }) => <IpcSectionPicker id="ipc" value={field.value} onChange={field.onChange} />}
            />
            {formState.errors.ipc_sections && (
              <span className="text-caption text-denied">{formState.errors.ipc_sections.message}</span>
            )}
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor="custody" className="text-label text-ink">Custody duration</label>
              <Controller
                control={control}
                name="custody_days"
                render={({ field }) => (
                  <Stepper id="custody" value={field.value} onChange={field.onChange} suffix="days" />
                )}
              />
            </div>

            <div className="flex flex-col justify-end gap-2">
              <Controller
                control={control}
                name="prior_record"
                render={({ field }) => (
                  <SwitchField id="prior" label="Prior record" checked={field.value} onChange={field.onChange} />
                )}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="narrative" className="text-label text-ink">
              Case narrative <span className="text-ink-subtle">(optional)</span>
            </label>
            <Controller
              control={control}
              name="narrative"
              render={({ field }) => (
                <textarea
                  id="narrative"
                  rows={5}
                  {...field}
                  placeholder="Additional context the model can weigh alongside the structured facts."
                  className="resize-none rounded-[var(--radius-input)] border border-rule bg-paper px-3 py-2 text-body text-ink outline-none placeholder:text-ink-subtle focus:border-ink-subtle"
                />
              )}
            />
          </div>
        </FloatingCard>

        {mutation.isError && (
          <ErrorState
            title={
              mutation.error instanceof ApiUnreachableError
                ? mutation.error.message
                : mutation.error instanceof ApiError
                  ? mutation.error.message
                  : 'The prediction could not be completed.'
            }
            body="Confirm the backend is running, then try again."
            onRetry={() => mutation.mutate(values)}
          />
        )}

        {/* Sticky primary button (ARCHITECTURE.md section 4.2). */}
        <div className="sticky bottom-4 flex justify-end">
          <FloatingCard className="p-2">
            <PrimaryButton type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Running prediction…' : 'Run prediction'}
            </PrimaryButton>
          </FloatingCard>
        </div>
      </form>

      <Sheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Bail prediction">
        {result && <BailResultPanel request={values} response={result} />}
      </Sheet>
    </>
  )
}
