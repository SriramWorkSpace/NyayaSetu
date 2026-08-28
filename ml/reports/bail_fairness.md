# Fairness audit — Bail Outcome Prediction

**Its own phase, per ARCHITECTURE.md section 9** — not folded into Phase 7's training work. Full methodology, numbers, and per-stratum detail are in `bail_fairness.json`; this is the narrative write-up.

## Protected attribute and why it was never a training feature

`accused_gender` was excluded from every bail training feature set since Phase 6, specifically so this audit could ask a meaningful question: **do predictions still correlate with gender through legitimate proxies (crime type, prior record, court), even though the model never saw gender directly?** That design choice, made three phases ago, is what makes this audit possible at all.

Unknown/Multiple gender records (6 of 1,200, ~0.5%) are excluded — too few to support a claim in either direction. The audited population is 1,192 Male/Female records (1,070 Male, 122 Female).

## Why crime type and prior record are controlled for separately, not jointly

ARCHITECTURE.md's phrasing — "controlling for crime severity, prior record" — reads naturally as a joint control. Checked before committing to a method: crossing `crime_type` (12 categories) with `prior_cases` (3 categories) gives 36 cells over 1,192 records, and several crime types have almost no female-coded records at all (Murder: 2, Attempt to Murder: 1, Sexual Offense: 3, Theft or Robbery: 3). Most cells of that cross-product would hold zero or one female record. A gap computed from one data point is not a measurement.

**Instead:** `crime_type` and `prior_cases` are each controlled for separately (stratified demographic parity, weighted by stratum size). Strata with fewer than 3 records of either gender are excluded from the weighted average and listed, not silently dropped — see `bail_fairness.json`. Two crime-type strata (Attempt to Murder, Murder) were excluded on this basis. `bail.json`'s single `gap_after` slot uses the crime-type-controlled number, since "crime severity" is named first in the architecture spec and `crime_type` is the most direct proxy available for it — no separate severity-score field exists in the source data, and none was constructed here (a re-ranking of crime types by assumed severity would have been its own unaudited assumption).

Audited on the **full cleaned corpus** (1,192 records), not just the held-out test split — a fairness audit asks "does the trained model discriminate on data it has seen," a different question from "does it generalize," and the larger sample gives materially better statistical power for the stratified breakdown.

## The finding — and it is not the reassuring one

| Tier | Gap (raw, before) | Gap (controlling for crime type) | Gap (controlling for prior record) |
|---|---|---|---|
| **Fused (InLegalBERT)** | 0.0607 | **0.0871** | 0.0780 |
| XGBoost + TF-IDF | 0.0977 | **0.1248** | 0.1089 |

**The gap gets larger after controlling for legitimate factors, not smaller, for both tiers.** This is the opposite of what a "the raw gap is mostly explained by legitimate confounders" story would show. A plausible reading: the raw/marginal gap may be partly *masked* by gender's uneven distribution across crime types — if the crime types where women are disproportionately represented (e.g. Dowry Harassment: 33 of 122 female cases, the largest single category) happen to have systematically different base grant rates than crime types where men are disproportionately represented, comparing genders *within* the same crime type removes that masking and reveals a larger direct gap than the marginal number suggested. This is a genuine finding, not a null result, and it is the one that should be highlighted, not the smaller number.

**Read the per-stratum numbers with real caution, not as a uniform average.** `bail_fairness.json`'s crime-type breakdown ranges from a gap of 0.014 (Cyber Crime, fused tier, 108 male / 8 female) up to 0.28-0.35 (Sexual Offense, both tiers, 117 male / **only 3 female**). Sexual Offense and Theft or Robbery both cleared the minimum-sample threshold (3) but only just — their large individual gaps carry real weight in the weighted average while resting on a very small female sample. The weighted-average `gap_after` numbers above are the best available single summary, not a claim that every contributing stratum is equally reliable.

## Performance parity (a second, different lens)

| Tier | F1 — Male | F1 — Female |
|---|---|---|
| Fused | 0.9633 | 0.9643 |
| XGBoost + TF-IDF | 0.9658 | 0.9529 |

Both tiers perform comparably well on both genders by F1 — this is a *different* fairness question (does the model predict correctly for each group) from demographic parity (does the model predict the same outcome rate for each group), and the two can and do point in different directions here: performance parity looks fine, demographic parity does not.

## What this does not establish

This audit measures association, not cause. A demographic parity gap that survives controlling for crime type and prior record is consistent with the model having learned a gender-correlated pattern through some other proxy (court, region-adjacent signal in `facts` text, case narrative style) — it is not proof of a specific mechanism, and this audit was not designed to identify one. It also does not establish that the *source judgments themselves* are biased versus the *model* having learned and possibly amplified an existing pattern in a small, imbalanced corpus (122 female-coded records total) — both are plausible, and disentangling them would need a substantially larger, more balanced dataset than this one.

## Limitations

1. 122 female-coded records total is a small sample for any subgroup analysis; several individual crime-type strata rest on single-digit female counts (see above).
2. Crime-type-as-severity-proxy is a stated substitution, not a validated severity score.
3. The joint (crime type × prior record) control was not attempted — checked and found too sparse to be meaningful, not merely skipped for convenience.
4. This audit does not test other potentially protected or sensitive characteristics (region, court, or `bias_flag`-adjacent signals) — gender was the one deliberately withheld from training specifically to make this audit possible; a similar design choice would be needed before other attributes could be audited this way.
