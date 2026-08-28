# NyayaSetu: Indian Legal Intelligence Suite — Architecture

> Single source of truth for the build. Read this fully before writing code.
> **Owner:** Sriram Madala 
> **Platform:** Desktop app (Tauri), local-first demo
> **Status:** Planning → Build

---

## 1. What this is

A desktop application for the Indian judicial domain, backed by five independently trained machine learning models running entirely on your own machine. A user can predict a bail outcome and see why, ask questions about a judgment, scan a physical legal document to extract its details, summarize case text, and search past case law for relevant precedent. A dedicated screen inside the app exposes the actual evaluation methodology, so the data science work is visible, not just the predictions it produces.

**Goals, in priority order:**

1. **Rigorous, visible ML.** Every predictive component is trained and evaluated in-house, and the evaluation itself is a first-class part of the product, not a hidden report.
2. **Clean, deliberate UI/UX.** The interface is a primary deliverable, held to production design standards, not a form bolted onto a model.
3. **A frictionless local demo.** Everything runs on one machine, one process tree, no tunnels, no cloud hosting, no waiting on external services to be reachable.

**Explicit non-goals:** legal advice, a court-ready tool, multi-language support (v1 is English), public hosting, user accounts / auth, mobile distribution.

---

## 2. Feature set

### 2.1 Product features

| # | Feature | Summary |
|---|---|---|
| 1 | Bail Outcome Prediction | Structured case inputs → predicted outcome + probability |
| 2 | Fairness Audit | Bias check on the bail model, controlling for legitimate legal factors |
| 3 | Extractive Question Answering | Ask a question, get the answer highlighted inside the source judgment |
| 4 | Document Scan + Field Extraction | Camera capture → OCR → structured fields (case number, parties, IPC sections, dates) |
| 5 | Case Summarization | Full judgment text → condensed extractive summary, run independently |
| 6 | Precedent Search | Natural-language query → ranked relevant past judgments |
| 7 | Desktop App | Tauri shell, local backend, no external hosting |
| 8 | Confidence & Fairness Indicators | Every prediction shows its confidence and, where relevant, its fairness check |
| 9 | Not-Legal-Advice Disclaimer | Persistent, visible on every model output |

Document Scan and Summarization are **independent** modules. Scanning does not automatically summarize; a user runs each deliberately. This keeps each module's evaluation and UI honest to what it actually does.

### 2.2 Data science transparency features

These exist specifically to make the DS work visible and demo-able, not buried in a report.

| # | Feature | What it shows |
|---|---|---|
| 10 | Model Insights screen | Dedicated in-app screen rendering evaluation metrics, baseline comparisons, and the fairness audit as charts |
| 11 | Live `/metrics` endpoint | Metrics served from the running backend, not hardcoded into the UI — retrain a model and the app reflects it |
| 12 | Baseline-vs-final comparison | Every module's simple baseline and final model shown side by side on the same metric |
| 13 | Live baseline toggle | On the bail result screen, re-run the same input through the baseline model and compare in real time |
| 14 | SHAP feature attribution | Bail predictions show which factors drove the outcome, and in which direction |
| 15 | Calibration display | "When this model says 70% confident, it's right about 70% of the time," pulled from the real calibration curve |
| 16 | Extractive span highlighting | QA answers highlighted in place inside the judgment, not generated text |
| 17 | Summary sentence provenance | Summarizer shows which original sentences were selected and why |
| 18 | Retrieval similarity scores | Precedent search results show their actual similarity score, not just rank order |
| 19 | OCR vs. extraction error separation | Document scan errors attributed to OCR failure or NER failure separately |
| 20 | Per-module model cards | `MODEL_CARD.md` per model: data, training procedure, evaluation, limitations |

### 2.3 Explicit non-reliance on generative AI

All five core components (bail prediction, QA, summarization, retrieval, NER extraction) are trained and evaluated in-house. The only two API touchpoints in the entire app are cosmetic — query rephrasing before search, and turning a raw prediction into a readable sentence — and neither affects any reported metric. This boundary is stated in the UI (§4.7) and in the model cards, not just in this document.

---

## 3. Design system

Visual direction: near-black canvas, iridescent mesh-gradient hero panels, Urbanist geometric sans, pill-shaped controls, oversized numerals. Chosen deliberately against the genre default for legal software (dense serif-on-white, government-portal styling) — a calm dark surface with one luminous focal element per screen makes a serious tool feel considered rather than institutional.

