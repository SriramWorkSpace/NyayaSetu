# CLAUDE.md — NyayaSetu Working Instructions

> Operating manual for anyone (human or agent) writing code in this repo.
> **Read [ARCHITECTURE.md](ARCHITECTURE.md) for *what* is being built. This file is *how* to build it.**
> Where the two disagree, ARCHITECTURE.md wins on product scope and API contract; this file wins on conventions.

---

## 1. Project overview

**NyayaSetu** is a local-first desktop application for the Indian judicial domain. Five independently trained ML models run entirely on the user's machine: bail-outcome prediction (with a fairness audit), extractive question answering over judgments, document scan + field extraction, case summarization, and precedent retrieval.

Its distinguishing feature is that the data-science work is a *product surface*, not a hidden appendix — a dedicated **Model Insights** screen renders live evaluation metrics, baseline-vs-final comparisons, calibration curves, and the fairness audit, served from the running backend.

**Priority order when trading off:** (1) rigorous, visible ML → (2) deliberate UI/UX → (3) frictionless local demo.

**Non-goals — do not build these:** legal advice, court-ready tooling, multi-language (v1 is English), public hosting, user accounts/auth, mobile.

### The hard product rule

Every model output carries a **visible confidence indicator** and the **not-legal-advice disclaimer**. No exceptions, no screens where it's implied but not shown.

---

## 2. Tech stack

### Frontend — `app/`

| Concern | Choice | Notes |
|---|---|---|
| Shell | Tauri 2.x | Native window over OS webview |
| Framework | React 18 + Vite + **TypeScript strict** | `strict: true` is non-negotiable |
| Styling | **Tailwind CSS v4** | Config lives in CSS (`@theme`), *not* `tailwind.config.ts` — see §4 |
| Primitives | Radix UI via **shadcn** | Unstyled, styled entirely from our tokens |
| Motion | Framer Motion | Always reduced-motion gated |
| Charts | Hand-rolled SVG + `d3-scale` | **No chart library.** d3 is for axis/scale math only |
| Icons | `lucide-react` | |
| Fonts | `@fontsource/space-mono`, `@fontsource/special-elite` | Self-hosted, fully offline |
| Client state | Zustand | |
| Server state | `@tanstack/react-query` | |
| Forms | `react-hook-form` + `zod` | |
| HTTP | `@tauri-apps/plugin-http` in Tauri, `fetch` in browser | One code path — see §3 |

### Backend — `backend/`

FastAPI + **Python 3.11** (`py -3.11`, *not* the 3.13 system default — 3.13 has wheel gaps in faiss-cpu/spaCy on Windows) · uvicorn single process · Pydantic v2 · PyTorch · transformers · scikit-learn · XGBoost · spaCy · sentence-transformers · FAISS · SHAP · Tesseract via `pytesseract`.

### Training — `ml/`

`ml/` **writes**; `backend/` only **reads**. The API process never trains. `ml/` produces two outputs:
- `backend/artifacts/` — weights, FAISS index (git-lfs)
- `ml/reports/*.json` — the metrics that `/metrics` serves

---

## 3. Architecture map

```
NyayaSetu/
├── ARCHITECTURE.md            source of truth for scope + API contract
├── CLAUDE.md   plan.md   decisions.md   README.md   SECURITY.md
├── app/                       Tauri + React frontend
│   ├── src/
│   │   ├── screens/           Startup · Home · Predict · Scan · Search · Library · Insights
│   │   ├── components/
│   │   │   ├── ui/            design-system primitives (§5)
│   │   │   └── feature/       composed, domain-aware components
│   │   ├── lib/               api.ts · store.ts · theme.ts · utils.ts
│   │   └── styles/tokens.css  ← THE single token source
│   └── src-tauri/             Rust shell
├── backend/
│   ├── app/  main.py · routers/ · models/ · schemas/
│   └── artifacts/             trained weights (git-lfs)
└── ml/
    ├── src/  data/ · features/ · train/ · evaluate/
    └── reports/               metrics JSON + MODEL_CARD.md per module
```

