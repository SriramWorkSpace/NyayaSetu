"""
Bail model fairness audit (ARCHITECTURE.md section 7, its own phase per
section 9 - not folded into Phase 7's training work).

Protected attribute: accused_gender. This field was deliberately withheld
from every bail training feature set since Phase 6, specifically so this
audit could ask "do predictions still correlate with gender through
legitimate proxies (crime type, prior record, court), even though the model
never saw gender directly?" - a design choice made three phases ago,
exercised here for the first time.

--- Methodology, and why the full cross-product of controls wasn't used ---

ARCHITECTURE.md's phrasing is "controlling for crime severity, prior
record" - naturally read as controlling for both jointly. Checked before
committing to a method: crossing crime_type (12 categories) with prior_cases
(3 categories) gives 36 strata over 1,194 Male/Female records - and several
crime types have only 1-3 female-coded records TOTAL (Murder: 2, Attempt to
Murder: 1, Theft or Robbery: 3, Sexual Offense: 3), meaning most cells of
that cross-product would have zero or one female record. A "gap" computed
from one data point is not a measurement, it is noise dressed up as a
number.

Instead: crime_type and prior_cases are each controlled for SEPARATELY
(stratified demographic parity, weighted by stratum size, strata with fewer
than MIN_STRATUM_GENDER_COUNT records of either gender excluded). Both
numbers are reported. `gap_after` in bail.json takes the crime-type-
controlled number specifically, since "crime severity" is named first in
the architecture spec and crime_type is the most direct proxy available for
it (no separate severity-score field exists in the source data - crime_type
categories are used as-is, not re-ranked into a severity ordering, which
would have been its own unaudited assumption).

Unknown/Multiple gender records (6 of 1,200, ~0.5%) are excluded from the
whole audit - too few to support any claim in either direction.

Audited on the FULL cleaned corpus (1,194 records), not just the held-out
test split: a fairness audit asks "does the trained model discriminate on
data it has seen," which is a different question from "does it generalize,"
and the larger sample gives materially better statistical power for the
stratified breakdown. Stated plainly as a methodology choice, not hidden.
"""
from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import torch
from scipy.sparse import hstack
from sklearn.metrics import f1_score
from transformers import AutoModel, AutoTokenizer

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "train"))
from train_bail import ARTIFACTS_DIR, REPORTS_DIR, load_and_clean, normalize_legal_issues  # noqa: E402

MIN_STRATUM_GENDER_COUNT = 3
BACKBONE = "law-ai/InLegalBERT"


def demographic_parity_gap(pred: np.ndarray, gender: np.ndarray) -> float:
    male_rate = pred[gender == "Male"].mean() if (gender == "Male").any() else np.nan
    female_rate = pred[gender == "Female"].mean() if (gender == "Female").any() else np.nan
    return abs(float(male_rate) - float(female_rate))


def stratified_gap(pred: np.ndarray, gender: np.ndarray, strata: np.ndarray) -> tuple[float, list[dict]]:
    """Weighted-average within-stratum demographic parity gap. Strata with
    too few records of either gender are excluded, listed for transparency
    rather than silently dropped."""
    detail = []
    weighted_sum, weight_total = 0.0, 0
    for stratum in sorted(set(strata)):
        mask = strata == stratum
        n_male = int(((gender == "Male") & mask).sum())
        n_female = int(((gender == "Female") & mask).sum())
        if n_male < MIN_STRATUM_GENDER_COUNT or n_female < MIN_STRATUM_GENDER_COUNT:
            detail.append({"stratum": str(stratum), "n_male": n_male, "n_female": n_female, "included": False})
            continue
        gap = demographic_parity_gap(pred[mask], gender[mask])
        weight = n_male + n_female
        weighted_sum += gap * weight
        weight_total += weight
        detail.append({"stratum": str(stratum), "n_male": n_male, "n_female": n_female, "gap": round(gap, 4), "included": True})
    overall = weighted_sum / weight_total if weight_total else float("nan")
    return overall, detail


