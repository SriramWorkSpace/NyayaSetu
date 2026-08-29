# decisions.md — Decision Log

> Why things are the way they are. Every non-obvious choice gets an entry, written when the choice is made — not reconstructed later.
>
> **Format:** ID · Title · Date · Status · Context → Decision → Consequences.
> **Status:** `accepted` · `superseded by D-xxx` · `revisit at Phase N`

---

## D-001 · Typewriter monochrome supersedes the mesh-gradient design system
**2026-08-28 · accepted**

**Context.** ARCHITECTURE.md §3 specified a near-black canvas with pre-rendered iridescent mesh-gradient panels, Urbanist as the primary face, and a `#6578C8` periwinkle accent. The stated design direction is the opposite: monochrome black/white, typewriter-styled, judiciary/court/law themed, Special Elite + Space Mono, floating cards, a hover-expand left rail.

These are not reconcilable as a blend — an iridescent gradient panel and a paper-and-ink typewriter surface fight each other for the same focal role on every screen.

**Decision.** Rewrite ARCHITECTURE.md §3 (design system) and §4 (screen architecture) to the typewriter direction rather than leaving a contradiction between two documents. ARCHITECTURE.md remains the single source of truth for scope and contract; CLAUDE.md §5 carries the working rules.

Everything else in ARCHITECTURE.md is preserved verbatim — the API contract (§6), the ML module table (§7), and the quality floor (§11) are design-independent and remain binding.

**Consequences.** The original design system is gone from the repo, recoverable only through git history and this entry. §3.2's four pre-rendered gradient assets are obsolete (see D-005). The muted-not-stoplight *rationale* from §3.1 survives the rewrite and now governs the semantic ink tones.

---

## D-002 · UI-first build order, inverting ARCHITECTURE.md §9
**2026-08-28 · accepted**

**Context.** §9 states "Backend and models first, always. A polished app calling nothing is not a demo." That reasoning is sound and the risk it guards against is real: UI-first projects routinely produce a beautiful shell wrapped around models that were never finished, with an integration seam that has to be rebuilt when real data finally arrives.

But the design system here is a substantial deliverable in its own right, and deferring it behind four ML phases means the visual language gets rushed at the end — the exact failure §9 is trying to prevent, displaced onto the other half of the project.

**Decision.** Invert the order, but neutralise the risk §9 identifies with a structural safeguard: **freeze the §6 API contract first, then implement all of it as a fixture-backed FastAPI stub (Phase 3).**

The frontend therefore never talks to a mock. It talks to a real HTTP server speaking the final contract from the first screen. Phase 9 replaces the stub's function bodies with real model calls; no route, no schema, and no client code changes.

**Consequences.** The §6 contract must be right early — changing it after Phase 4 is expensive, which is the intended pressure. Fixtures must include deliberate error and low-confidence cases, or the §11 empty/loading/error states get built against sunshine data and fail on contact with reality. The fixtures are deleted at Phase 9, not left to rot.

**Rejected alternative:** thin vertical slices (one module end-to-end at a time). Honest, but it means building the design system five times in fragments, and the shared component inventory would never settle.

---

## D-003 · Tailwind v4 tokens live in CSS, not `tailwind.config.ts`
**2026-08-28 · accepted**

**Context.** ARCHITECTURE.md §8 places the design tokens in `app/tailwind.config.ts`, described as the "single source." That reflects Tailwind v3's JavaScript config model. Tailwind v4 moved configuration into CSS via `@theme`, and a `tailwind.config.ts` is no longer the canonical location.

**Decision.** Tokens live in `app/src/styles/tokens.css` using `@theme inline`. The *principle* §8 was protecting — exactly one file defines every color, space, and radius — is preserved; only the file type changes.

**Consequences.** §8's repo-layout listing is stale on this one line. Anyone looking for tokens follows CLAUDE.md §5.1, which names the real path. Dual-theme token overrides (light/dark) are plain CSS custom-property redefinitions, which is simpler than it would have been in the JS config.

---

## D-004 · Python 3.11 for the backend, not the 3.13 system default
**2026-08-28 · accepted**

**Context.** The machine's default `python` is 3.13.7; 3.11 is also installed. ARCHITECTURE.md §5.2 specifies 3.11. On Windows, `faiss-cpu` and `spaCy` have historically lagged on the newest CPython minor, and a mid-project wheel failure during Phase 7 would be an expensive, unforced surprise.

**Decision.** Build the backend venv explicitly with `py -3.11`. Never invoke bare `python` for backend or ML work.

**Consequences.** Every documented command uses `py -3.11` explicitly. If a dependency later requires 3.12+, this gets revisited — but the cost of being wrong in this direction is small, and the cost in the other direction is a blocked phase.

---

## D-005 · Procedural SVG paper grain replaces the four pre-rendered gradient assets
**2026-08-28 · accepted**

**Context.** §3.2 called for four pre-rendered mesh-gradient images (~80KB each) as the signature element, explicitly warning that CSS gradients read flat for that look. With D-001, the signature element is no longer a gradient at all — it is paper texture under typed ink.

A static image also cannot follow a light/dark toggle, and this app now has one on every screen.

**Decision.** The hero panel is procedural: inline SVG `feTurbulence` grain plus a vignette, with ruled "platen" baselines. `PaperPanel` replaces `GradientPanel` in the component inventory.

**Consequences.** No binary assets to generate, version, or keep in sync — §12's open decision on Figma-vs-Python gradient generation is closed by removal. The texture inherits `currentColor`, so it themes for free. The four named variants (`aurora`/`verdict`/`scan`/`insights`) become grain-density and rule-spacing parameters on one component instead of four files.

---

## D-006 · IL-TUR is CC-BY-NC — the project cannot be monetized
**2026-08-28 · accepted**

**Context.** The corpus plan draws on three sources with different licenses:

| Source | License | Used for |
|---|---|---|
| `SnehaDeshmukh/IndianBailJudgments-1200` | CC BY 4.0 | Bail prediction + fairness; its 1,200 source PDFs double as real scan-module test inputs |
| `Exploration-Lab/IL-TUR` (ILDC/CJPE) | **CC-BY-NC** | QA gold spans (56-doc expert split) **and** the precedent-retrieval corpus |
| `law-ai/InLegalBERT` | model weights | Shared backbone for bail, QA, NER, embeddings |

