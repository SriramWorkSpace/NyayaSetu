import { PlaceholderScreen } from './Placeholder'

/**
 * Phase 2 screen shells. Each carries its real header, stats strip and empty
 * state; the working content lands in Phase 4 against the API contract.
 */

export function Predict() {
  return (
    <PlaceholderScreen
      title="Predict Bail"
      subtitle="Structured case facts"
      stats={[{ label: 'Model', value: 'not loaded' }, { label: 'Baseline', value: 'not loaded' }]}
      emptyTitle="The prediction form lands in Phase 4"
      emptyBody="Crime category, IPC sections, custody duration and prior record, then a result panel with the probability, its SHAP factors and a live baseline comparison."
    />
  )
}

export function Scan() {
  return (
    <PlaceholderScreen
      title="Scan Document"
      subtitle="Camera capture and field extraction"
      stats={[{ label: 'OCR', value: 'not loaded' }, { label: 'NER', value: 'not loaded' }]}
      emptyTitle="Capture arrives in Phase 4"
      emptyBody="A document-edge frame over the camera, then extracted fields with per-field confidence. OCR error and extraction error are reported separately, always."
    />
  )
}

export function SearchPrecedent() {
  return (
    <PlaceholderScreen
      title="Search Precedent"
      subtitle="Natural language over past judgments"
      stats={[{ label: 'Index', value: 'not built' }, { label: 'Corpus', value: '0' }]}
      emptyTitle="Retrieval arrives in Phase 4"
      emptyBody="A query returns ranked judgments with their real similarity scores, not just rank order. The FAISS index is built in Phase 7."
    />
  )
}

export function CaseLibrary() {
  return (
    <PlaceholderScreen
      title="Case Library"
      subtitle="Saved cases and scan history"
      stats={[{ label: 'Saved', value: '0' }, { label: 'Scans', value: '0' }]}
      emptyTitle="Nothing saved yet"
      emptyBody="Predictions and scans you keep are collected here. Whether this survives an app restart is still open, and is settled in Phase 4."
    />
  )
}

export function Insights() {
  return (
    <PlaceholderScreen
      title="Model Insights"
      subtitle="Evaluation, served live"
      stats={[{ label: 'Modules', value: '0 / 5' }, { label: 'Last trained', value: 'never' }]}
      emptyTitle="Built last, on purpose"
      emptyBody="This screen depends on every module's real metrics existing. It renders baselines against final models, the calibration curve and the fairness audit, read from the backend at request time rather than hardcoded here."
    />
  )
}
