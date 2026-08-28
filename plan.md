# plan.md — Roadmap

> The living build plan. Phase status is updated as work lands; the outcome of each phase is logged in [SECURITY.md §5](SECURITY.md).
> Scope and contract come from [ARCHITECTURE.md](ARCHITECTURE.md); conventions from [CLAUDE.md](CLAUDE.md); rationale from [decisions.md](decisions.md).

## Progress

| # | Phase | Status |
|---|---|---|
| 0 | Foundation & documents | ✅ complete |
| 1 | Design system & component library | ✅ complete |
| 2 | Shell, startup page, navigation | ✅ complete |
| 3 | Contract stub backend | ✅ complete |
| 4 | Screens | ✅ complete |
| 5 | Tauri shell | ✅ complete |
| 6 | Data & bail baselines | ✅ complete |
| 7 | Core models | ⬜ not started |
| 8 | Fairness audit | ⬜ not started |
| 9 | Real backend | ⬜ not started |
| 10 | Model Insights & quality floor | ⬜ not started |
| 11 | Package *(optional)* | ⬜ not started |

## Build order, and why it differs from ARCHITECTURE.md §9

§9 says backend and models first. This plan inverts that — UI first — but neutralises the risk §9 identifies with a structural safeguard rather than a promise: **the §6 API contract is frozen first, then fully implemented as a fixture-backed FastAPI stub (Phase 3).**

The frontend therefore never talks to a mock. It talks to a real HTTP server speaking the final contract from the first screen it renders. Phase 9 replaces the stub's function bodies with real model calls; no route, no schema, and no client code changes. Full reasoning in [decisions.md D-002](decisions.md).

---

## Phase 0 · Foundation & documents

Governing documents and a pushed repo, before any code.

- `CLAUDE.md` · `plan.md` · `decisions.md` · `README.md` · `SECURITY.md`
- Rewrite ARCHITECTURE.md §3–§4 to the typewriter design direction (D-001); correct §8's repo root to `NyayaSetu/`. Everything else preserved verbatim — §6, §7, and §11 remain binding.
- `.gitignore`, `.gitattributes` (git-lfs for `backend/artifacts/**`), `LICENSE`
- `git init -b main` → first commit → push to `github.com/SriramWorkSpace/NyayaSetu`

**Done when:** the repo is on GitHub and the five documents agree with each other.

---

## Phase 1 · Design system & component library

Scaffold `app/` — Vite · React 18 · TypeScript strict · Tailwind v4 · shadcn into `src/components/ui/`.

- **Tokens** in `src/styles/tokens.css` (`@theme inline`) — the paper/ink palette, both themes, spacing, radii. One file, no exceptions (D-003).
- **Fonts** self-hosted: `@fontsource/space-mono`, `@fontsource/special-elite`. Special Elite has a single 400 weight — small-text hierarchy comes from size, tracking, and opacity.
- **Theme toggle** — the supplied switch, fixed top-right on every screen; the transition wipes outward from the switch via the View Transitions API with a `clip-path: circle()` anchored to its live bounding rect.
- **Components:** `PaperPanel` · `FloatingCard` · `StatPill` · `StatCard` · `SegmentedControl` · `ListRow` · `PrimaryButton` · `IconButton` · `Chip` · `BarChart` · `ConfidenceMeter` · `MetricComparisonBar` · `CalibrationCurve` · `SpanHighlighter` · `StampBadge` · `Typewriter` · `EmptyState` · `SkeletonBlock` · `Toast` · `Sheet`
- Plus `components/ui/lets-work-section.tsx`, verbatim as supplied (D-007).

**Done when:** every primitive renders on an isolated `/sandbox` route in both themes, before a single real screen exists.

---

## Phase 2 · Shell, startup page, navigation

- **Startup page** — paper grain, typewriter type-on, then `enter-suite.tsx` handing off into the shell.
- **Floating nav rail** — 64px → 240px on hover, **pushing** content by animating the shell's `grid-template-columns`, never overlapping it.
- **Routing** — six destinations per §4, plus `/sandbox`.
- **Page transitions** — 220ms paper-lift + cross-dissolve; result panels slide from the right. All reduced-motion gated.
- **`lib/api.ts`** — typed to §6 in full, `{ ok, data, error, latency_ms }` envelope, React Query wrapping, `plugin-http` under Tauri and `fetch` in the browser through one code path.

