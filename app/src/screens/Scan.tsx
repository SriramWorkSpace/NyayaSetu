import { useRef, useState, useCallback, useEffect } from 'react'
import { Camera, Upload, RotateCcw, ScanLine } from 'lucide-react'
import { useMutation } from '@tanstack/react-query'
import { api, ApiError, ApiUnreachableError } from '@/lib/api'
import { useAppStore } from '@/lib/store'
import { ScreenHeader } from '@/components/feature/screen-header'
import { FloatingCard } from '@/components/ui/floating-card'
import { PaperPanel } from '@/components/ui/paper-panel'
import { PrimaryButton, IconButton } from '@/components/ui/button'
import { StatCard } from '@/components/ui/stat-card'
import { EmptyState, ErrorState, SkeletonBlock } from '@/components/ui/states'
import { Caption } from '@/components/ui/typography'
import type { ScanExtractResponse } from '@/lib/api-types'

type Stage = 'idle' | 'camera' | 'extracting' | 'result'

export function Scan() {
  const [stage, setStage] = useState<Stage>('idle')
  const [file, setFile] = useState<File | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [summary, setSummary] = useState<string[] | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordActivity = useAppStore((s) => s.recordActivity)

  const extract = useMutation({
    mutationFn: api.scanExtract,
    onSuccess: (data, uploadedFile) => {
      recordActivity({
        kind: 'scan',
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        fileName: uploadedFile.name,
        response: data,
      })
    },
  })

  const summarize = useMutation({
    mutationFn: (text: string) => api.summarize({ text, max_sentences: 5 }),
    onSuccess: (data) => setSummary(data.summary_sentences),
  })

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => () => stopCamera(), [stopCamera])

  async function startCamera() {
    setCameraError(null)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setStage('camera')
      // Video element mounts on the next render; attach once it exists.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream
      })
    } catch {
      // No camera, or permission denied. The "choose file" path stays
      // available, so this is a fallback, not a dead end
      // (ARCHITECTURE.md section 4.4).
      setCameraError('Camera unavailable. Choose a file instead.')
    }
  }

  function capture() {
    const video = videoRef.current
    if (!video) return
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    canvas.getContext('2d')?.drawImage(video, 0, 0)
    canvas.toBlob((blob) => {
      if (!blob) return
      const captured = new File([blob], 'capture.jpg', { type: 'image/jpeg' })
      stopCamera()
      runExtract(captured)
    }, 'image/jpeg')
  }

  function runExtract(f: File) {
    setFile(f)
    setSummary(null)
    setStage('extracting')
    extract.mutate(f, { onSettled: () => setStage('result') })
  }

  function reset() {
    stopCamera()
    setFile(null)
    setSummary(null)
    setCameraError(null)
    setStage('idle')
  }

  const data = extract.data as ScanExtractResponse | undefined
  const lowOcr = data ? data.ocr_confidence < 0.5 : false

  return (
    <>
      <ScreenHeader
        title="Scan Document"
        subtitle="Camera capture and field extraction"
        stats={[
          { label: 'OCR', value: data ? `${Math.round(data.ocr_confidence * 100)}%` : 'pending' },
          {
            label: 'Fields found',
            value: data ? String(Object.values(data.entities).flat().filter(Boolean).length) : 'pending',
          },
        ]}
      />

      {stage === 'idle' && (
        <PaperPanel variant="scan" className="px-8 py-16">
          <div className="mx-auto flex max-w-md flex-col items-center gap-6 text-center">
            <ScanLine size={32} strokeWidth={1.2} className="text-ink-subtle" />
            <p className="text-body text-ink-muted">
              Capture a physical legal document, or choose a photo already on disk.
            </p>
            {cameraError && <p className="text-caption text-caution">{cameraError}</p>}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <PrimaryButton onClick={startCamera}>
                <Camera size={16} strokeWidth={1.5} /> Use camera
              </PrimaryButton>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-rule bg-paper-raised px-6 py-2.5 text-label transition-colors hover:border-ink-subtle">
                <Upload size={16} strokeWidth={1.5} /> Choose file
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && runExtract(e.target.files[0])}
                />
              </label>
            </div>
          </div>
        </PaperPanel>
      )}

      {stage === 'camera' && (
        <FloatingCard className="relative overflow-hidden p-2">
          <div className="relative aspect-video overflow-hidden rounded-[var(--radius-card)] bg-ink">
            <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
            <div
              aria-hidden
              className="pointer-events-none absolute inset-8 rounded-lg border-2 border-dashed border-paper/60"
            />
          </div>
          <div className="flex items-center justify-center gap-3 py-4">
            <PrimaryButton onClick={capture}>Capture</PrimaryButton>
            <PrimaryButton variant="ghost" onClick={reset}>
              Cancel
            </PrimaryButton>
          </div>
        </FloatingCard>
      )}

      {stage === 'extracting' && (
        <FloatingCard className="flex flex-col gap-4 p-6">
          <SkeletonBlock className="h-6 w-1/3" />
          <div className="grid gap-4 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonBlock key={i} className="h-16 w-full" />
            ))}
          </div>
        </FloatingCard>
      )}

      {stage === 'result' && extract.isError && (
        <ErrorState
          title={
            extract.error instanceof ApiUnreachableError
              ? extract.error.message
              : extract.error instanceof ApiError
                ? extract.error.message
                : 'Could not extract this document.'
          }
          body="Confirm the backend is running, then retake or retry."
          onRetry={() => file && runExtract(file)}
        />
      )}

      {stage === 'result' && data && (
        <div className="flex flex-col gap-6">
          <FloatingCard className="flex flex-wrap items-center justify-between gap-3 p-4">
            <span
              className={
                lowOcr
                  ? 'rounded-full border border-caution px-3 py-1 text-caption uppercase tracking-[0.05em] text-caution'
                  : 'rounded-full border border-rule px-3 py-1 text-caption uppercase tracking-[0.05em] text-ink-muted'
              }
            >
              OCR confidence {Math.round(data.ocr_confidence * 100)}%
            </span>
            <IconButton label="Retake" onClick={reset}>
              <RotateCcw size={16} strokeWidth={1.5} />
            </IconButton>
          </FloatingCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label="Case number"
              value={data.entities.case_number}
              confidence={data.field_confidence.case_number}
            />
            <StatCard label="Court" value={data.entities.court} confidence={data.field_confidence.court} />
            <StatCard
              label="Parties"
              value={data.entities.parties.join(', ') || null}
              confidence={data.field_confidence.parties}
            />
            <StatCard
              label="IPC sections"
              value={data.entities.ipc_sections.join(', ') || null}
              confidence={data.field_confidence.ipc_sections}
            />
            <StatCard
              label="Dates"
              value={data.entities.dates.join(', ') || null}
              confidence={data.field_confidence.dates}
            />
          </div>

          <Caption className="text-ink-subtle">
            Field confidence reflects extraction quality on already-OCR'd text. A low OCR-confidence score above
            means the scan itself was hard to read; a low field score on clean text means the extraction model
            missed it. The two are measured and reported separately.
          </Caption>

          <div className="flex justify-start">
            <PrimaryButton
              variant="secondary"
              onClick={() => summarize.mutate(data.raw_text)}
              disabled={summarize.isPending}
            >
              {summarize.isPending ? 'Summarizing...' : 'Summarize this text'}
            </PrimaryButton>
          </div>

          {summarize.isError && (
            <ErrorState title="Could not summarize" body="Try again." onRetry={() => summarize.mutate(data.raw_text)} />
          )}

          {summary && (
            <FloatingCard className="flex flex-col gap-2 p-6">
              <span className="text-caption uppercase tracking-[0.05em] text-ink-subtle">Summary</span>
              <ul className="flex flex-col gap-2">
                {summary.map((s, i) => (
                  <li key={i} className="text-body text-ink-muted">
                    {s}
                  </li>
                ))}
              </ul>
            </FloatingCard>
          )}
        </div>
      )}

      {stage === 'idle' && (
        <FloatingCard className="mt-6 p-2">
          <EmptyState title="Nothing scanned yet" body="Captured and uploaded documents appear here, field by field." />
        </FloatingCard>
      )}
    </>
  )
}