**Decision.** Accept the NC restriction. IL-TUR is reused as the retrieval corpus rather than standing up a second one — it is already clean, chunk-ready, and 35K real Supreme Court judgments is ample for a local FAISS index. The restriction is recorded in the README licensing table and in the QA and retrieval model cards.

**Consequences.** **This project must never be commercialized while IL-TUR is in it.** If that ever changes, QA and retrieval both need a new corpus. Indian Kanoon scraping was rejected as a first-pass source — it needs a ToS review and heavy rate-limiting for volume we do not need yet.

**Revisit** only if commercial use is ever contemplated.

---

## D-007 · `lets-work-section.tsx` ships verbatim; the product uses an adapted twin
**2026-08-28 · accepted**

**Context.** A `lets-work-section.tsx` component was supplied for integration into `components/ui/`. It is a portfolio contact section, and it hardcodes third-party placeholder details: `cal.com/jatin-yadav05`, `hello@example.com`, and the copy "Have a project in mind?".

Its *interaction* — click → heading lifts away → arrow flies off → a second state resolves in — is genuinely good and suits the startup page. Its *content* has no place in a judiciary application, and shipping someone else's booking link in a product would be a real bug, not a cosmetic one.

**Decision.** Two files. `components/ui/lets-work-section.tsx` holds the component exactly as supplied, unmodified, as a reference implementation. `components/feature/enter-suite.tsx` reimplements the same interaction retuned for NyayaSetu — "Enter the Suite", typewriter framing, handing off into the app shell.

**Consequences.** One duplicated interaction pattern, deliberately. No placeholder contact details reach the product. The reference file stays diffable against its source if it is ever updated upstream.

---

## D-008 · No generative AI in any measured path
**2026-08-28 · accepted**

**Context.** Restating ARCHITECTURE.md §2.3 as a binding engineering rule, because it is the single easiest thing to erode under time pressure. Every one of the five modules could be "made to work" faster with an LLM call.

**Decision.** All five components — bail prediction, extractive QA, summarization, retrieval, NER — are trained and evaluated in-house. Exactly two API touchpoints are permitted, both cosmetic and both outside every measured path: query rephrasing before search, and phrasing a raw prediction into a readable sentence. Neither may influence a reported metric.

**Consequences.** A third touchpoint requires its own decision entry. The boundary is stated in the UI and in the model cards, not just here. QA answers are extractive spans highlighted **in the source judgment**, never generated text in a chat bubble — the UI must be honest about what the model actually does. Substituting an LLM for a model that is supposed to be trained invalidates every number the Insights screen reports; that screen is the project's central claim.

---

## D-009 · SECURITY.md carries the testing rulebook and outcome log
**2026-08-28 · accepted**

**Context.** SECURITY.md conventionally holds a vulnerability-disclosure policy. This project additionally needs one durable place recording what must be tested, at what threshold, and what the result actually was per phase.

**Decision.** SECURITY.md holds both: the standard disclosure policy, plus the testing rulebook and a running per-phase outcome table appended at the end of every phase.

**Consequences.** Slightly unconventional for a reader expecting disclosure-only — the file's own header states its dual purpose up front. The benefit is that testing obligations and their real outcomes sit in one auditable place rather than scattered across commit messages.

---

## D-010 · React 19, Vite 8 and Tailwind 4.3, above the versions named in ARCHITECTURE.md
**2026-08-28 · accepted**

**Context.** ARCHITECTURE.md §5.1 names React 18. `npm create vite` now scaffolds React 19 on Vite 8, and pinning back to 18 would mean fighting the template on every dependency for no stated benefit. Tailwind resolved to 4.3, which is what §5.1 asked for.

**Decision.** Take the current versions: React 19.2, Vite 8.2, Tailwind 4.3, react-router 7, and `motion` 13 (the package formerly published as `framer-motion`; imports come from `motion/react`).

**Consequences.** §5.1's "React 18" line is stale but its intent, a modern React on Vite with strict TypeScript, holds. Nothing in the codebase depends on React 18 semantics. `motion` rather than `framer-motion` is worth knowing when reading §5.1, which names the old package.

---

## D-011 · The theme toggle keeps its own literal colours
**2026-08-28 · accepted**

**Context.** Every colour in the app comes from `tokens.css` (CLAUDE.md 5.1). The supplied toggle stylesheet hardcodes `#d8dbe0` and `#28292c` for the track and knob, which reads as a violation of that rule.

**Decision.** Keep them literal, scoped to `theme-toggle.css`, and say why in the file.

**Consequences.** The switch is a depiction of light and dark, not a surface *in* light or dark. Theming it would make the knob vanish into whichever theme is active, destroying the affordance. This is the single documented exception to the token rule.

**Related:** the positioning class has to sit on a wrapper element, because `.toggle-switch { position: relative }` in that stylesheet wins over a Tailwind `fixed` utility on the same node by source order. That cost one real layout bug before it was caught.

---

## D-012 · Case Library persists via Zustand + localStorage, not SQLite
**2026-08-28 · accepted**

**Context.** ARCHITECTURE.md section 12 left this open, to be settled at Phase 4: `tauri-plugin-sql` for durability across restarts, versus a session-only Zustand store.

**Decision.** Zustand with its `persist` middleware, writing to `localStorage`. This survives an app restart, which was the actual requirement behind the SQLite option, without standing up a database, a migration story, or a Rust-side plugin for a single-user local app with a few dozen records.

**Consequences.** State lives per-browser-profile, not in a queryable database - fine for "did I predict this before," not fine if the project ever needs to query across saved cases at scale. Revisit only if Case Library outgrows a list a user can scroll.

---

## D-013 · `GET /case/{case_id}` added - not in the original section 6 contract
**2026-08-28 · accepted**

**Context.** Case Detail (ARCHITECTURE.md section 4.6) needs full judgment text to render, and `/qa/extract` and `/summarize` both already accept a `case_id` on the assumption the backend can resolve it to a document - section 6 never specifies how a client obtains that text in the first place. Building Search → Case Detail exposed the gap directly: there was no route to fetch what Search's own results pointed at.