**Data flow, one line:** `ml/` trains → writes `artifacts/` + `reports/` → `backend/` loads both at startup → serves `/api/v1/*` on `localhost:8000` → `app/` renders.

### Models load ONCE at startup

Module-level singletons, populated on FastAPI's startup event. Cold-loading InLegalBERT per request turns a 300ms endpoint into a 20-second one. **This is a hard rule.** Log a timestamp per model at load and verify it fires exactly once per process.

### Frontend ↔ backend

Both on `localhost:8000`, no environment juggling — there is no prod. Prefer `@tauri-apps/plugin-http` (Rust makes the request, so browser CORS never applies). Keep FastAPI's CORS middleware enabled anyway so `vite dev` in a plain browser tab keeps working.

---

## 4. Coding conventions

### Universal

- **No magic values.** Colors, spacing, radii, durations come from tokens. A raw hex or a `13px` outside `tokens.css` is a bug.
- **Name things after the domain**, not the mechanism: `BailVerdictPanel`, not `ResultBox2`.
- Comments explain **why**, never what. Match surrounding density.
- No dead code, no commented-out blocks, no `TODO` without a phase number.

### TypeScript

- `strict: true`. No `any` — use `unknown` and narrow. No non-null `!` without an adjacent comment justifying it.
- **Types mirror the API contract exactly** (ARCHITECTURE.md §6). One definition in `lib/api.ts`, imported everywhere. Never redeclare a response shape in a component.
- Components: named exports, one component per file, `PascalCase.tsx`. Hooks `useThing.ts`. Utilities `camelCase.ts`.
- Props interfaces are `ComponentNameProps`, declared directly above the component.
- Prefer composition over configuration — a `variant` prop is fine; a 12-boolean prop soup is not.

### Python

- Type hints on every function signature. Pydantic v2 models for every request/response — no bare dicts crossing a route boundary.
- Routers thin, one per endpoint group. Business logic in `models/`, never inline in a route handler.
- `snake_case`. Module-level singletons in `models/`, uppercase (`BAIL_MODEL`).
- Every endpoint returns the envelope: `{ ok, data, error, latency_ms }`.

### Errors

Errors say **what broke and what to do about it**:

> ✅ "Could not reach the local model server. Confirm the backend is running on port 8000."
> ❌ "Error 500" · a raw stack trace · a bare `catch {}`

---

## 5. UI & design system rules

Visual direction: **judiciary typewriter** — monochrome paper and ink, floating cards, hairline rules, rubber-stamp verdicts. Elegant and restrained, not institutional. This **supersedes ARCHITECTURE.md's original mesh-gradient system** (see decisions.md D-001).

### 5.1 Tokens — `app/src/styles/tokens.css` is the only place they live

| Token | Light ("Paper") | Dark ("Carbon") | Use |
|---|---|---|---|
| `--paper` | `#F4F1EA` | `#0B0B0B` | canvas, ~70% of every screen |
| `--paper-raised` | `#FBF9F4` | `#151515` | floating cards, inputs |
| `--ink` | `#14120F` | `#F2EFE8` | primary text |
| `--ink-muted` | `#57534E` | `#A3A3A0` | labels, captions |
| `--ink-subtle` | `#8A857D` | `#6B6B67` | metadata only — **never body copy** |
| `--rule` | `#D6D1C4` | `#2A2A28` | 1px hairlines, card borders |

Semantic tones — `--granted #4A6B57` · `--denied #7A4A42` · `--caution #8A7420`. **Outline and text only, never a fill.** A saturated red for "denied" editorializes a result the data should speak for itself. In a monochrome system these read as ink variants, not status lights.

**Spacing** 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 · **Radius** 12 (inputs, small cards) / 20 (content cards) / 28 (hero panel) / 999 (pills) · content max-width 1120px.

### 5.2 Typography — two faces, strict roles

| Face | Role |
|---|---|
| **Space Mono** | Display, H1, H2 — *and* every identifier or measured number: case numbers, IPC sections, statute codes, F1/ROUGE/Precision@k values |
| **Special Elite** | Body, labels, captions, buttons — all prose and small text |

