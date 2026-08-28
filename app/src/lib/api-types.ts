/**
 * Types mirroring the ARCHITECTURE.md section 6 API contract exactly.
 * One definition, imported everywhere - never redeclare a response shape in
 * a component (CLAUDE.md section 4).
 */

export interface Envelope<T> {
  ok: boolean
  data: T | null
  error: { code: string; message: string } | null
  latency_ms: number
}

// ---- Bail ------------------------------------------------------------

export interface BailPredictRequest {
  crime_category: string
  ipc_sections: string[]
  custody_days: number
  prior_record: boolean
  narrative?: string
}

export interface ShapFactor {
  name: string
  direction: 'for_grant' | 'for_denial'
  weight: number
}

export interface BailPredictResponse {
  outcome: 'granted' | 'denied'
  probability: number
  confidence_band: 'low' | 'medium' | 'high'
  factors: ShapFactor[]
  model_version: string
}

export interface BailBaselineResponse {
  outcome: 'granted' | 'denied'
  probability: number
  model_name: string
}

// ---- QA ----------------------------------------------------------------

export interface QaExtractRequest {
  case_id: string
  question: string
}

export interface QaExtractResponse {
  answer_span: string
  char_start: number
  char_end: number
  score: number
}

// ---- Summarize -----------------------------------------------------------

export interface SummarizeRequest {
  text?: string
  case_id?: string
  max_sentences: number
}

export interface SummarizeResponse {
  summary_sentences: string[]
  source_indices: number[]
  compression_ratio: number
}

// ---- Scan ----------------------------------------------------------------

export interface ScanEntities {
  case_number: string | null
  court: string | null
  parties: string[]
  ipc_sections: string[]
  dates: string[]
}

export interface ScanExtractResponse {
  raw_text: string
  ocr_confidence: number
  entities: ScanEntities
  field_confidence: Record<string, number>
}

// ---- Search --------------------------------------------------------------

export interface SearchRequest {
  query: string
  top_k: number
}

export interface SearchResult {
  case_id: string
  title: string
  court: string
  year: number
  score: number
  snippet: string
}

export interface SearchResponse {
  results: SearchResult[]
}

// ---- Metrics ---------------------------------------------------------------

export type MetricModule = 'bail' | 'qa' | 'summarization' | 'retrieval' | 'ner'

export interface MetricPoint {
  metric_name: string
  value: number
}

export interface CalibrationPoint {
  predicted: number
  observed: number
}

export interface FairnessAudit {
  metric: string
  gap_before: number
  gap_after: number
}

export interface ModuleMetrics {
  baseline: MetricPoint[]
  final: MetricPoint[]
  calibration_points: CalibrationPoint[] | null
  fairness: FairnessAudit | null
  dataset_size: number
  last_trained: string | null
}

export interface HealthResponse {
  status: string
  models_loaded: string[]
  uptime_s: number
}

// ---- Case detail -----------------------------------------------------------
// Not in ARCHITECTURE.md section 6 - an additive endpoint. See decisions.md D-013.

export interface CaseDetail {
  case_id: string
  title: string
  court: string
  year: number
  case_number: string
  ipc_sections: string[]
  full_text: string
  summary_sentences: string[]
  source_indices: number[]
}