**Decision.** Add `GET /api/v1/case/{case_id}` returning title, court, year, case number, IPC sections, full text, and the extractive summary with its sentence provenance. Purely additive - no existing route, schema, or client changes. `qa.py` and `summarize.py` now resolve `case_id` against the same fixture (`app/fixtures/cases.json`) that this endpoint serves, so a search result, its case detail, its QA answers, and its summary are all internally consistent for the same two demo cases.

**Consequences.** ARCHITECTURE.md section 6 is now incomplete as written; the addition is documented here rather than silently expanding the spec. Phase 9 needs a real `case_id -> document` resolution path in the retrieval/storage layer, not just in a fixture file - this is now a stated requirement for that phase, not an assumption.

---

## D-014 · Bail model excludes `custody_days`, `accused_gender`, and post-hoc reasoning fields
**2026-08-28 · accepted**

**Context.** ARCHITECTURE.md's `BailPredictRequest` schema (frozen in Phase 3, before any real data existed) includes `custody_days`. The actual dataset — IndianBailJudgments-1200 — has no such field anywhere; it was never collected. Separately, the raw records include `judgment_reason`, `summary`, and `bail_outcome_label_detailed`, all of which describe the court's own conclusion, and `accused_gender` and `bias_flag`, which are protected-characteristic and fairness-annotation fields respectively.

**Decision.** The trained bail model (`ml/src/train/train_bail.py`) does not use `custody_days` — the field stays in the API contract for forward-compatibility, but Phase 9's real wiring needs to either resolve this (drop the field, or add a data-collection path that populates it) rather than silently ignore the mismatch. `judgment_reason`, `summary`, and `bail_outcome_label_detailed` are excluded from every feature set outright — training on them is not prediction, it's reading the conclusion off a field that states the conclusion. `accused_gender` and `bias_flag` are excluded from training deliberately, not by oversight, so the Phase 8 fairness audit can test whether predictions correlate with gender through legitimate proxies without the model having ever seen gender directly.

**Consequences.** Phase 9 has an open item logged in `ml/reports/bail_audit.md`: decide what happens to `custody_days` before wiring the real model behind `/predict/bail`. The excluded fields are documented in `MODEL_CARD_bail.md` so a future contributor doesn't "helpfully" add gender or the outcome-describing fields back in as an accuracy improvement without understanding why they were left out.

---

## D-015 · Residual hindsight-framing risk in `facts` text, disclosed rather than "fixed"
**2026-08-28 · accepted**

**Context.** 32% of records (384/1,200) have `facts` text where "bail" co-occurs with an outcome word (granted/rejected/cancelled/denied/allowed). Manual review found this is a mix of legitimate prior-proceeding history (real signal - "previously denied bail, the High Court reversed this") and, in some records, language that plainly states *this* judgment's own conclusion inside the fact recitation - a genuine leakage risk beyond the exact-duplicate check CLAUDE.md section 7 names specifically.

**Decision.** No regex-based redaction was attempted. Separating "legitimate prior-proceeding narration" from "this decision's outcome stated early" reliably needs more than pattern matching, and a fragile fix that looks like a fix is worse than an honest number: it would have created false confidence in the reported F1 without reliably removing the risk. Instead, a structured-features-only ablation (XGBoost, no `facts`/`legal_issues` text) is trained and reported in `MODEL_CARD_bail.md` alongside the full-feature numbers: F1 0.7718 (structured-only) vs. 0.8117 (full model). The ~4-point gap is the number to read skeptically - it may be partly real signal, partly the disclosed risk.

**Consequences.** The bail model's F1/PR-AUC on the Insights screen should not be read as a clean, leakage-free number without this context - the model card carries the caveat, and this decision entry is the pointer to it. If a later phase adds proper sentence-level provenance (which paragraph of a judgment a fact came from, filed before vs. after the ruling), this ablation gap is the number that should shrink and can be used to check whether a fix actually worked.

---

## D-016 · Fixed: root `.gitignore` was silently blocking git-lfs artifact tracking
**2026-08-28 · accepted**

**Context.** Phase 0's `.gitignore` blanket-ignored `*.joblib`, `*.pt`, `*.pth`, `*.bin`, `*.safetensors`, `*.faiss`, `*.index`, `*.pkl`, commented "model artifacts: git-lfs only, see .gitattributes" — intending these to route through LFS. A gitignore exclusion prevents `git add` from staging a file at all, regardless of `.gitattributes`; it does not hand the file to LFS, it hides it from git entirely. Caught in Phase 6 when the first real trained model files (`backend/artifacts/bail/*.joblib`) never appeared in `git status` after training.

**Decision.** Scoped the extension-based ignores to everywhere except `backend/artifacts/` via `/**/*.ext` patterns plus a `!backend/artifacts/**` negation, verified to work without `git add -f`. `git lfs status` confirms these files now route through LFS as intended.