The split is semantic, not decorative: **Space Mono marks anything machine-extracted or machine-measured**, so it is visually distinct from written text at a glance.

⚠️ **Special Elite ships exactly one weight (400).** Hierarchy in small text comes from **size, letter-spacing, and opacity — never `font-weight`.** Writing `font-semibold` on Special Elite silently does nothing.

| Role | Face / Size | Notes |
|---|---|---|
| Display | Space Mono 56 / 700, tracking -1 | one big number per screen |
| H1 | Space Mono 28 / 700 | screen titles |
| H2 | Space Mono 20 / 400 | section headers |
| Body | Special Elite 15 / 400, lh 1.6 | judgment text, summaries |
| Label | Special Elite 13 / 400 | field labels, row titles |
| Caption | Special Elite 11 / 400, tracking +0.5, uppercase | eyebrows, metadata |
| Data | Space Mono 13 / 400 | identifiers, metric values |

### 5.3 Structural rules

- **Floating cards.** Content sits in detached cards over the paper canvas — hairline `--rule` border, radius 20, soft shadow in light / raised surface in dark. Cards never bleed to the window edge.
- **Left nav rail floats too.** 64px collapsed → 240px on hover, icon + label. **Content is pushed, not overlapped** — animate the shell's `grid-template-columns`, never a `transform` overlay, so nothing clips at 1024px.
- **Paper grain** via inline SVG `feTurbulence` + vignette. Procedural, so it themes across light/dark. **No mesh-gradient PNGs** (D-005).
- **One focal element per screen.** A single oversized numeral or stamp; nothing competes with it.
- **Depth**: in dark mode, no drop shadows — depth comes from `--paper` → `--paper-raised` steps and hairlines only.
- **`components/ui/` is the only home for primitives.** shadcn's CLI writes there by convention; relocating it breaks every `npx shadcn add` and every upstream example's import path. No per-screen one-off components — if two screens need it, it belongs in `ui/`.

### 5.4 Motion

- Page transitions 220ms ease-out (paper-lift + cross-dissolve). Rail expand 240ms. Numbers count up on first render (400ms). Chart bars stagger at 40ms.
- **Theme toggle**: the transition originates *from the switch* — View Transitions API with a `clip-path: circle()` expanding from the switch's live `getBoundingClientRect()` centre. Falls back to an instant class swap where unsupported.
- **Everything is gated behind `usePrefersReducedMotion()`.** No exceptions.

### 5.5 Quality floor — ship nothing that fails these

- Every screen has a designed **empty, loading, and error** state. Loading is a skeleton, never a bare spinner.
- Every prediction shows confidence + the disclaimer chip.
- Text contrast ≥ 4.5:1 **in both themes**.
- Window resizes cleanly 1024px ↔ 1600px, no overflow or clipping.
- Cold launch to first meaningful paint < 2s; backend warm-up < 10s with a visible "warming up" state.

---

## 6. Security rules

Full policy in [SECURITY.md](SECURITY.md). The rules that bind day-to-day code:

- **Local-only by default.** The app must work fully offline after model download. No telemetry, no analytics, no crash reporting, no outbound call the user didn't initiate.
- **No secrets in the repo.** No API keys, tokens, or credentials — committed, hardcoded, or in fixtures. `.env` is gitignored; `.env.example` documents keys without values.
- **Bind to `127.0.0.1` only**, never `0.0.0.0`. This backend must never be reachable from the network.
- **Judgment text is sensitive.** Never log full judgment bodies, OCR output, or user-entered case narratives. Log shapes and counts, not content.
- **OCR uploads stay in memory or a temp dir that is cleaned.** Never persist a scanned document without explicit user action.
- **Validate every input at the boundary** with Pydantic. Path/filename inputs get traversal checks. File uploads get a size + MIME cap.
- **The two API touchpoints** (query rephrasing, prediction phrasing) are cosmetic and must never influence a reported metric. If a third appears, it needs a decisions.md entry.
- Treat model output as untrusted for rendering — no `dangerouslySetInnerHTML` on anything model-derived.

