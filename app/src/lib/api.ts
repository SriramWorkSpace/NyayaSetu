/**
 * Typed client for the ARCHITECTURE.md section 6 API contract.
 *
 * Uses @tauri-apps/plugin-http (Rust-mediated, bypasses browser CORS
 * entirely) whenever running inside Tauri, and plain fetch otherwise, so the
 * same code path works in `vite dev` for frontend-only iteration and in the
 * shipped app (ARCHITECTURE.md section 5.3). Both point at the same
 * localhost:8000 - there is no separate "prod" to configure.
 */
import type {
  BailBaselineResponse,
  BailPredictRequest,
  BailPredictResponse,
  Envelope,
  HealthResponse,
  MetricModule,
  ModuleMetrics,
  QaExtractRequest,
  QaExtractResponse,
  ScanExtractResponse,
  SearchRequest,
  SearchResponse,
  SummarizeRequest,
  SummarizeResponse,
} from './api-types'

const BASE_URL = 'http://127.0.0.1:8000/api/v1'

declare global {
  interface Window {
    __TAURI__?: unknown
  }
}

/**
 * ApiError carries the envelope's structured error rather than a bare
 * message, so a caller can show "what broke and what to do" (CLAUDE.md
 * section 4) instead of a raw status code.
 */
export class ApiError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

/** Thrown when the backend cannot be reached at all (not a server error). */
export class ApiUnreachableError extends Error {
  constructor() {
    super('Could not reach the local model server. Confirm the backend is running on port 8000.')
    this.name = 'ApiUnreachableError'
  }
}

async function doFetch(
  path: string,
  init: { method: string; body?: BodyInit; headers?: Record<string, string> },
): Promise<Response> {
  const url = `${BASE_URL}${path}`
  if (typeof window !== 'undefined' && window.__TAURI__) {
    const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http')
    return tauriFetch(url, init)
  }
  return fetch(url, init)
}

async function request<T>(
  path: string,
  init: { method: string; body?: BodyInit; headers?: Record<string, string> },
): Promise<T> {
  let response: Response
  try {
    response = await doFetch(path, init)
  } catch {
    throw new ApiUnreachableError()
  }

  let envelope: Envelope<T>
  try {
    envelope = (await response.json()) as Envelope<T>
  } catch {
    throw new ApiError(String(response.status), 'The server returned an unreadable response.')
  }

  if (!envelope.ok || envelope.data === null) {
    throw new ApiError(envelope.error?.code ?? String(response.status), envelope.error?.message ?? 'Request failed.')
  }
  return envelope.data
}

function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export const api = {
  health: () => request<HealthResponse>('/health', { method: 'GET' }),

  predictBail: (payload: BailPredictRequest) => postJson<BailPredictResponse>('/predict/bail', payload),

  predictBailBaseline: (payload: BailPredictRequest) =>
    postJson<BailBaselineResponse>('/predict/bail/baseline', payload),

  qaExtract: (payload: QaExtractRequest) => postJson<QaExtractResponse>('/qa/extract', payload),

  summarize: (payload: SummarizeRequest) => postJson<SummarizeResponse>('/summarize', payload),

  searchPrecedent: (payload: SearchRequest) => postJson<SearchResponse>('/search/precedent', payload),

  /** Multipart upload - the one non-JSON request in the contract. */
  scanExtract: async (file: File): Promise<ScanExtractResponse> => {
    const form = new FormData()
    form.append('file', file)
    return request<ScanExtractResponse>('/scan/extract', { method: 'POST', body: form })
  },

  metrics: (module: MetricModule) => request<ModuleMetrics>(`/metrics/${module}`, { method: 'GET' }),
}