### 3.1 Color tokens

```css
:root {
  --bg:              #0C0C0C;   /* canvas, ~70% of every screen */
  --surface:         #181818;   /* cards, list rows */
  --surface-raised:  #242424;   /* inputs, secondary buttons, elevated cards */
  --stroke:          #2E2E2E;   /* 1px hairlines, card borders */
  --accent:          #6578C8;   /* primary accent, active states, data highlight */
  --accent-dim:      #3E4878;   /* accent at rest, inactive chart bars */
  --fg:              #FFFFFF;   /* primary text, primary CTA fill */
  --fg-muted:        #8A8A8A;   /* labels, captions, inactive nav */
  --fg-subtle:       #5A5A5A;   /* metadata, timestamps — never body copy */

  --granted:         #5FB88F;   /* bail-granted outcome */
  --denied:          #C97064;   /* bail-denied outcome */
  --caution:         #C9A227;   /* low-confidence / low-OCR-quality warning */
  --metric-good:     #5FB88F;   /* metrics slide: model beat baseline */
  --metric-flat:     #8A8A8A;   /* metrics slide: no meaningful change */
}
```

Outcome and metric colors are deliberately muted, not stoplight-saturated. A loud red for "denied" or "model got worse" editorializes a result the data should speak for on its own.

### 3.2 The gradient panel

The signature element, one per primary screen, nothing else on that screen competes with it.

CSS gradients read as flat and templated for this look — do not attempt it with `background: linear-gradient(...)` stacking. **Pre-render 4 mesh-gradient PNGs/WebPs** (1600×900, ~80KB each) in Figma (mesh gradient plugin) or a small Python script (Perlin-noise-seeded radial blends), ship as static assets, and apply a slow CSS `background-position`/`transform: scale()` drift (10–14s, `prefers-reduced-motion` respected) so the panel breathes.

Variants:
- `aurora` — home / neutral
- `verdict` — bail result screen, cooler and bluer
- `scan` — document scan capture and result
- `insights` — Model Insights screen, subtly more structured/technical-feeling

### 3.3 Typography

**Urbanist** (Google Fonts, OFL license) as the primary face, self-hosted via `@fontsource/urbanist` so the app works fully offline.

| Role | Size / Weight | Use |
|---|---|---|
| Display | 56 / 700, tracking -1 | one big number per screen: probability, F1 score, confidence |
| H1 | 28 / 700 | screen titles |
| H2 | 20 / 600 | section headers |
| Body | 15 / 400, line-height 1.5 | paragraphs, judgment text, summaries |
| Label | 13 / 500 | field labels, list row titles |
| Caption | 11 / 500, tracking +0.5, uppercase | eyebrows, metadata, metric names |
| Mono | JetBrains Mono 13 / 400 | IPC sections, case numbers, statute codes, metric values on the Insights screen |

Mono is used specifically for anything that is an identifier or a measured number rather than prose — case numbers, statute citations, F1/ROUGE/Precision@k values — so machine-extracted or machine-measured content is visually distinct from written text.

### 3.4 Layout & motion

- **Spacing scale:** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64. Content max-width 1120px, centered, since this is a desktop window, not a phone screen.
- **Radius:** 12 (inputs, small cards), 20 (content cards), 28 (gradient hero panel), 999 (pills, segmented controls).
- **Elevation:** no drop shadows on dark backgrounds. Depth comes from `--surface` → `--surface-raised` steps and 1px `--stroke` hairlines only.
- **Motion:** Framer Motion. Screen transitions 220ms ease-out. Numbers count up on first render (400ms). Chart bars stagger in at 40ms intervals. All gated behind `usePrefersReducedMotion()`.
- **Window:** default 1280×832, min 1024×720. This is a desktop app; design for a resizable window, not a fixed viewport — components must reflow between a 1024px and a 1600px window without breaking.

### 3.5 Component inventory

Build once in `src/components/ui/`, reuse everywhere. No per-screen one-offs.

`GradientPanel` · `StatCard` · `SegmentedControl` · `ListRow` · `PrimaryButton` · `IconButton` · `Chip` · `BarChart` (hand-rolled SVG) · `ConfidenceMeter` · `MetricComparisonBar` · `CalibrationCurve` (hand-rolled SVG) · `SpanHighlighter` · `EmptyState` · `SkeletonBlock` · `Toast` · `Sheet` (side panel, replaces mobile bottom sheet)