**Consequences.** Any artifact trained before this fix (only Phase 6's bail models) needed re-staging; none had been silently lost since they were never committed in the first place, just invisible to `git status` until now. Worth remembering: a gitignore rule and a gitattributes LFS rule are not the same thing, and writing one while intending the other fails silently rather than erroring.

---

## D-017 · Removed `custody_days`; `prior_record` is now a 3-state field; crime categories now match the real corpus
**2026-08-28 · accepted** (user decision, on the options raised by D-014)

**Context.** D-014 flagged two mismatches between the frozen Phase 3 API contract and the real training data (D-014): `custody_days` doesn't exist anywhere in IndianBailJudgments-1200, and `prior_cases` is a 3-level field (Yes/No/Unknown, with Unknown at 49%) collapsed to a boolean in the contract and the Phase 4 Predict form. Put to the user as an explicit choice between four options for `custody_days` and two for `prior_record`.

**Decision.**
- `custody_days`: **removed entirely** from `BailPredictRequest` (backend and frontend), the Predict Bail form, and ARCHITECTURE.md §4.2/§6. Rationale (user's): asking for a field the model provably ignores reads as a bug to anyone who notices, and is a worse story than a stated data gap. Documented as a known limitation in `MODEL_CARD_bail.md` rather than a silently dead field.
- `prior_record`: **changed to a 3-state Literal** (`"yes" | "no" | "unknown"`), both in the API contract and the Predict form (now a `SegmentedControl`, defaulting to `"unknown"` — the plurality real-world value). Rationale (user's): "Unknown" is essentially half the training distribution, not an edge case; collapsing it to boolean means a live user could never trigger the state the model spent half its training seeing.
- The stub backend's fixture-selection logic (`backend/app/routers/bail.py`) now maps `prior_record == "unknown"` to the low-confidence fixture — a real semantic choice (a case with unknown prior record is exactly the kind a model should be less sure about), not just a repurposed test hook.
- **Found and fixed in the same pass, not separately requested:** the Predict form's crime-category chips were invented before Phase 6's real data existed and didn't match any of the corpus's 12 actual categories — every submission would have silently landed in the model's "Unknown" catch-all. Fixed alongside these changes since it's the identical class of bug the user was just deciding on, and left broken would have undermined the very fix being made. See `bail_audit.md`.
- **Found, documented, deliberately not fixed:** the trained model also uses `bail_type` as a feature, which the form never collects. Flagged as a Phase 9 follow-up rather than added now — new scope, not a correction of what's already broken, and out of the batch of decisions actually asked for.

**Consequences.** `BailResultPanel`'s live baseline toggle and `/predict/bail/baseline` both updated to the new field. Playwright's `verify-phase4.mjs` updated to click real category labels (`Murder`, `Extortion`) instead of the invented ones (`Assault`, `Theft`). All 47 checks (35 + 12) re-verified green after the change, plus manual `curl` verification of the 3-way `prior_record` values and the still-permissive handling of a stray legacy `custody_days` in a request body (Pydantic ignores unknown fields by default rather than erroring, which is the correct behaviour for a removed field, not something that needed extra code).

---

## D-018 · NER backbone: default to spaCy, no formal benchmark gate
**2026-08-28 · accepted** (user decision)

**Context.** ARCHITECTURE.md §12 left spaCy vs. InLegalBERT token classification as an open decision for Phase 2 (NER), to be settled by benchmarking both on the same weak-supervised set.

**Decision.** Default to spaCy without blocking on a formal benchmark first. Train the spaCy NER model when Phase 7 reaches it, since it's fast to iterate; only reach for InLegalBERT token classification if spaCy's entity F1 is clearly disappointing on a quick evaluation. Rationale (user's): the quality floor (§11) budgets a real local warm-up cost across five loaded models running on a laptop, and spaCy is the safer default for something that has to coexist with four other models rather than dominate the machine's resources.

**Consequences.** Phase 7's NER work starts with spaCy directly, no comparison harness built first. If spaCy underperforms, InLegalBERT token classification is the fallback, evaluated then, not preemptively.

---

## D-019 · Retrieval corpus capped at ~10,000 judgments, not the full 35,000
**2026-08-28 · accepted** (user decision)

**Context.** IL-TUR provides roughly 35,000 Supreme Court judgments, reused as the precedent-retrieval corpus per D-006 rather than standing up a second Indian Kanoon scrape. ARCHITECTURE.md §12 left the exact cap open, to be stated explicitly in the retrieval model card once decided.

**Decision.** Cap the FAISS index at approximately 10,000 judgments. Rationale (user's): full 35K is diminishing returns for a demo — no one evaluating this project will notice or care whether precedent search draws from 10K or 35K documents, but everyone will notice a ten-minute FAISS build or an oversized download. This is a stated scope decision, not a hidden shortcut, and belongs explicitly in the retrieval model card when Phase 7 builds the index.

**Consequences.** Phase 7's retrieval work fetches and indexes a ~10K subset of IL-TUR, not the full corpus. `README.md`'s dataset table and the eventual retrieval `MODEL_CARD.md` both need to state the cap plainly, per the original §12 requirement.

---

## D-020 · Packaging stays manual two-terminal through Phase 9; sidecar only at Phase 10 if time remains
**2026-08-28 · accepted** (user decision)

**Context.** ARCHITECTURE.md §12 left PyInstaller-sidecar packaging vs. manual `uvicorn` + `npm run tauri dev` open, explicitly marked "Phase 10, optional."

**Decision.** Confirmed as a Phase 10 decision, not sooner. Manual two-terminal stays the iteration workflow through the remaining ML and backend-wiring phases; a PyInstaller sidecar is worth building once, for demo-day polish, only if time remains at that point. Rationale (user's): sidecar packaging is real, valuable polish that should not consume time earlier when the API and models are still changing weekly.

**Consequences.** No action needed now. Revisit at Phase 10 per the original plan; this entry just confirms the plan rather than changing it.

---

## D-021 · Bail model's hindsight-framing risk stays disclosed via ablation, not "fixed" with regex
**2026-08-28 · accepted** (user confirmed D-015)

**Context.** D-015 already made this call during Phase 6: disclose the ~4-point F1 gap between the full model and a structured-only ablation, rather than attempt a fragile regex-based redaction of outcome-revealing language in the `facts` field.

**Decision.** Confirmed as-is; no change. Rationale (user's, endorsing D-015): a regex "fix" that doesn't actually address the leakage but makes the number look cleaner is a worse outcome than an honestly disclosed, quantified risk — the kind of thing that looks bad if discovered later and undisclosed, and looks rigorous if flagged upfront. Framed as a genuine strength of the project's methodology, not a weakness to minimize.

**Consequences.** None — `MODEL_CARD_bail.md`'s existing disclosure stands. Recorded here only so the confirmation itself is part of the decision trail, not just the original call.

---

## D-022 · QA and retrieval sourced via ungated ILDC mirrors, not the gated official IL-TUR
**2026-08-28 · accepted**

**Context.** The sourcing brief's plan for QA (56-doc expert split with gold spans) and retrieval (35K judgments) both pointed at `Exploration-Lab/IL-TUR` on Hugging Face. That repo is gated - it requires a human to manually request and be granted access on a specific HF account, which this session cannot do on the user's behalf. The `pcr/` (precedent case retrieval) config, which would have given real query-candidate relevance pairs for retrieval evaluation, is only available there.

**Decision.** Sourced the underlying ILDC data through two community-uploaded, ungated mirrors instead: `jayadityagandham9/ILDC_35k_COMPLETE` (38,904 rows, real Supreme Court judgment text - this is the retrieval corpus) and `anuragiiser/ILDC_expert` (54 rows - inspected and found to be a *human evaluation* dataset comparing model-generated explanations to official reasoning, not (question, answer_span) training data, so **not used** for QA; see the QA sourcing note below). The original data's license terms (academic research only, no commercial use, per the CJPE GitHub repo's stated terms) are treated as still binding regardless of the mirror's own missing license metadata - a re-upload does not change the underlying data's terms.

**Consequences.** Retrieval proceeds on real judgment text via the ungated mirror. QA does not use IL-TUR at all - see D-023. `README.md`'s dataset table needs a note that IL-TUR access in practice went through community mirrors of the same corpus, not the official gated repo, with the same non-commercial restriction carried forward. Revisit only if the user later obtains their own HF access grant to the official gated repo and wants to switch to `pcr/`'s real relevance judgments for a more rigorous retrieval evaluation than the self-retrieval proxy this project uses instead (see `MODEL_CARD_retrieval.md`).

---

## D-023 · QA training data comes from IndianBailJudgments-1200, not IL-TUR
**2026-08-28 · accepted**

**Context.** With the intended IL-TUR QA source gated (D-022) and its community mirror turning out to be the wrong kind of dataset entirely (human evaluation of generated explanations, not span-annotated Q&A), a different QA training source was needed. IndianBailJudgments-1200 - already fetched, audited, and understood from Phase 6 - turned out to already have the right shape, unused until now: `legal_issues` is a list of ~3 genuine questions per record ("Whether fresh bail is needed when new, more serious penal sections are added"), and `judgment_reason` is the court's answer to them.

**Decision.** Build QA training examples from `legal_issues` (question) and `facts + judgment_reason` (context), 1,200 records x ~3 questions each - more examples than the 56-document expert split would have given, and on data this project already has full audit provenance for.

Real answer-span ground truth still does not exist, so a distant-supervision heuristic is used - and a real circularity risk was caught before training started: using the *same* similarity method to both generate "gold" spans and serve as the "baseline" would make the baseline score ~100% by construction, proving nothing. The fix: gold spans are located via semantic embedding similarity (sentence-transformers MiniLM), the baseline uses bare lexical TF-IDF (a genuinely different, independent signal), and both are scored against the same gold - so the comparison is real rather than circular.

**Consequences.** `MODEL_CARD_qa.md` must state plainly that answer spans are a semantic-similarity proxy, not hand-verified ground truth, and that questions come from a legal-issue phrasing convention ("Whether X...") rather than natural conversational phrasing a real user might type - a genuine limitation for the product's actual "ask a question" UI, worth testing against real user phrasing later.

---

## D-024 · NER's near-perfect baseline reveals the synthetic benchmark's ceiling, not a solved task
**2026-08-28 · accepted**

**Context.** The NER regex baseline (deliberately designed to use only positional/format heuristics, with no lookup of known field values) scored COURT and PARTY at exactly F1 1.0, and DATE/IPC_SECTION above 0.95, on the synthetic-document test split (`train_ner.py`, `MODEL_CARD_ner.md`). A near-perfect "blind" baseline is a signal worth stopping on, not a result to report proudly without examining it.

**Decision.** Diagnosed rather than accepted at face value: the synthetic document-assembly method (necessary in the first place because no real OCR'd text with entity positions exists - see the model card) places every field on a fixed, identical line position across all 1,200 documents. A positional heuristic ("line 1 is the court") is therefore correct by construction, not because the regex is genuinely good at extraction. This was documented prominently in `MODEL_CARD_ner.md` as the primary caveat on the whole module, not buried in a limitations list: **the near-perfect scores validate that the training pipeline works end to end, not that document NER is solved for this product.**

**Consequences.** The real test of this pipeline is Phase 9, against actual OCR'd text from the corpus's 1,200 source PDFs, where header format will vary by court, year, and OCR quality in ways this synthetic benchmark cannot reveal. If a more meaningful pre-Phase-9 benchmark is wanted later, varying the synthetic template (randomized field order, injected OCR-like noise) would make the regex baseline genuinely blind again - flagged as a possible improvement, not done now, since the honest disclosure already in the model card serves the same purpose without the extra engineering.

---

## D-025 · `legal_issues` field type inconsistency found and fixed, Phase 6 bail model retrained
**2026-08-28 · accepted**

**Context.** Building QA training data (D-023) surfaced a genuine data-quality issue in IndianBailJudgments-1200 that Phase 6's audit missed: `legal_issues` is a proper JSON list of ~3 discrete questions in only ~2% of records (21/1200) - the small sample checked during Phase 6. In the other **98% of records (1,179/1,200)**, the field is a single string (occasionally with 1-2 semicolon-separated sub-issues). Caught by a sanity check on example counts (expected ~1,400 QA training examples, got 151,498) - a naive `for question in record["legal_issues"]` iterates a string character by character, exploding one record into ~150 garbage single-character "questions."

Phase 6's `build_text_features()` had a *different*, quieter symptom of the same root issue: `df["legal_issues"].apply(lambda x: " ".join(x) if isinstance(x, list) else "")` defensively fell back to an empty string for non-list values - never crashed, never warned, just silently contributed **zero legal_issues text to the bail model's TF-IDF features for 98% of training rows**, for the entire duration of Phase 6.

**Decision.** Added `normalize_legal_issues()` to `train_bail.py` (the shared module `train_qa.py` and `train_bail_fusion.py` both import it from) - handles the list case as before, splits the string case on `;`, treats a bare string with no semicolon as one item. **Phase 6's bail baseline and final models were retrained** with the fix, since the fusion tier (about to be trained in the same phase) needed a consistent, non-buggy text pipeline to compare against - training three tiers where one used complete text and two used silently-truncated text would have made the three-way comparison invalid.

**Consequences.** `bail.json` and `MODEL_CARD_bail.md` updated with the retrained numbers: baseline (LogReg) F1 0.7709 → **0.7810**, PR-AUC 0.8552 → **0.8868**; final (XGBoost+TF-IDF) F1 0.8117 → **0.8207**, PR-AUC 0.8979 → **0.9331** - both genuinely improved once the model could actually see the text it was supposed to be trained on. The structured-only ablation (D-015) is unaffected, since it never used text features. `bail_audit.md` updated with this finding as a retroactive correction to Phase 6's own audit - a reminder that a defensive `isinstance` guard prevents a crash, not a silent data-quality bug, and the two are easy to mistake for each other when the code "just works."

---

## D-026 · Retrieval comparison had a scale-mismatch bug, caught twice, fixed on the third attempt - and InLegalBERT lost
**2026-08-28 · accepted**

**Context.** The first retrieval evaluation scored MiniLM on the full 82,444-chunk corpus but InLegalBERT on a smaller 1,500-chunk subset (chosen only to keep InLegalBERT's CPU embedding time reasonable). The result - InLegalBERT at MRR 1.0, Recall@5 1.0 - was too perfect to trust, and investigation confirmed why: in that small subset, 137 of 153 multi-chunk documents had *exactly* 2 chunks, meaning most eval queries just had to find one near-identical sibling chunk among 1,500 candidates - a far easier task than the baseline's 82,444-chunk search. Not a real result.

**The first fix attempt was also wrong**, for a different reason: it tried to replay the original run's random-number sequence to recover the identical 1,500-chunk subset, but missed an earlier `rng.shuffle()` call in the pipeline (the corpus-capping step), so it silently compared MiniLM against a *different* random subset than InLegalBERT had actually been scored on. Caught immediately - only 2 of the intended 150 eval queries survived into that mismatched subset, a sample size that meant nothing on its own and was itself the tell that something upstream was still wrong.

**Decision.** Abandoned RNG replay entirely. Built one well-defined evaluation set directly and deterministically: all 150 query documents with their full sibling-chunk sets guaranteed present, plus 800 distractor documents, for 8,149 chunks total - both models scored identically on this set via fresh embedding (InLegalBERT) and exact FAISS-index vector reconstruction (MiniLM, no re-embedding needed). Result, this time real: **MiniLM beats InLegalBERT** (MRR 0.309 vs 0.219, Precision@5 0.164 vs 0.085) - reported honestly per CLAUDE.md section 7's rule that a final model that doesn't beat its baseline is disclosed, not hidden.

**Consequences.** `MODEL_CARD_retrieval.md` documents the full saga (both bugs, both fixes, the final valid number) rather than presenting only the clean final answer - the two false starts are as informative as the eventual result, since they are exactly the kind of scale-mismatch mistake this evaluation methodology is prone to. The production FAISS index ships with MiniLM, which is now confirmed to be both the practical choice (CPU throughput) and the empirically better one (this evaluation) - a stronger, more coherent justification than either fact alone. `train_retrieval.py`'s original comparison code is left as-is (documented as superseded, not deleted) with `fix_retrieval_eval.py` as the corrected follow-up; a future cleanup could merge the fix directly into the main script, not done here since the working numbers are already captured.

---

## D-027 · InLegalBERT-fused bail model is not an unambiguous win over XGBoost+TF-IDF
**2026-08-28 · accepted**

**Context.** The InLegalBERT-fused tier (frozen embeddings + structured features, XGBoost head) was expected to be the strongest bail tier, matching ARCHITECTURE.md section 7's stated progression. Measured against the identical held-out split as the other two tiers: F1 improved marginally over XGBoost+TF-IDF (0.8207 → 0.8258, +0.0051), but **PR-AUC regressed** (0.9331 → 0.8948) and calibration was measurably less tight.

**Decision.** Reported as-is, not rounded up to "the final tier wins" - CLAUDE.md section 7's rule that a final model not beating its baseline is disclosed, not hidden, applies here even though F1 technically ticked up. The likely explanation, stated in `MODEL_CARD_bail.md`: frozen, mean-pooled InLegalBERT embeddings average an entire document into one vector, losing exact discriminative signal (a specific IPC section mention, a specific phrase) that TF-IDF captures directly - and on a small corpus (958 training examples), a sharp lexical representation can match or beat a generic pretrained embedding never fine-tuned for this task. This mirrors the retrieval module's own finding in the same phase (D-026) that raw InLegalBERT embeddings underperformed a purpose-built sentence encoder - a consistent pattern, not two unrelated coincidences.

**Consequences.** Phase 9's real backend wiring must make a deliberate choice about which bail tier to actually serve, informed by this table - "final" does not automatically mean "best" here. `MODEL_CARD_bail.md`'s limitations section says this explicitly, so the choice cannot be made by default/inertia later. A genuine future improvement, if pursued, is end-to-end fine-tuning of InLegalBERT (not just frozen embeddings) - the QA module's training script (`train_qa.py`) is the working example of what that would look like for bail too, not attempted here given the CPU-only time budget for this phase.

---

## D-028 · Fairness audit methodology: separate controls, not joint; and the gap grows, not shrinks
**2026-08-28 · accepted**

**Context.** ARCHITECTURE.md section 7 specifies the bail fairness audit as "disparity test controlling for crime severity, prior record" - naturally read as a joint control. Checked before committing to a method: crossing `crime_type` (12 categories) with `prior_cases` (3 categories) over the 1,192 Male/Female records gives 36 cells, several of which have almost no female-coded records at all (Murder: 2, Attempt to Murder: 1, Sexual Offense: 3, Theft or Robbery: 3 - out of 122 female records total). Most cells of that cross-product would hold zero or one data point.

**Decision.** Control for `crime_type` and `prior_cases` separately (stratified demographic parity, size-weighted, strata with under 3 records of either gender excluded and listed rather than silently dropped) rather than jointly. `bail.json`'s single `gap_after` slot uses the crime-type-controlled number, since "crime severity" is named first in the spec and `crime_type` is the most direct available proxy for it - used as-is, not re-ranked into a constructed severity score, which would have been its own unaudited assumption.

**The finding itself, not just the method, matters here.** For both the fused and XGBoost+TF-IDF tiers, the demographic parity gap **increased** after controlling for crime type (fused: 0.061 → 0.087; XGBoost+TF-IDF: 0.098 → 0.125) - the opposite of the reassuring "the raw gap is mostly explained by legitimate factors" story. A plausible reading, stated in `bail_fairness.md`: the raw/marginal gap may be partly masked by gender's uneven distribution across crime types, and comparing within the same crime type removes that masking rather than confirming it away.

**Consequences.** The larger, more concerning number is the one surfaced in the model card and the one that should appear on the Insights screen's "before/after" display when Phase 10 builds it - not quietly preferring whichever number looks better. Individual per-stratum gaps range from 0.014 to 0.35, with the largest resting on single-digit female sample sizes (Sexual Offense: 3 female records) - disclosed explicitly in `bail_fairness.md` so the weighted-average headline number is not mistaken for uniformly reliable. This audit measures association on a small, imbalanced corpus (122 female-coded records), not a causal mechanism, and does not extend to other potentially sensitive attributes (region, court) without the same "excluded from training" design choice being made for them first.

---

## D-029 · Bail tier served: XGBoost+TF-IDF, not the InLegalBERT-fused tier
**2026-08-29 · accepted**

**Context.** decisions.md D-027 left "which bail tier Phase 9 actually serves" as an open, deliberate choice: the InLegalBERT-fused tier improves F1 marginally over XGBoost+TF-IDF (0.8258 vs 0.8207) but regresses PR-AUC (0.8948 vs 0.9331) and calibration.

**Decision.** Serve XGBoost+TF-IDF. Better PR-AUC and calibration, and it avoids loading a second ~450MB InLegalBERT encoder purely for frozen embeddings when QA already loads its own fine-tuned InLegalBERT checkpoint for a genuinely different purpose - keeping total warm-up low matters more than a marginal, mixed-direction F1 gain (ARCHITECTURE.md section 11's <10s warm-up budget).

**Consequences.** `app/models/bail.py` loads `final_xgboost.joblib`, not `final_inlegalbert_fused.joblib` - the fused model's artifact stays on disk, trained and evaluated, but unserved. If a future phase revisits this (e.g. after full end-to-end InLegalBERT fine-tuning, which might resolve the PR-AUC regression differently than frozen embeddings did), this is the entry to update.

---

## D-030 · Real gaps found wiring the backend: uncollected features, no case-title metadata, and a source-corpus text artifact
**2026-08-29 · accepted**

**Context.** Wiring real model calls into the backend surfaced three integration gaps that only become visible once real data flows through the whole pipeline, not from any single training script in isolation.

1. **Bail's uncollected fields.** The live `/predict/bail` request never collects `bail_type`, `court`, `bail_cancellation_case`, `landmark_case`, `parity_argument_used`, or `legal_issues` - all real training features. `app/models/bail.py` fills these with the training corpus's own verified majority-class values (`bail_type`="Regular" 75.5%, `court`="Other", the three flags all False at 71-90% majority) rather than guessed defaults, and forces `confidence_band` to "low" when the narrative is under 15 words - the model is then running closer to the structured-only ablation (F1 0.7718) than the reported 0.8207, and the UI should not imply otherwise.

2. **No case-title metadata in the retrieval corpus.** Checked directly: the source CSV has only `id`, `text`, `label` columns - no title, ever. `app/models/retrieval.py` uses a text-preview title (the document's own opening words) rather than fabricate a formatted "X vs Y" citation that does not exist. `court` is "Supreme Court of India" for every result - corroborated by the documents' own content (recurring "Leave granted," references to specific High Courts as the court appealed from), not merely assumed from the sourcing brief's description.

3. **A pre-existing text-corruption pattern in the source corpus itself.** Search results show corrupted words like "companysidered" (considered), "companynsel" (counsel), "numberperson" (no person). Verified conclusively against the raw source CSV directly, before writing this entry: document `2019_1170`'s full raw text (not this project's chunked/processed copy) already contains `"companyccused"` for "co-accused" and `"companynsel"` for "counsel" at the exact quoted context. The mechanism is a blind substring replace with no word-boundary check - every literal `"co"` was replaced with `"company"` (and, per the "numberperson" example, every `"no"` with `"number"`) somewhere in whatever anonymization or text-extraction pipeline originally produced this ILDC mirror, well before this project ever downloaded it. Not introduced by this project's chunking/FAISS pipeline - checked directly rather than assumed, to avoid misdiagnosing a source-data defect as this project's own bug. Disclosed in `MODEL_CARD_retrieval.md` as a known corpus quality issue, not fixed here - reversing the two known substitutions is a reasonable future cleanup, not attempted in this phase.

4. **QA quality degrades materially on the live retrieval corpus** - confirmed empirically via `/qa/extract`, not merely inferred from the model card's own pre-stated limitations. `MODEL_CARD_qa.md`'s limitations #2 and #3 predicted exactly this before Phase 9: the model was fine-tuned on `IndianBailJudgments-1200`'s `facts + judgment_reason` (a few hundred words, formally-phrased "Whether X..." questions from `legal_issues`), but the live Case Detail / Ask flow runs on the ILDC retrieval corpus (full multi-page Supreme Court judgments, the "co"->"company" corruption from item 3 above, and naturally-phrased user questions). Tested directly: on real documents, several real questions returned near-zero-confidence, off-topic, or garbled spans (e.g. score 0.0002-0.0013 on "When was the respondent arrested?" and "What was the accused charged under") - well below the reported held-out F1 of 0.7393. Even training-style "Whether X..." phrasing on the live corpus scored inconsistently (0.22-0.36). The chunk-retrieval and offset-mapping serving code was verified separately to be working correctly (the right or a plausible chunk is being located and returned) - the shortfall is the fine-tuned model's real generalization gap to a different corpus and question style, not a serving bug.

5. **A real 500 in `/summarize` on short texts, found and fixed via the Playwright regression suite, not just curl spot-checks.** `SummarizeResponse.compression_ratio` is schema-bounded `le=1`. For a short text where nearly every sentence gets selected (a real case: OCR output from a short scanned document), rejoining the selected sentences with a single space per boundary can come out fractionally longer in character count than the original text's own newline/multi-space formatting - observed directly at 1.0029 on a real `/scan/extract` output fed into `/summarize`. Pydantic response validation then raised, which the app's generic exception handler correctly turned into an opaque 500 rather than crashing - correct handling of an incorrect value. Fixed at the computation site in `app/models/summarization.py` by clamping to 1.0 (a summary should never report as "larger than the source" - this is a whitespace-accounting artifact, not a real state to expose). Found by exercising the Scan -> Summarize flow through the real frontend in Playwright, which a curl-only endpoint sweep with typical-length inputs would not have hit.

6. **A real title inconsistency between `/search/precedent` and `/case/{case_id}` for the same document, found and fixed via the Playwright regression suite.** `search()` built a result's `title` from the *matched chunk's* text, while `get_case_summary()` built it from the document's opening text (chunk_idx 0) - so the same `case_id` could show two different titles depending on which endpoint produced it, and a case saved from its detail view would not visually match the title a user recognized it by on the search results page. Caught because the Library regression check (save from Case Detail, confirm it shows up in Library under the title seen on Search) genuinely failed, not because it was anticipated. Fixed in `app/models/retrieval.py`'s `search()`: `title` now always resolves to the document's own chunk_idx-0 text - a stable per-document identity - while `snippet` keeps showing the query-matched chunk, which is a legitimately different, still-useful piece of information (why this result matched).

**Consequences.** All four (plus items 5-6's fixes) are documented in their respective model cards. None block the backend from functioning correctly - predictions, search, case detail, and QA all return real, honestly-computed results - but all four measurably affect quality relative to what the training-time metrics alone would suggest, and a user or reviewer should not discover them by surprise. Item 4 in particular means the Ask-a-question feature should ship with a visibly lower implied confidence than the Insights screen's 0.7393 F1 might suggest - the confidence score returned per-answer is real and already reflects this (it is often near-zero on this corpus), so the UI already has the honest signal available; it must not be hidden behind a rounded "high confidence" badge.

---

## D-031 · Insights discloses which tier is actually served, not just "baseline" and "final"
**2026-08-29 · accepted**

**Context.** ARCHITECTURE.md section 4.7 specifies a baseline-to-final comparison bar per module. Taken literally, "final" would read as "what the app runs" - but that is not true for two of the five modules: bail serves XGBoost+TF-IDF, not the fused "final" tier (D-029), and retrieval serves MiniLM (labeled "baseline" in `ml/reports/retrieval.json`), not the InLegalBERT "final" tier (`MODEL_CARD_retrieval.md`). Rendering the comparison chart naively off the `baseline`/`final` field names alone would visually imply the wrong model produced whatever the user just saw on Predict Bail or Search Precedent moments earlier - the opposite of what a "walk straight into Insights and show the model that produced it" demo (ARCHITECTURE.md 4.7) is supposed to do.

**Decision.** Each module's comparison config in `app/src/screens/Insights.tsx` carries an explicit `served` flag per tier, independent of whichever field name (`baseline` or `final`) the metrics JSON happens to store that tier's numbers under. A `Chip` badge (reused from the existing filter-chip component, not a new one-off) marks the served tier in both the comparison bar and the full metric table. All underlying values still come from `/metrics` at request time - only which tier gets the "Served" label is a static, reviewed mapping, not a metric.

**Consequences.** If a future retrain changes which tier is served (e.g. an end-to-end fine-tuned InLegalBERT bail model that finally wins on every metric), this mapping in `Insights.tsx` needs a manual update alongside the backend model-loading change - it will not silently self-correct the way the numeric values do. Flagged here so that pairing is not missed.

---

## D-032 · Phase 11 packaging found a real Tauri-detection bug masked by dev mode since Phase 5
**2026-08-29 · accepted**

**Context.** `lib/api.ts` decided whether to use the Rust-mediated `@tauri-apps/plugin-http` fetch (ARCHITECTURE.md section 5.3's whole reason to bypass browser CORS) by checking `window.__TAURI__`. Tauri v2 only sets that global when `app.withGlobalTauri` is explicitly `true` in `tauri.conf.json` - this project never set it. The real v2-injected global is `window.__TAURI_INTERNALS__`. The check had been silently wrong since Phase 5.

This never surfaced before Phase 11 because `tauri dev` loads the frontend from `devUrl` (`http://localhost:5173`) - already in FastAPI's `allow_origins` CORS list for the plain-browser-tab case (ARCHITECTURE.md section 5.3's stated purpose for that list). A plain `fetch()` from that origin succeeds even though it is not the Tauri-mediated path the architecture describes, so Phase 5's `tauri dev` verification (a real gate, genuinely checked - see SECURITY.md's Phase 5 row) could not have caught this: it was testing the dev server's origin, which happens to work by accident, not the packaged app's actual runtime behavior.

A real `tauri build` release, loaded from a different origin entirely (not in that CORS list), hit the bug immediately: every API call failed with "Could not reach the local model server," confirmed by capturing the actual native window of the built `.exe` (not just `tauri dev`) via `verify-native-window.ps1`.

**Decision.** Fixed the detection to `window.__TAURI_INTERNALS__` in `lib/api.ts`. Verified by rebuilding the release installer and re-capturing the native window: Home's live `/health` stats render correctly (`Backend ok`, `Modules 5/5`, real uptime) in the actual packaged binary, not just the dev server.

**A second, independent bug found in the same pass:** `screens/Predict.tsx`'s header stats hardcoded `'xgboost-stub'` / `'logreg-stub'` - leftover literal strings from the Phase 3 fixture era, never updated when Phase 9 wired in the real backend, violating CLAUDE.md section 7's "no metric is ever hardcoded" rule. Fixed to read the real `BailPredictResponse.model_version` (`'pending'` before any prediction has run); the "Baseline" stat was dropped rather than given a second stale value, since no lightweight endpoint reports the baseline model's name outside of actually running the baseline comparison, which already renders it correctly inside `BailResultPanel`.

**A third, independent bug found while verifying this fix:** `app/src-tauri/scripts/verify-native-window.ps1`'s `Find-WindowByPid` set `$script:result` inside its `EnumWindows` callback but returned a function-local `$result` that was never updated - it always returned `IntPtr.Zero` regardless of whether a window was actually found. A second, unrelated bug in the same function used `$pid` as a parameter name, which collides with PowerShell's read-only automatic `$PID` variable and crashed outright. Both fixed; the script now correctly locates and captures the target window.

**Consequences.** Every Phase 5-10 status report describing frontend<->backend connectivity as verified "through the Rust-mediated call" was correct about the requests succeeding, but wrong about the mechanism - they succeeded via the dev-server CORS allowance, not the Tauri plugin. This is now actually true, not just previously believed true. Any future architecture-compliance claim about this app should be re-verified against a `tauri build` release, not `tauri dev` alone - the two are not equivalent test surfaces for this exact reason.
