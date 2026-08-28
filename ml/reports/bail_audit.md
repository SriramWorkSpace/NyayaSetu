# Bail dataset audit — IndianBailJudgments-1200

> The "hand-audit annotation quality on a sample" step (plan.md Phase 6). Full-corpus profiling plus a manual read of a sample, before any feature code was written against assumed fields.

**Source:** [SnehaDeshmukh/IndianBailJudgments-1200](https://huggingface.co/datasets/SnehaDeshmukh/IndianBailJudgments-1200), CC BY 4.0. Actual filename on the hub is `indian_bail_judgments.json`, not the name assumed from the sourcing brief — corrected in `fetch_bail.py` after the first attempt 404'd.

## Field inventory

The dataset's real schema differs from what ARCHITECTURE.md's `BailPredictRequest` assumed. Actual fields: `case_id`, `case_title`, `court`, `date`, `judge`, `ipc_sections`, `bail_type`, `bail_cancellation_case`, `landmark_case`, `accused_name`, `accused_gender`, `prior_cases`, `bail_outcome`, `bail_outcome_label_detailed`, `crime_type`, `facts`, `legal_issues`, `judgment_reason`, `summary`, `bias_flag`, `parity_argument_used`, `legal_principles_discussed`, `region`, `source_filename`.

**No `custody_days` field exists anywhere in the corpus.** The bail model trained here does not use custody duration as a feature — it cannot, the data was never collected. The API's `BailPredictRequest.custody_days` field is accepted for schema forward-compatibility but is not consumed by this model. This needs resolving before Phase 9 wires the real model in: either the field is dropped from the contract, or a future data-collection pass adds it. Flagged here rather than discovered silently at integration time.

## Distributions (n = 1,200 before dedup)

| Field | Distribution |
|---|---|
| `bail_outcome` | Granted 736 (61.3%) · Rejected 464 (38.7%) — a majority-class guess scores 61.3% accuracy; F1 is the metric that actually matters here |
| `prior_cases` | Unknown 583 (48.6%) · Yes 401 (33.4%) · No 216 (18.0%) — treated as a 3-level category, not collapsed to boolean, since "Unknown" is nearly half the data and dropping it would discard real signal |
| `crime_type` | 12 categories, fairly balanced: Narcotics 134, Theft/Robbery 128, Dowry Harassment 123, Sexual Offense 121, Fraud/Cheating 121, Cyber Crime 116, Extortion 106, Kidnapping 95, Murder 89, Others 75, Domestic Violence 72, Attempt to Murder 20 |
| `bail_type` | Regular 906 · Anticipatory 268 · Interim 19 · Not applicable 4 · Others 2 · Unknown 1 |
| `accused_gender` | Male 1071 · Female 123 · Unknown 3 · Multiple 3 — **excluded from training features intentionally**, see Model Card |
| `bias_flag` | False 1187 · True 13 — an annotator's fairness flag, never a training feature; relevant to Phase 8, not Phase 6 |
| `court` | 78 unique courts; top 3 are Punjab & Haryana HC (130), Patna HC (119), Delhi HC (109). Bucketed to top 15 + "Other" for the one-hot to avoid a 78-column sparse feature on 1,200 rows |
| `region` | 28 unique values — not used as a feature (redundant with court, and a closer proxy to protected-characteristic-adjacent geography than the project wants baked into predictions) |

## Missingness

`facts`, `judgment_reason`, `summary`, `court`, `region`, `date` — zero missing across all 1,200 records. `ipc_sections` is empty for 205 records (17.1%) — handled as an empty list, not an error, in the multi-hot encoder.

## Duplicates (the leakage check)

- **`case_id`**: 1,200 unique of 1,200 — no ID collisions.
- **`facts` text**: 1,198 unique of 1,200 — **two exact duplicate pairs** (`0390`/`0391`, `0544`/`0551`). Dropped before the train/test split in `train_bail.py`, per CLAUDE.md section 7's leakage rule.
- **`case_title`**: 1,182 unique of 1,200 — 18 duplicate titles, most plausibly re-hearings or multi-stage proceedings of the same matter with distinct facts/case_ids. Not deduplicated on title alone; the actual leakage vector is duplicated *text*, which is what was checked and fixed.

## The finding that shaped the model design

A regex check for outcome language inside `facts` — `bail` co-occurring with `granted|rejected|cancelled|denied|allowed` — matched **384 of 1,200 records (32%)**. Reading a sample of these by hand, the pattern is real but mixed:

- Sometimes it narrates a **prior** proceeding's outcome ("previous courts denied bail... the High Court reversed this") — legitimate case history, arguably a genuine predictive signal, not leakage of *this* decision.
- Sometimes it plainly states **this** judgment's own outcome inside the fact recitation, which is not prediction, it's reading the last page first.

A regex pass to reliably separate the two was judged more likely to produce false confidence (looking cleaned while missing the actual leaky sentences, or stripping real signal) than to fix the problem. Instead: `judgment_reason`, `summary`, and `bail_outcome_label_detailed` — the fields that unambiguously describe the court's reasoning and conclusion — are excluded from every feature set outright, and a structured-features-only ablation is trained and reported alongside the full model specifically so this residual risk in `facts` has a visible number attached to it rather than being invisible inside one flattering F1 score. See `MODEL_CARD_bail.md`.
