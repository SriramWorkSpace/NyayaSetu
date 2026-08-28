# Bail dataset audit — IndianBailJudgments-1200

> The "hand-audit annotation quality on a sample" step (plan.md Phase 6). Full-corpus profiling plus a manual read of a sample, before any feature code was written against assumed fields.

**Source:** [SnehaDeshmukh/IndianBailJudgments-1200](https://huggingface.co/datasets/SnehaDeshmukh/IndianBailJudgments-1200), CC BY 4.0. Actual filename on the hub is `indian_bail_judgments.json`, not the name assumed from the sourcing brief — corrected in `fetch_bail.py` after the first attempt 404'd.

## Field inventory

The dataset's real schema differs from what ARCHITECTURE.md's `BailPredictRequest` assumed. Actual fields: `case_id`, `case_title`, `court`, `date`, `judge`, `ipc_sections`, `bail_type`, `bail_cancellation_case`, `landmark_case`, `accused_name`, `accused_gender`, `prior_cases`, `bail_outcome`, `bail_outcome_label_detailed`, `crime_type`, `facts`, `legal_issues`, `judgment_reason`, `summary`, `bias_flag`, `parity_argument_used`, `legal_principles_discussed`, `region`, `source_filename`.

**No `custody_days` field exists anywhere in the corpus.** The bail model trained here does not use custody duration as a feature — it cannot, the data was never collected. **Resolved:** `custody_days` was removed from the API contract and the Predict Bail form entirely (decisions.md D-017), rather than leaving a field the model provably ignores. Documented as a known data gap in `MODEL_CARD_bail.md`.

**Related, found while implementing the fix above:** the Predict Bail form's crime-category chips (`Theft`, `Assault`, `Economic offence`, `Cybercrime`, `Forgery`, `Other`) were invented before this dataset existed and do not match any of the corpus's 12 real `crime_type` values. Every submission using the old labels would have silently landed in the model's `fillna("Unknown")` catch-all regardless of what the user picked. Fixed alongside D-017: the form now uses the actual 12 training categories (Narcotics, Theft or Robbery, Dowry Harassment, Sexual Offense, Fraud or Cheating, Cyber Crime, Extortion, Kidnapping, Murder, Domestic Violence, Attempt to Murder, Others).

**Also related, noted but not fixed now (scope discipline — the fix above was reactive, this would be additive):** the trained model includes `bail_type` (Regular/Anticipatory/Interim) as a structured feature, but the Predict Bail form never collects it — at inference it falls back to the encoder's `fillna("Unknown")` path, same as any unseen category. Adding a `bail_type` selector to the form is a reasonable Phase 9 follow-up, not done here since it's new scope rather than a correction of something already broken.

## Retroactive correction, found in Phase 7

**`legal_issues` is a proper list in only ~2% of records (21/1,200).** The small sample checked below (and the `sample.json` dump) happened to fall entirely within that 2% - every example in this document's original write-up showed a clean 3-item list, which is not representative of the corpus. In the other **98% (1,179/1,200)**, the field is a single string (occasionally with 1-2 semicolon-separated sub-issues). Found while building Phase 7's QA training data, via a sanity check that caught an exploded example count.

This matters retroactively: Phase 6's `build_text_features()` used `" ".join(x) if isinstance(x, list) else ""` on this field - a defensive guard that never crashed, but silently contributed **zero `legal_issues` text to the bail model's features for 98% of training rows**, for the entire duration of Phase 6, with no error or warning. Fixed in `train_bail.py` via `normalize_legal_issues()`; Phase 6's bail baseline and final models were retrained with the corrected text pipeline (decisions.md D-025). Both improved: baseline F1 0.7709 → 0.7810, final F1 0.8117 → 0.8207. See the updated `MODEL_CARD_bail.md`.

**The lesson for future audits of this dataset (and generally):** checking `isinstance(records[0][field], list)` on a handful of early records is not the same as checking it across the full corpus. A field that "looks like a list" in a spot check can have a completely different shape in the bulk of the data.

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
