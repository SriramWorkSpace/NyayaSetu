# SECURITY.md

> **This file serves two purposes.** Sections 1–3 are the conventional security policy: threat model, hardening rules, and how to report a vulnerability. Sections 4–5 are the project's **testing rulebook and its running outcome log**, appended at the end of every phase (see decisions.md D-009).

---

## 1. Security posture

NyayaSetu is a **local-first desktop application**. It has no server, no accounts, no multi-tenancy, and no network surface beyond `localhost`. That eliminates most of the usual web threat model and concentrates risk in three places instead:

| Risk | Why it matters here |
|---|---|
| **Sensitive document handling** | Users scan real legal documents and paste real case narratives. This content is confidential and must never leak into logs, telemetry, crash reports, or the repo. |
| **A locally-bound HTTP server** | The FastAPI backend runs unauthenticated. If it ever binds beyond the loopback interface, anything on the local network can query it. |
| **Untrusted model output rendered as UI** | OCR text and judgment text are rendered directly. Treated carelessly, that is an injection vector. |

**Explicitly out of scope:** authentication, authorization, rate limiting, and transport encryption. There is no remote attacker in this model because there is no remote surface — deliberately, per ARCHITECTURE.md §1's non-goals. If the project is ever hosted, this entire document needs rewriting first.

---

## 2. Hardening rules

These are binding on all code. Violations are bugs, not style preferences.

### Network
- The backend binds to **`127.0.0.1` only**. Never `0.0.0.0`, never a LAN address — that would expose an unauthenticated model server to the network.
- **No outbound calls the user did not initiate.** No telemetry, no analytics, no crash reporting, no update pings. The app must work fully offline once models are downloaded.
- CORS is restricted to the Vite dev origins. It exists for browser-only development convenience; the shipped app routes through `@tauri-apps/plugin-http` and does not rely on it.

### Secrets
- **No secrets in the repo** — not committed, not hardcoded, not in fixtures or test data. `.env` is gitignored; `.env.example` documents key *names* with empty values.
- The two cosmetic API touchpoints (decisions.md D-008) read their key from the environment at runtime. If the key is absent the feature degrades silently — it never blocks a prediction, because it never touches one.

### Sensitive data
- **Never log judgment bodies, OCR output, or user-entered narratives.** Log shapes, counts, and durations — `"scan: 1 image, 2.3s, ocr_conf=0.81"`, never the extracted text.
- **Uploaded images stay in memory or a temp path that is deleted after processing.** Nothing scanned is persisted without an explicit user save action.
- Case Library persistence (when added) writes to the OS app-data directory, never inside the repo.
- Error responses never echo user content back verbatim.

### Input validation
- **Every request is validated at the boundary with Pydantic v2.** No bare dicts cross a route handler.
- File uploads are capped on **size and MIME type** before any processing.
- Any path or filename input is checked for traversal. Never interpolate user input into a filesystem path.
- `top_k`, `max_sentences`, and every other numeric parameter has an enforced upper bound — an unbounded value is a local denial-of-service against a model that takes seconds per call.

### Rendering
- **No `dangerouslySetInnerHTML` on anything model-derived, OCR-derived, or user-supplied.** Span highlighting is done with React elements over plain text, never by injecting markup.
- External links from retrieved case metadata get `rel="noopener noreferrer"`.

### Dependencies
- Lockfiles (`package-lock.json`, pinned `requirements.txt`) are committed.
- Model weights load from pinned Hugging Face revisions, not floating `main`.
- `backend/artifacts/` is git-lfs; never commit a multi-gigabyte blob to git proper.

---

## 3. Reporting a vulnerability