**Done when:** you can walk startup → every screen at 1024px and 1600px, in both themes, smoothly.

---

## Phase 3 · Contract stub backend

`backend/` on a `py -3.11` venv. **Every §6 endpoint implemented against JSON fixtures** — realistic shapes, artificial latency, and deliberate error and low-confidence cases so the §11 empty/loading/error states are built against reality rather than sunshine data.

**Done when:** `curl` returns a correct envelope from every route.

---

## Phase 4 · Screens

Home → Predict → Result panel → Scan → Search → Case Detail → Library, against the stub.

Layout follows the logistics-dashboard reference translated to judiciary: a row of compact stat pills, title and date line, a filter chip row, then a large canvas with floating cards overlaid on the left and a vertical icon control stack on the right. The bail Result panel is the direct analog of that reference's detail card — probability as the oversized numeral, `ConfidenceMeter` as the gauge, SHAP factors as horizontal bars, a `StampBadge` verdict, the live baseline toggle (§4.3), and the persistent disclaimer chip.

Insights is deliberately deferred to Phase 10 — it depends on every module's real metrics existing.

**Done when:** every screen renders live stub data and no component contains a hardcoded value. Screenshots go into the README.

---

## Phase 5 · Tauri shell

`tauri init` against the Vite app, `@tauri-apps/plugin-http` wired, window 1280×832 / min 1024×720.

**Gate:** a `/health` round trip must render in the real native window — not just the browser dev server — before anything else proceeds. The webview and the browser can differ, and this catches it early.

---

## Phase 6 · Data & bail baselines

Fetch the three sources into gitignored `ml/data/` (see the README licensing table). Hand-audit annotation quality on a sample. Dedupe **before** splitting — judgments are long and near-duplicates are the leakage risk.

Build LogReg → XGBoost bail baselines end to end, write `ml/reports/bail.json` and the model card.

**Done when:** a real baseline number exists that a later model has to beat.

---

## Phase 7 · Core models

Bail transformer (fused structured + text) · QA span head on the 56-doc gold split · summarizer (TextRank → supervised classifier) · FAISS index over IL-TUR chunks, with the size cap stated in its model card · NER from weak regex supervision, benchmarking spaCy against InLegalBERT token classification before committing (§12).

**Rule:** every module writes its metrics JSON and model card **before** the next one starts.

---

## Phase 8 · Fairness audit

Its own phase, per §9 — not folded into Phase 7. Disparity testing with legal-factor controls; before/after gaps written into `bail.json` and a standalone report. **The gap that survives the controls is the finding.**

---

## Phase 9 · Real backend

Replace stub internals with real model calls behind the unchanged contract. Singleton loading verified to fire exactly once per process. Install Tesseract and wire `/scan/extract`, keeping **OCR error and NER error separate** in both the payload and the UI. Verify every endpoint with `curl`, then delete the fixtures.

---

## Phase 10 · Model Insights & quality floor

The Insights screen (§4.7) against real `/metrics` — segmented control across the five modules, baseline→final bars, mono metric tables, calibration curve and fairness gaps for bail, live dataset size and last-trained timestamp.

Then the full §11 sweep: empty/loading/error on every screen, reduced-motion audit, contrast in both themes, 1024↔1600 resize, cold launch under 2s.

**The acceptance test for the whole project:** retrain one model, restart the backend, and watch the Insights screen change with zero frontend edits.

---

## Phase 11 · Package *(optional)*

`tauri build` for an installer. PyInstaller sidecar only if a genuine one-click demo is wanted — two terminals is fine for iterating (§12).

---

## Per-phase ritual

1. Manual pass — both themes, 1024 ↔ 1600, reduced motion, backend killed
2. Append the outcome row to [SECURITY.md §5](SECURITY.md)
3. Log any non-obvious choice in [decisions.md](decisions.md)
4. Refresh the knowledge graph
5. Update the progress table above
6. Commit + push to `main`