Charts are hand-rolled SVG (`d3-scale` for math only, no chart library rendering), because off-the-shelf chart libraries impose their own visual defaults that will fight this design system, and the actual chart complexity here (bar comparisons, a calibration curve, a confidence meter) is small enough to own directly.

---

## 4. Screen architecture

Left rail navigation (desktop convention, not a bottom tab bar), collapsible, icon + label. Six destinations:

```
┌─ App Shell
│   ├── Home                index
│   ├── Predict Bail         predict
│   ├── Scan Document        scan
│   ├── Search Precedent     search
│   ├── Case Library         library     (saved cases, scan history)
│   └── Model Insights       insights    (§2.2 DS transparency screen)
└─ Overlays
    ├── Result panel         (slides in from the right — bail result, scan result)
    ├── Case detail          (full view — judgment text, QA, summary)
    └── Settings
```

### 4.1 Home
Gradient panel (`aurora`) showing the most recent activity instead of a balance figure — last prediction or last scan, whichever is more recent. Below: three quick actions (Predict · Scan · Search) as equal-weight cards. Below that: a recent-activity list, each row an icon chip, title, subtitle, and right-aligned result value.

### 4.2 Predict Bail
A grouped form, not a wall of fields: crime category (chip select), IPC sections (searchable multi-select with mono-styled chips), custody duration (stepper), prior record (toggle), optional case narrative (textarea). Sticky primary button opens the **Result panel**.

