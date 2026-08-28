# Model card — Bail Outcome Prediction

**Module:** `bail` · **Version:** Phase 6 baselines (LogReg → XGBoost). InLegalBERT fusion is Phase 7; the fairness audit is Phase 8.

## Data

**Source:** [IndianBailJudgments-1200](https://huggingface.co/datasets/SnehaDeshmukh/IndianBailJudgments-1200), 1,200 High Court and Supreme Court bail judgments. **License: CC BY 4.0.**

1,198 records after dropping 2 exact-duplicate-facts pairs found during the audit (`bail_audit.md`). Split 80/20 (958 train / 240 test), stratified on outcome, fixed `random_state=42`.

**This corpus contains no custody-duration field.** The model does not use custody days as a feature. The API's `custody_days` field is accepted for schema forward-compatibility only — see `bail_audit.md` for the open item this creates ahead of Phase 9.

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

| Model | Features | F1 | PR-AUC |
|---|---|---|---|
| Baseline — Logistic Regression | full (structured + text) | 0.7709 | 0.8552 |
| **Final — XGBoost** | **full (structured + text)** | **0.8117** | **0.8979** |
| Ablation — XGBoost | structured only, no `facts`/`legal_issues` text | 0.7718 | 0.8237 |

The ~4-point F1 gap between the structured-only ablation and the full model is the honest number to read skeptically: some of it is real signal (case complexity, factual detail), and some of it may be the disclosed hindsight-framing risk above. Neither the baseline/final comparison nor the Insights screen should be read as claiming this gap is 100% legitimate signal.

## Evaluation

Held-out test split (240 records, never touched during training or feature-fitting — the `OneHotEncoder`, `MultiLabelBinarizer`, and `TfidfVectorizer` are all fit on train only and applied to test via `.transform()`).

**Calibration** (XGBoost, quantile-binned, 5 bins): predicted vs. observed probability tracks closely across the range (e.g., predicted 0.86 → observed 0.812; predicted 0.96 → observed 0.979) — see `bail.json`'s `calibration_points` for the exact numbers the Insights screen reads.

**Fairness:** not yet run. `bail.json`'s `fairness` field is `null` until Phase 8.

## Limitations

1. No custody-duration data exists in the source corpus (see above).
2. Residual hindsight-framing risk in `facts` text, disclosed with a number rather than fixed (see above).
3. 1,198 records is a small corpus for a 3,000-feature TF-IDF vocabulary; the model likely overfits to phrasing idiosyncratic to this specific set of judgments rather than generalizing broadly.
4. Source judgments are High Court / Supreme Court appellate decisions on bail applications and cancellations — not trial-court first-instance bail hearings, which are the more common real-world use case this tool's UI implies.
5. `accused_gender` is excluded from training by design (see above), but this does not guarantee the model is free of gender-correlated bias learned through proxies (crime type, court, region-adjacent signals) — that is exactly what Phase 8 exists to measure, not something this card can claim in advance.
