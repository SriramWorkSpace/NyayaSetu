# Model card — Bail Outcome Prediction

**Module:** `bail` · **Version:** Phase 7, full three-tier progression — LogReg → XGBoost (structured + TF-IDF) → InLegalBERT-fused (ARCHITECTURE.md section 7). The fairness audit is Phase 8.

## Data

**Source:** [IndianBailJudgments-1200](https://huggingface.co/datasets/SnehaDeshmukh/IndianBailJudgments-1200), 1,200 High Court and Supreme Court bail judgments. **License: CC BY 4.0.**

1,198 records after dropping 2 exact-duplicate-facts pairs found during the audit (`bail_audit.md`). Split 80/20 (958 train / 240 test), stratified on outcome, fixed `random_state=42`.

**This corpus contains no custody-duration field, and never did.** The model does not use custody days as a feature — it never could. Rather than keep a form field the model provably ignores, `custody_days` was removed from the API contract entirely (decisions.md D-017). This is stated here as a known data gap, not hidden behind a field that quietly did nothing: if custody duration existed in the source data, it would plausibly be a real predictive signal, and its absence is a genuine limitation of this dataset, not an implementation oversight.

## Features

**Used:**
- Structured, one-hot: `crime_type`, `bail_type`, `prior_cases` (3-level: Yes/No/Unknown — kept ternary rather than collapsed to boolean, since Unknown is 48.6% of the corpus)
- Structured, top-15-courts-plus-Other one-hot (78 raw values, bucketed to avoid a 78-column feature on 1,200 rows)
- Binary: `bail_cancellation_case`, `landmark_case`, `parity_argument_used`
- Multi-hot: `ipc_sections`, top 30 sections plus an "other section" bucket
- Text (TF-IDF, 3,000 features, 1-2 grams, `min_df=2`): `facts` + `legal_issues`

**Excluded, and why:**
- `judgment_reason`, `summary`, `bail_outcome_label_detailed` — these describe the court's own reasoning and conclusion. Training on them is not prediction; it's reading the outcome off a field that states the outcome.
- `accused_gender` — deliberately withheld from every feature set, so the Phase 8 fairness audit can test whether predictions correlate with gender through legitimate factors (crime type, court, prior record) *without* the model ever having seen gender directly. This is a design choice made now specifically to make that later audit meaningful.
- `bias_flag` — an annotator's fairness annotation, not a predictive signal. Reserved for Phase 8.
- `region` — redundant with `court` and a closer proxy to geography-linked demographics than the project wants influencing predictions.

## Known limitation: residual hindsight framing in `facts`

32% of records (384/1,200) have `facts` text that co-occurs "bail" with an outcome word (granted/rejected/cancelled/denied/allowed). Manual review found this is a mix of legitimate prior-proceeding history ("previously denied bail... the High Court reversed this" — real, usable context) and, in some records, language that plainly narrates *this* judgment's own conclusion inside the fact recitation. A reliable automatic separation of the two was judged out of scope for a Phase 6 baseline (see `bail_audit.md` for the reasoning). Rather than hide this behind one score:

> **Numbers below are post-correction.** Phase 7 found that `legal_issues` is a proper list in only ~2% of records — 98% store it as a single string, which the feature code originally used to build this table silently treated as empty text rather than erroring. All three tiers below use the corrected text pipeline (decisions.md D-025).

## The full three-tier comparison

"Fused" means frozen InLegalBERT embeddings (mean-pooled over `facts + legal_issues`) concatenated with the same structured features, feeding an XGBoost head — not full end-to-end fine-tuning of the transformer jointly with the tabular data. That would need a custom training loop and materially more compute; the QA module does that genuine end-to-end fine-tuning instead, where the task structurally requires a trained head. For bail, frozen-embedding fusion is a legitimate technique on its own merits, and was benchmarked as CPU-feasible (~428ms/doc, under 10 minutes for 1,198 documents) before being chosen.

| Model | Features | F1 | PR-AUC |
|---|---|---|---|
| Baseline — Logistic Regression | structured + TF-IDF | 0.7810 | 0.8868 |
| XGBoost + TF-IDF | structured + TF-IDF | 0.8207 | **0.9331** |
| **Final — InLegalBERT-fused** | **structured + frozen InLegalBERT embeddings** | **0.8258** | 0.8948 |
| *(Ablation)* — XGBoost | structured only, no text at all | 0.7718 | 0.8237 |

**This is not a clean win for the fused tier, reported honestly rather than rounded up to a good story.** F1 improves marginally over XGBoost+TF-IDF (+0.0051), but **PR-AUC is actually worse** (0.9331 → 0.8948) — a real regression on that metric, not noise dismissed away. The likely explanation mirrors the retrieval module's finding (`MODEL_CARD_retrieval.md`): frozen, mean-pooled InLegalBERT embeddings average an entire document into one vector, which can lose exact discriminative signal — a specific IPC-section mention, a specific phrase — that TF-IDF captures directly and losslessly. On a corpus this small (958 training examples), a sharp lexical representation can match or beat a generic pretrained embedding that was never fine-tuned for this task. Fine-tuning InLegalBERT end-to-end (not just its frozen embeddings) might change this; not attempted here given the CPU-only time budget.

The ~4-point F1 gap between the structured-only ablation and the full-text models (any tier) is the number to read skeptically regardless of which tier: some of it is real signal, some of it may be the disclosed hindsight-framing risk in `facts` (see below).

## Evaluation

Held-out test split (240 records, never touched during training or feature-fitting — every encoder/vectorizer is fit on train only and applied to test via `.transform()`), identical across all three tiers for a clean comparison.

**Calibration** (InLegalBERT-fused, the final tier; quantile-binned, 5 bins): predicted vs. observed tracks reasonably but less tightly than the earlier XGBoost+TF-IDF tier did — e.g. predicted 0.5 → observed 0.375, predicted 0.90 → observed 0.792. Worth noting alongside the PR-AUC regression above: this tier's probability estimates are somewhat less reliable, not just its ranking metric. See `bail.json`'s `calibration_points` for the exact numbers the Insights screen reads.

**Fairness (Phase 8, `bail_fairness.md` for the full write-up):** `accused_gender` was excluded from training since Phase 6 specifically to make this audit possible. Demographic parity gap (Male vs Female predicted-grant rate), fused tier: **0.061 raw → 0.087 after controlling for crime type**. The gap gets *larger* after controlling for legitimate factors, not smaller — the opposite of a reassuring result, and the one worth highlighting rather than the smaller raw number. A plausible reading: the raw gap may be partly masked by gender's uneven distribution across crime types, and comparing within the same crime type removes that masking. Performance parity (F1: Male 0.963, Female 0.964) looks fine on its own — a different, separate lens from demographic parity, and the two point in different directions here. 122 female-coded records total is a small sample; read the per-stratum detail in `bail_fairness.json` before treating the weighted-average number as uniformly reliable.

## Limitations

1. No custody-duration data exists in the source corpus — a genuine data gap, stated plainly rather than papered over with a form field the model can't use (see above).
2. Residual hindsight-framing risk in `facts` text, disclosed with a number rather than fixed (see the audit doc for the full reasoning).
3. 1,198 records is a small corpus; the fused tier's underperformance on PR-AUC relative to TF-IDF may partly reflect this — a generic embedding has less to work with on so little data compared to a sharp, corpus-specific TF-IDF vocabulary.
4. Source judgments are High Court / Supreme Court appellate decisions on bail applications and cancellations — not trial-court first-instance bail hearings, which are the more common real-world use case this tool's UI implies.
5. `accused_gender` is excluded from training by design (see above), but this does not guarantee the model is free of gender-correlated bias learned through proxies (crime type, court, region-adjacent signals) — that is exactly what Phase 8 exists to measure, not something this card can claim in advance.
6. The "final" tier is not unambiguously the best tier on every metric (see the table above) — a real, disclosed finding, not a naming inconsistency. Whichever tier Phase 9 actually serves should be a deliberate choice made with this table in hand, not an assumption that "final" always means "best."