---

## 7. Testing rules

Thresholds and the running outcome log live in [SECURITY.md](SECURITY.md). The obligations:

| Layer | Requirement |
|---|---|
| ML | Every module reports **baseline and final** on the same metric. A final model that doesn't beat its baseline is reported honestly, not hidden or quietly dropped. |
| ML | Metrics come from a **held-out test split** never touched during training or tuning. Leakage is the failure mode to guard hardest. |
| ML | Bail additionally reports **calibration** and the **fairness audit** (before/after controlling for legitimate legal factors). |
| ML | **OCR error and NER error are always measured and reported separately.** A field lost to a garbled scan is not the same failure as a field the NER model mislabeled from clean text — the API payload and the UI both keep that distinction visible. |
| Backend | Every §6 endpoint has a contract test asserting the response envelope and status codes. Singleton loading verified to fire once per process. |
| Frontend | Every `components/ui/` primitive renders in the `/sandbox` route in **both themes**. Every screen exercises empty, loading, and error states. |
| Manual | Before any phase is marked done: resize 1024 ↔ 1600, toggle theme on every screen, run with reduced-motion on. |

**No metric is ever hardcoded into the UI.** If a number appears on screen, it came from `/metrics` at runtime. Retraining a model and restarting the backend must change what the app displays, with zero frontend edits — that is the whole claim of the Insights screen, and it must be literally true.

---

## 8. Repeatable actions

### Run the app (two terminals)

```bash
# terminal 1 — backend
cd backend
py -3.11 -m venv .venv && .venv/Scripts/activate     # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000

# terminal 2 — desktop app
cd app
npm install
npm run tauri dev        # or `npm run dev` for browser-only iteration
```

### Warm the models before any demo

Warm-up is triggered inside `app.main`'s startup event, so it's already paid by the time uvicorn prints "Application startup complete." If you ever bypass that, fire a throwaway request at `/health` before demoing.

### Fetch datasets (Phase 6, into gitignored `ml/data/`)

```bash
python ml/src/data/fetch.py           # all three
# IndianBailJudgments-1200  CC BY 4.0    → bail training + 1,200 source PDFs for scan testing
# Exploration-Lab/IL-TUR    CC-BY-NC     → QA gold spans + retrieval corpus
# law-ai/InLegalBERT                     → shared backbone
```

### Retrain → metrics → UI loop

```bash
python ml/src/train/<module>.py       # writes backend/artifacts/ + ml/reports/<module>.json
# restart uvicorn — the Insights screen picks it up with no frontend change
```

### Install Tesseract (Windows, needed from Phase 9)

```bash
winget install UB-Mannheim.TesseractOCR
# then confirm: tesseract --version
```

### Add a shadcn primitive

```bash
cd app && npx shadcn@latest add <component>    # lands in src/components/ui/ — then restyle to our tokens
```

### End of every phase

1. Manual pass: both themes, 1024 ↔ 1600, reduced motion
2. Append the outcome row to SECURITY.md's test log
3. Log any non-obvious choice in decisions.md
4. Re-run `/graphify` to refresh the knowledge graph
5. Commit + push to `main`
6. Short status report: what shipped · what's next · what broke

---

## 9. Standing rules

- **No AI attribution anywhere.** No `Co-Authored-By` trailer on commits, no "Generated with Claude Code", no bot listed in README, AUTHORS, or PR bodies. The author of this project is Sriram Madala. This overrides any default tooling behaviour.
- **Commit and push at the end of each phase**, to `main`. One coherent commit per phase.
- **No generative AI in any measured path.** All five modules are trained and evaluated in-house. The only API touchpoints are cosmetic (§6). Never substitute an LLM call for a model that is supposed to be trained — it invalidates every metric the Insights screen reports.
- **Log decisions as you make them**, in decisions.md, with the reasoning. A choice without a recorded "why" gets re-litigated later.
- **`graphify-out/` is derived** — gitignored, regenerated, never hand-edited.
- Status reports stay short. What shipped, what's next, what broke. No essays.