### 4.3 Result panel (bail)
Gradient panel (`verdict`) with the outcome and probability in Display type. Below: `ConfidenceMeter`, then a horizontal bar chart of top SHAP factors (name, direction arrow, magnitude). Then a one-line calibration note pulled from `/metrics` (§2.2 #15). Then the **live baseline toggle** (§2.2 #13) — flipping it re-queries `/predict/bail/baseline` with the same inputs and shows both predictions stacked. Persistent disclaimer chip at the bottom.

### 4.4 Scan Document
Camera capture view (browser `getUserMedia` inside the Tauri webview) with a document-edge frame overlay, or a "choose file" fallback for a photo already on disk. After capture: skeleton loading, then a two-column `StatCard` grid of extracted fields, an OCR-confidence chip (amber if low, with a "Retake" action), and the field-vs-OCR error split (§2.2 #19) shown as a small caption, not hidden. A separate "Summarize this text" button sends the OCR'd text to `/summarize` on demand — deliberately a second, explicit step (§2.1).

### 4.5 Search Precedent
Search field under a gradient panel (`aurora`, reused). Results as `ListRow`s: case title, court/year in caption, similarity score right-aligned in mono. Selecting a result opens **Case Detail**.

### 4.6 Case Detail
Judgment text with the extractive summary pinned in a collapsed card at the top, sentence provenance visible on expand (§2.2 #17). A floating "Ask" button opens a `Sheet` where a typed question returns a highlighted span **inside the judgment text itself**, scrolled into view — never a separate chat-style answer bubble, since the model is extractive and the UI should say so honestly.

### 4.7 Model Insights *(new — the DS-transparency screen)*
Gradient panel (`insights`). A `SegmentedControl` across the five modules. For the selected module:
- Baseline → final model comparison as a `MetricComparisonBar` (e.g., LogReg 0.71 F1 → XGBoost 0.78 → InLegalBERT 0.84, three bars, one metric)
- Full metric table (mono values): F1, PR-AUC, ROUGE, Precision@k, MRR, entity F1 — whichever apply to that module
- For Bail specifically: the `CalibrationCurve` and the fairness audit's disparity numbers, before and after controlling for legitimate factors
- Dataset size and last-trained timestamp, sourced live from `/metrics`
- A closing note, identical in spirit to §2.3, restating that this module is independently trained and what, if anything, an API touches at its edge

This screen is not an afterthought tab; it is where a demo should end. Predict something, then walk straight into Insights and show the model that produced it, its baseline, and its calibration.

---

## 5. Tech stack

### 5.1 Desktop shell

| Concern | Choice | Why |
|---|---|---|
| Shell | **Tauri 2.x** | Native window over the OS webview; ~3–10MB binary vs. Electron's ~100MB+; Rust core with a tiny attack surface |
| Frontend framework | **React 18 + Vite + TypeScript (strict)** | Vite is Tauri's first-class default; no server-rendering concerns since there's no server to deploy |
| Styling | **Tailwind CSS v4** | Utility classes map directly to the token system in §3.1; no NativeWind translation layer needed since this is DOM, not native |
| Component primitives | **Radix UI** (unstyled) + a thin custom layer | Accessible, unopinionated visually — styled entirely from the token system, nothing to fight |
| Motion | **Framer Motion** | Declarative, respects reduced-motion, works natively in a webview |
| Charts | **Hand-rolled SVG** + `d3-scale` for axis math | See §3.5 rationale |
| Icons | **lucide-react** | Same icon family as originally planned, web build |
| Fonts | **@fontsource/urbanist**, **@fontsource/jetbrains-mono** | Self-hosted, fully offline |
| Client state | **Zustand** | Small, no boilerplate |
| Server state | **@tanstack/react-query** | Caching, retry, and loading states for model calls that can take a few seconds |
| Forms | **react-hook-form** + **zod** | Typed validation for the bail-prediction form |
| Camera | Browser `getUserMedia` (native to the Tauri webview) | No native camera plugin needed; works identically to a browser |
| Backend calls | **`@tauri-apps/plugin-http`** | Rust-mediated HTTP request, bypasses browser CORS entirely — see §5.3 |

**Rejected:** Electron (heavier, slower cold start, larger attack surface for no real benefit here). Next.js (built around server rendering/routing this app doesn't need — there's no server to deploy to). A JS chart library (Recharts/Chart.js/Victory) — their visual defaults are strong opinions that fight a bespoke design system; the actual charts needed here are simple enough to own directly.

### 5.2 Backend

| Concern | Choice |
|---|---|
| Framework | **FastAPI**, Python 3.11 |
| Server | **uvicorn** (single process, local only — no gunicorn/multi-worker needed for a local demo) |
| Validation | **Pydantic v2** |
| ML | PyTorch · transformers · scikit-learn · XGBoost · spaCy · sentence-transformers · FAISS · SHAP |
| OCR | **Tesseract** via `pytesseract` |
| Metrics storage | JSON files in `ml/reports/`, read by the `/metrics` endpoint at request time (cheap, no DB needed for this scale) |
| Packaging (optional, later) | **PyInstaller** → single binary, run as a Tauri sidecar |

Models load **once at startup** into module-level singletons. Cold-loading InLegalBERT per request turns a 300ms endpoint into a 20-second one; this is a hard rule, not a nice-to-have.

### 5.3 How the two halves talk

Both processes run on the same machine. Two options, in order of preference:

**Preferred — Tauri HTTP plugin.** The frontend calls `@tauri-apps/plugin-http`'s `fetch`, which is executed by the Rust core, not the webview. This sidesteps browser CORS entirely, since the browser never makes the cross-origin request itself — Rust does, and hands the result to JS. No CORS configuration needed on FastAPI at all.

```ts
import { fetch } from '@tauri-apps/plugin-http';
const res = await fetch('http://localhost:8000/predict/bail', {
  method: 'POST',
  body: JSON.stringify(payload),
});
```

**Fallback — plain `fetch` with CORS enabled.** Useful while developing the frontend alone in a regular browser tab (`vite dev`, no Tauri wrapper) before wiring it into Tauri. Keep this working by leaving CORS enabled in FastAPI:

```python
from fastapi.middleware.cors import CORSMiddleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:1420", "http://localhost:5173"],  # Vite dev ports
    allow_methods=["*"], allow_headers=["*"],
)
```

Use the Tauri plugin for the shipped app; keep the CORS fallback for browser-only dev convenience. Both point at the same `http://localhost:8000`, so no environment-variable juggling between dev and "prod" — there is no prod, it's all local.

---

## 6. API contract

Base: `http://localhost:8000/api/v1/*`. Every response: `{ ok, data, error, latency_ms }`.

```
POST /predict/bail
  → { crime_category, ipc_sections[], custody_days, prior_record, narrative? }
  ← { outcome, probability, confidence_band,
      factors: [{ name, direction, weight }],     // SHAP
      model_version }

POST /predict/bail/baseline        # for the §4.3 live toggle
  → same payload as above
  ← { outcome, probability, model_name: "logistic_regression" }

POST /qa/extract
  → { case_id, question }
  ← { answer_span, char_start, char_end, score }

POST /summarize
  → { text | case_id, max_sentences }
  ← { summary_sentences[], source_indices[], compression_ratio }

POST /scan/extract                 # multipart image, standalone — no auto-summarize
  ← { raw_text, ocr_confidence,
      entities: { case_number, court, parties[], ipc_sections[], dates[] },
      field_confidence: { [field]: number } }

POST /search/precedent
  → { query, top_k }
  ← { results: [{ case_id, title, court, year, score, snippet }] }

GET  /metrics/{module}              # bail | qa | summarization | retrieval | ner
  ← { baseline: { metric_name, value }[],
      final: { metric_name, value }[],
      calibration_points?: [{ predicted, observed }],   // bail only
      fairness?: { metric, gap_before, gap_after },      // bail only
      dataset_size, last_trained }

GET  /health
  ← { status, models_loaded[], uptime_s }
```

`/scan/extract` intentionally does **not** return a summary — summarization is a separate, explicit `/summarize` call the user triggers themselves (§2.1). `/metrics` is read by the Model Insights screen and nothing else touches it; it has no side effects and is safe to poll.

---

## 7. ML modules

| Module | Data | Baseline → Final | Metric | Explainability surfaced |
|---|---|---|---|---|
| **Bail prediction** | IndianBailJudgments-1200; structured + reasoning text | LogReg → XGBoost (structured + TF-IDF) → InLegalBERT (fused) | F1, PR-AUC, calibration | SHAP factors, calibration curve |
| **Fairness audit** | same | Disparity test controlling for crime severity, prior record | Demographic parity gap, per-segment F1 | Insights screen, before/after gap |
| **Extractive QA** | ILDC / CJPE gold spans, sliding-window chunked | TF-IDF retrieval → fine-tuned InLegalBERT span head | Exact Match, F1 | Span highlighted in source text |
| **Summarization** | Judgments + headnotes | TextRank → supervised sentence classifier | ROUGE-1/2/L | Selected-sentence provenance |
| **Precedent retrieval** | Indian Kanoon corpus, 300–500 token chunks | MiniLM embeddings → InLegalBERT embeddings, FAISS | Precision@k, Recall@k, MRR | Similarity score per result |
| **Document NER** | Weak-supervised regex over labeled judgments | Regex baseline → spaCy NER | Per-entity F1 + OCR CER (separate) | Per-field confidence |

**Reporting rule, unchanged:** OCR error and extraction error are measured and reported separately, always. A field missed because Tesseract garbled the image is not the same failure as a field the NER model mislabeled from clean text, and the UI (§4.4) and the `/metrics` payload both keep that distinction visible.

---

## 8. Repository layout

```
legal-intelligence-suite/
├── ARCHITECTURE.md
├── app/                          # Tauri application
│   ├── src/                      # React frontend
│   │   ├── screens/               # Home, Predict, Scan, Search, Library, Insights
│   │   ├── components/
│   │   │   ├── ui/                 # §3.5 inventory
│   │   │   └── feature/
│   │   ├── lib/  api.ts · store.ts · theme.ts
│   │   ├── assets/  gradients/ · fonts/
│   │   ├── main.tsx
│   │   └── App.tsx
│   ├── src-tauri/                 # Rust shell
│   │   ├── src/  main.rs
│   │   ├── tauri.conf.json
│   │   └── Cargo.toml
│   ├── tailwind.config.ts         # tokens live here, single source
│   ├── vite.config.ts
│   └── package.json
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── routers/                # one per §6 endpoint group
│   │   ├── models/                 # loaders, singletons
│   │   └── schemas/
│   ├── artifacts/                  # trained weights, FAISS index (git-lfs)
│   └── requirements.txt
├── ml/
│   ├── notebooks/                  # exploration only, nothing production reads these
│   ├── src/  data/ · features/ · train/ · evaluate/
│   └── reports/                    # metrics JSON (feeds /metrics) + MODEL_CARD.md per module
└── docs/
```

`ml/` trains and writes both `backend/artifacts/` (weights) and `ml/reports/*.json` (the metrics `/metrics` serves). `backend/` only ever loads; it never trains inside the API process.

---

## 9. Build order

Backend and models first, always. A polished app calling nothing is not a demo; a plain app calling five working, evaluated models is.

**Phase 1 — Data & baselines.** Load IndianBailJudgments-1200 and ILDC. Audit annotation quality by hand on a sample. Build LogReg and XGBoost bail baselines end to end, write metrics to `ml/reports/bail.json`.

**Phase 2 — Models.** Fine-tune the bail transformer and the QA span head. Build the summarizer (TextRank, then the classifier). Build the FAISS retrieval index. Train NER on weak-supervised labels. Every module writes its metrics JSON before the next module starts, and gets its `MODEL_CARD.md`.

**Phase 3 — Fairness audit.** Its own phase, not folded into Phase 2 — disparity testing with legal-factor controls, written up as its own report and its own section in `bail.json`.

**Phase 4 — Backend API.** FastAPI wrapping all five modules plus `/predict/bail/baseline` and `/metrics`. Singleton loading verified (log a timestamp at model load, confirm it only fires once per process). Verify every endpoint with `curl` before touching the frontend.

**Phase 5 — Design system.** Generate the four gradient assets. Wire tokens into `tailwind.config.ts`. Build the §3.5 component inventory in an isolated sandbox route before starting real screens.

**Phase 6 — Tauri shell.** Scaffold `tauri init` against the Vite app. Wire `@tauri-apps/plugin-http`. Confirm a round trip to `/health` renders in the actual native window, not just the browser dev server, before building further — the webview and browser can behave differently and this catches it early.

**Phase 7 — Screens.** Home → Predict → Result panel → Scan → Search → Case Detail. Real backend data from the first screen, no mocked responses.

**Phase 8 — Model Insights screen.** Built last on purpose — it depends on every other module's `/metrics` payload existing and being accurate, and it is the screen most worth getting right since it's where a demo should end.

**Phase 9 — Polish.** Motion pass, empty/loading/error states for every screen, reduced-motion audit, window-resize testing at 1024px and 1600px.

**Phase 10 — Package (optional).** `tauri build` for a native installer if you want one; for a live demo, `tauri dev` (frontend) alongside `uvicorn` (backend) in two terminals is sufficient and simpler to iterate on.

---

## 10. Running it locally

Two processes, one machine, no network dependency beyond `localhost`:

```bash
# terminal 1 — backend
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# terminal 2 — desktop app
cd app
npm install
npm run tauri dev
```

Warm the models once before any demo — fire a throwaway request at `/health` or `/predict/bail` right after startup, since the first request after a cold process start pays the model-load cost if singleton warm-up wasn't triggered explicitly at boot. Best practice: trigger warm-up **inside** `app.main` on FastAPI's startup event, so it's already paid by the time `uvicorn` reports "Application startup complete."

```python
@app.on_event("startup")
async def warm_models():
    load_all_models()   # populates the singletons; log timing per model
```

---

## 11. Quality floor

Ship nothing that fails these:

- Every screen has a designed empty, loading, and error state. Loading is a skeleton, never a bare spinner.
- Errors state what broke and what to do: *"Could not reach the local model server. Confirm the backend is running on port 8000."* Never a raw stack trace or bare status code.
- Every prediction carries a visible confidence indicator and the disclaimer chip.
- Reduced motion respected everywhere Framer Motion is used.
- Text contrast ≥ 4.5:1 against `--bg`. `--fg-subtle` is metadata only, never body copy.
- No hardcoded colors or spacing outside the token system in `tailwind.config.ts`.
- Window resizes cleanly between 1024px and 1600px without overflow or clipped content.
- Cold app launch to first meaningful paint under 2s; backend model warm-up under 10s, with a visible "warming up" state if the frontend connects before it's ready.

---

## 12. Open decisions

Resolve before the phase that depends on each.

- **Gradient generation method** — Figma plugin (faster once, manual) vs. a small Python script (reproducible, tunable per screen). *(Phase 5)*
- **NER backbone** — spaCy (lighter, faster to iterate) vs. InLegalBERT token classification (likely stronger, heavier to serve locally). Benchmark both on the same weak-supervised set before committing. *(Phase 2)*
- **Judgment corpus size for FAISS** — cap the Indian Kanoon subset at a defensible size (e.g. 20–30k judgments) for local memory/index-build time, and state the cap explicitly in the retrieval model card. *(Phase 2)*
- **Sidecar packaging** — bundle FastAPI as a PyInstaller binary launched automatically by Tauri, vs. keep it a manually-run second process. Manual is faster while iterating; sidecar is worth doing once the API is stable and you want a genuine one-click demo. *(Phase 10, optional)*
- **Case Library persistence** — local SQLite (via `tauri-plugin-sql`) for saved cases and scan history vs. keeping it session-only in Zustand. SQLite is the better long-term answer if the demo should survive an app restart. *(Phase 7)*