def load_fused_model_and_predict(df) -> np.ndarray:
    from train_bail import build_structured_features

    cols = {
        "top_courts": json.loads((ARTIFACTS_DIR / "feature_columns.json").read_text())["top_courts"],
        "top_sections": json.loads((ARTIFACTS_DIR / "feature_columns.json").read_text())["top_sections"],
        "encoder": joblib.load(ARTIFACTS_DIR / "onehot_encoder.joblib"),
        "mlb": joblib.load(ARTIFACTS_DIR / "section_binarizer.joblib"),
    }
    X_struct, _ = build_structured_features(df, ref_columns=cols)

    print(f"Loading {BACKBONE} to reconstruct the fused model's embedding input...")
    tokenizer = AutoTokenizer.from_pretrained(BACKBONE)
    model = AutoModel.from_pretrained(BACKBONE)
    model.eval()

    issues = df["legal_issues"].apply(lambda x: " ".join(normalize_legal_issues(x)))
    texts = (df["facts"].fillna("") + " " + issues).tolist()

    embeddings = []
    with torch.no_grad():
        for i in range(0, len(texts), 8):
            batch = texts[i : i + 8]
            enc = tokenizer(batch, padding=True, truncation=True, max_length=384, return_tensors="pt")
            out = model(**enc)
            mask = enc["attention_mask"].unsqueeze(-1).float()
            pooled = (out.last_hidden_state * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
            embeddings.append(pooled.numpy())
            if i % 160 == 0:
                print(f"    embedded {i}/{len(texts)}")
    X_text = np.vstack(embeddings)

    fused = joblib.load(ARTIFACTS_DIR / "final_inlegalbert_fused.joblib")
    X = hstack([X_struct, X_text]).tocsr()
    return fused.predict(X)


def load_xgboost_tfidf_and_predict(df) -> np.ndarray:
    from train_bail import build_structured_features, build_text_features

    cols = {
        "top_courts": json.loads((ARTIFACTS_DIR / "feature_columns.json").read_text())["top_courts"],
        "top_sections": json.loads((ARTIFACTS_DIR / "feature_columns.json").read_text())["top_sections"],
        "encoder": joblib.load(ARTIFACTS_DIR / "onehot_encoder.joblib"),
        "mlb": joblib.load(ARTIFACTS_DIR / "section_binarizer.joblib"),
    }
    X_struct, _ = build_structured_features(df, ref_columns=cols)
    vectorizer = joblib.load(ARTIFACTS_DIR / "tfidf_vectorizer.joblib")
    X_text, _ = build_text_features(df, vectorizer=vectorizer)
    xgb = joblib.load(ARTIFACTS_DIR / "final_xgboost.joblib")
    X = hstack([X_struct, X_text]).tocsr()
    return xgb.predict(X)


def main() -> None:
    df = load_and_clean()
    df = df[df["accused_gender"].isin(["Male", "Female"])].reset_index(drop=True)
    print(f"Audited population: {len(df)} records (Male/Female only, Unknown/Multiple excluded)")

    gender = df["accused_gender"].to_numpy()
    y_true = df["label"].to_numpy()

    results: dict[str, dict] = {}
    for name, predict_fn in [("fused", load_fused_model_and_predict), ("xgboost_tfidf", load_xgboost_tfidf_and_predict)]:
        print(f"\n=== {name} ===")
        pred = predict_fn(df)

        gap_before = demographic_parity_gap(pred, gender)
        gap_after_crime, crime_detail = stratified_gap(pred, gender, df["crime_type"].to_numpy())
        gap_after_prior, prior_detail = stratified_gap(pred, gender, df["prior_cases"].to_numpy())

        f1_male = f1_score(y_true[gender == "Male"], pred[gender == "Male"])
        f1_female = f1_score(y_true[gender == "Female"], pred[gender == "Female"])

        print(f"  gap_before (raw demographic parity): {gap_before:.4f}")
        print(f"  gap_after (controlling for crime_type): {gap_after_crime:.4f}")
        print(f"  gap_after (controlling for prior_cases): {gap_after_prior:.4f}")
        print(f"  F1 - Male: {f1_male:.4f}  Female: {f1_female:.4f}")

        results[name] = {
            "gap_before": round(gap_before, 4),
            "gap_after_crime_type": round(gap_after_crime, 4),
            "gap_after_prior_cases": round(gap_after_prior, 4),
            "f1_male": round(float(f1_male), 4),
            "f1_female": round(float(f1_female), 4),
            "crime_type_strata": crime_detail,
            "prior_cases_strata": prior_detail,
            "n_male": int((gender == "Male").sum()),
            "n_female": int((gender == "Female").sum()),
        }

    # ---- Write the standalone fairness report ------------------------------
    report_path = REPORTS_DIR / "bail_fairness.json"
    report_path.write_text(json.dumps(results, indent=2), encoding="utf-8")
    print(f"\nFull audit written to {report_path}")

    # ---- Update bail.json's fairness field (the "final"/fused tier) --------
    bail_json_path = REPORTS_DIR / "bail.json"
    bail_report = json.loads(bail_json_path.read_text(encoding="utf-8"))
    bail_report["fairness"] = {
        "metric": "demographic_parity_gap",
        "gap_before": results["fused"]["gap_before"],
        "gap_after": results["fused"]["gap_after_crime_type"],
    }
    bail_report["last_trained"] = datetime.now(timezone.utc).isoformat()
    bail_json_path.write_text(json.dumps(bail_report, indent=2), encoding="utf-8")
    print(f"bail.json's fairness field updated -> {bail_json_path}")


if __name__ == "__main__":
    main()
