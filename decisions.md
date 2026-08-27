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
