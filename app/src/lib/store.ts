import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { BailPredictRequest, BailPredictResponse, ScanExtractResponse } from './api-types'

/**
 * Session state: last activity, saved cases, scan history.
 *
 * Zustand + localStorage persistence, not SQLite (ARCHITECTURE.md section 12
 * open decision, settled here as decisions.md D-012): this is a client-side
 * convenience store, not a source of truth the backend reads. It survives an
 * app restart via localStorage, which covers the demo need without standing
 * up tauri-plugin-sql for a single-user local app.
 */

export interface BailActivity {
  kind: 'bail'
  id: string
  at: string
  request: BailPredictRequest
  response: BailPredictResponse
}

export interface ScanActivity {
  kind: 'scan'
  id: string
  at: string
  fileName: string
  response: ScanExtractResponse
}

export type Activity = BailActivity | ScanActivity

export interface SavedCase {
  caseId: string
  title: string
  court: string
  year: number
  savedAt: string
}

interface AppState {
  activity: Activity[]
  savedCases: SavedCase[]
  recordActivity: (a: Activity) => void
  saveCase: (c: SavedCase) => void
  unsaveCase: (caseId: string) => void
  isCaseSaved: (caseId: string) => boolean
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      activity: [],
      savedCases: [],
      recordActivity: (a) =>
        set((s) => ({ activity: [a, ...s.activity].slice(0, 50) })),
      saveCase: (c) =>
        set((s) => (s.savedCases.some((x) => x.caseId === c.caseId) ? s : { savedCases: [c, ...s.savedCases] })),
      unsaveCase: (caseId) =>
        set((s) => ({ savedCases: s.savedCases.filter((c) => c.caseId !== caseId) })),
      isCaseSaved: (caseId) => get().savedCases.some((c) => c.caseId === caseId),
    }),
    { name: 'nyayasetu.session' },
  ),
)