This is an academic project, not a production service. If you find a security issue, **open a GitHub issue** at [github.com/SriramWorkSpace/NyayaSetu/issues](https://github.com/SriramWorkSpace/NyayaSetu/issues) — or, if the issue involves sensitive data exposure, contact the maintainer directly rather than filing publicly.

Please include what you did, what happened, and what you expected. There is no bounty and no formal SLA.

### Not a vulnerability
- "The API has no authentication" — by design; it is loopback-only and single-user.
- "Predictions can be wrong" — that is a model quality issue. See the Model Insights screen for measured accuracy, and note the disclaimer: **this tool does not provide legal advice.**

---

## 4. Testing rulebook

What must be true before a phase is marked done. Thresholds are commitments, not aspirations — a missed threshold is reported in §5, not quietly relaxed.

### 4.1 ML modules

| Rule | Detail |
|---|---|
| **Baseline and final, same metric** | Every module reports both. A final model that fails to beat its baseline is **reported honestly**, not hidden, retuned until flattering, or dropped. |
| **Held-out test split** | Metrics come from data never seen during training or hyperparameter tuning. **Leakage is the failure mode to guard hardest** — judgments are long and near-duplicates are common, so dedupe before splitting, not after. |
| **Bail: calibration required** | A reliability curve, plus the plain-language claim it supports ("at 70% confidence, correct ~70% of the time"). An uncalibrated probability displayed as a percentage is a lie to the user. |
| **Bail: fairness audit** | Disparity measured **before and after** controlling for legitimate legal factors (crime severity, prior record). Both numbers reported — the gap that survives controls is the finding. |
| **OCR error ≠ extraction error** | Always measured and reported **separately**. A field lost to a garbled scan is a different failure from a field the NER model mislabeled on clean text. Both the `/metrics` payload and the scan UI keep the distinction visible. |
| **Model card per module** | `ml/reports/MODEL_CARD.md` — data, training procedure, evaluation, and **limitations**, including dataset license constraints (decisions.md D-006). |

**Metric per module:** bail → F1, PR-AUC, calibration · QA → Exact Match, F1 · summarization → ROUGE-1/2/L · retrieval → Precision@k, Recall@k, MRR · NER → per-entity F1 + OCR CER, separately.

### 4.2 Backend

- Every ARCHITECTURE.md §6 endpoint has a contract test asserting the `{ ok, data, error, latency_ms }` envelope and its status codes.
- **Singleton loading verified to fire exactly once per process** — assert on the load-timestamp log, not by eyeballing startup speed.
- Malformed payloads return a structured 422, never a stack trace.
- `/metrics` is side-effect free and safe to poll.

### 4.3 Frontend

- Every `components/ui/` primitive renders in the `/sandbox` route **in both themes**.
- Every screen exercises **empty, loading, and error** states. Loading is a skeleton, never a bare spinner.
- **No hardcoded metrics.** Every number on screen came from the API at runtime. The acceptance test for this: retrain a model, restart the backend, and confirm the UI changes with zero frontend edits.
- Every model output shows a confidence indicator and the not-legal-advice disclaimer.

### 4.4 Manual pass — required before any phase is marked done

1. Resize the window **1024px ↔ 1600px** — no overflow, no clipping.
2. Toggle **light/dark on every screen** — contrast ≥ 4.5:1 in both.
3. Run with **`prefers-reduced-motion`** enabled — no animation escapes the gate.
4. **Kill the backend and use the app** — every screen degrades to a useful error, never a blank page or a spinner that never resolves.

---

## 5. Test outcome log

Appended at the end of every phase. Honest entries only — a phase that shipped with a known failure records it here rather than omitting the row.

| Phase | Date | What was tested | Outcome | Notes |
|---|---|---|---|---|
| 0 — Foundation & documents | 2026-08-28 | Document completeness; ARCHITECTURE.md §3–§4 rewrite consistency; cross-document agreement; git init + first push | **pass** | All 12 ARCHITECTURE.md sections intact after the splice; §6/§7/§11 byte-identical. Six stale references (Urbanist, JetBrains Mono, `gradients/`, `tailwind.config.ts` ×2, gradient open-decision) found and corrected. Pushed to `main`, authored as Sriram Madala, no AI attribution. No executable code in this phase. |

| 1 - Design system & components | 2026-08-28 | `tsc -b` strict; production build; token utilities present in built CSS; every primitive rendered on `/sandbox` in both themes; em-dash audit | **pass** | Two real bugs found and fixed: the theme toggle rendered top-left (`.toggle-switch { position: relative }` beat the Tailwind `fixed` utility by source order), and the collapsed nav rail clipped its 32px icons at 72px. Verified by screenshot, not assumed. |
| 2 - Shell, startup, navigation | 2026-08-28 | Rail expand pushes content at 1024px and 1440px; routing across all six destinations; startup type-on and hand-off | **partial** | Screens are designed empty states, not live data. `lib/api.ts` and the page-transition audit under `prefers-reduced-motion` are outstanding and close with Phase 3. |

| 1-2 verification | 2026-08-28 | Real-browser Playwright suite (`app/tests/verify.mjs`): console errors on all 8 routes x 2 themes, theme toggle flip + persistence + position, nav rail collapsed width + hover-push, all 6 destination titles, startup hand-off routing, resize 1024/1600 overflow, reduced-motion typewriter | **pass, 33/33** | Two failures on first run, both real: the rail's collapsed width measured 60px against the 64px spec (CLAUDE.md 5.3) and was corrected in `tokens.css`; the toggle-position check itself was wrong (measured the intentionally-hidden checkbox, not the visible switch). |

| 3 - Contract stub backend | 2026-08-28 | Every section 6 route curl-verified incl. deliberate error/low-confidence/empty triggers; envelope shape holds on every error path (422/404/415/503); loopback-only bind confirmed via `netstat`; end-to-end Playwright check (Home to live `/health` over the typed client); backend killed mid-session and recovered, error state matched CLAUDE.md 11's message rule | **pass, 35/35** | `python-multipart` was missing for the scan upload route, caught at server startup and added to `requirements.txt`. No fixture required an unplanned schema change. |

| 4 - Screens | 2026-08-28 | Full Playwright flow suite (`tests/verify-phase4.mjs`): Predict form -> live result panel with SHAP bars, calibration note and baseline toggle; form validation; Scan via file upload incl. the low-quality OCR trigger; explicit (non-automatic) summarize step; Search -> Case Detail with real judgment text; Ask -> QA span highlighted and scrolled into place; save/unsave a case; Home's activity list reflecting a just-made prediction. Original 35-check suite re-run for regressions | **pass, 47/47 (35+12)** | Bar chart labels were truncating illegibly at the sheet's 520px width ("Custody duration exceeds 9...") - fixed to wrap instead of ellipsis. `/case/{case_id}` added as a documented, additive gap in section 6 (D-013); QA's hardcoded answer-paragraph indices were wrong by 3 on first wiring (header blocks shift paragraph count) - caught immediately by curl, not by the test suite, and computed programmatically instead of re-guessed. |

| 5 - Tauri shell | 2026-08-28 | `cargo check` and `tauri dev` full build on the real MSVC toolchain; window geometry (1280x832, min 1024x720) and identifier set; HTTP capability scoped to `http://127.0.0.1:8000/*` only; **the actual gate** - `/health` round trip confirmed rendering inside the real native window via `PrintWindow` capture (not a browser context, not assumed) - showing live `BACKEND ok / MODULES 5/5 / UPTIME 7838s` fetched through the Rust-mediated `tauri-plugin-http` call | **pass** | MSVC linker was missing entirely (Git's `link.exe` on PATH was a false positive) - installed VS Build Tools' C++ workload. Desktop screenshot capture (`CopyFromScreen`) was unreliable: `SetForegroundWindow` is silently refused for a background automation process, so the window visually stayed beneath VS Code despite the API reporting success - switched to `PrintWindow(PW_RENDERFULLCONTENT)` plus a `HWND_TOPMOST` z-order force, which reads the window's own surface directly. |

| 6 - Data & bail baselines | 2026-08-28 | Fetched real dataset (1,200 records), hand-audited a sample plus full-corpus profiling; exact-duplicate-facts dedup before splitting; held-out stratified test split never touched during fitting; `bail.json` validated against the real Pydantic `ModuleMetrics` schema, not just structurally resembled | **pass** | Real numbers: baseline (LogReg) F1 0.7709, final (XGBoost) F1 0.8117 - final genuinely beats baseline, not tuned to. A 32% hindsight-framing risk in the `facts` field was found and disclosed via an ablation model rather than papered over with an untested regex fix (D-015). Dataset's real schema has no `custody_days` field at all, contradicting the frozen Phase 3 API contract - logged as an open item for Phase 9 (D-014), not silently patched. |

<!-- Append one row per phase. Do not edit past rows — if an earlier result is later invalidated, add a new row saying so. -->
