"""
Bail baselines: LogisticRegression -> XGBoost (ARCHITECTURE.md section 7).

Run: ml/.venv/Scripts/python.exe src/train/train_bail.py   (from ml/)

Writes:
  backend/artifacts/bail/  - model.joblib, baseline.joblib, vectorizer.joblib,
                              feature_columns.json (everything Phase 9 needs
                              to actually serve this model)
  ml/reports/bail.json     - ModuleMetrics-shaped, real numbers
  ml/reports/MODEL_CARD_bail.md

--- Leakage decisions, made explicit rather than discovered later ---

Excluded from every feature set, on purpose:
  - judgment_reason, summary, bail_outcome_label_detailed: these describe
    the court's reasoning and conclusion. Using them to predict the
    conclusion is not prediction, it is reading the answer off the page.
  - accused_gender: excluded from training features so the Phase 8 fairness
    audit can test whether predictions correlate with gender WITHOUT the
    model ever having seen it directly. It stays in the raw data for that
    audit; it never reaches the vectorizer here.
  - bias_flag: an annotator's fairness flag, not a legitimate predictive
    signal - reserved for Phase 8, never a training feature.

NOT excluded, but disclosed as a real limitation:
  - `facts` sometimes narrates PRIOR bail proceedings (legitimate signal -
    "previously denied bail" is real case history) in the same sentence
    structure as language that reveals THIS judgment's own outcome
    ("the High Court reversed this"). A regex pass to separate the two
    reliably was judged more likely to give false confidence than to fix
    the problem, so instead: an ablation (structured-features-only, no
    facts/legal_issues text) is trained and reported in the model card
    alongside the full-feature numbers, so the gap the text field
    contributes is visible rather than hidden inside one flattering score.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from scipy.sparse import hstack, csr_matrix
from sklearn.calibration import calibration_curve
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, f1_score
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import OneHotEncoder, MultiLabelBinarizer
from xgboost import XGBClassifier

ML_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ML_ROOT.parent
DATA_PATH = ML_ROOT / "data" / "bail" / "raw.json"
ARTIFACTS_DIR = REPO_ROOT / "backend" / "artifacts" / "bail"
REPORTS_DIR = ML_ROOT / "reports"

TOP_N_COURTS = 15
TOP_N_SECTIONS = 30
RANDOM_STATE = 42


def load_and_clean() -> pd.DataFrame:
    records = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    df = pd.DataFrame(records)

    # Dedupe on exact-duplicate case facts BEFORE splitting - the leakage
    # failure mode CLAUDE.md section 7 names specifically. Two pairs exist
    # in this corpus (0390/0391, 0544/0551); keep the first of each.
    before = len(df)
    df = df.drop_duplicates(subset="facts", keep="first").reset_index(drop=True)
    dropped = before - len(df)
    print(f"Dropped {dropped} exact-duplicate-facts rows ({before} -> {len(df)})")

    # Only two outcome values exist in this corpus; anything else would be
    # a genuine data-quality problem worth stopping for, not silently
    # coercing.
    assert set(df["bail_outcome"].unique()) <= {"Granted", "Rejected"}
    df["label"] = (df["bail_outcome"] == "Granted").astype(int)

    return df


def build_structured_features(df: pd.DataFrame, ref_columns: dict | None = None):
    """
    One-hot / multi-hot structured features. `ref_columns` is passed on the
    test split to align columns to what the train split produced - a
    category seen only in test must not silently create a new column the
    model was never trained on.
    """
    top_courts = ref_columns["top_courts"] if ref_columns else df["court"].value_counts().head(TOP_N_COURTS).index.tolist()
    court_bucketed = df["court"].where(df["court"].isin(top_courts), "Other")

    cat_df = pd.DataFrame(
        {
            "crime_type": df["crime_type"].fillna("Unknown"),
            "bail_type": df["bail_type"].fillna("Unknown"),
            "prior_cases": df["prior_cases"].fillna("Unknown"),
            "court": court_bucketed,
        }
    )

    if ref_columns is None:
        encoder = OneHotEncoder(handle_unknown="ignore", sparse_output=True)
        cat_matrix = encoder.fit_transform(cat_df)
    else:
        encoder = ref_columns["encoder"]
        cat_matrix = encoder.transform(cat_df)

    bin_matrix = df[["bail_cancellation_case", "landmark_case", "parity_argument_used"]].astype(int).to_numpy()
    bin_matrix = csr_matrix(bin_matrix)

    top_sections = (
        ref_columns["top_sections"]
        if ref_columns
        else pd.Series([s for row in df["ipc_sections"].dropna() for s in row]).value_counts().head(TOP_N_SECTIONS).index.tolist()
    )
    sections_bucketed = df["ipc_sections"].apply(
        lambda row: [s if s in top_sections else "OTHER_SECTION" for s in row] if isinstance(row, list) else []
    )
    if ref_columns is None:
        mlb = MultiLabelBinarizer()
        section_matrix = csr_matrix(mlb.fit_transform(sections_bucketed))
    else:
        mlb = ref_columns["mlb"]
        section_matrix = csr_matrix(mlb.transform(sections_bucketed))

    structured = hstack([cat_matrix, bin_matrix, section_matrix]).tocsr()

    columns = {
        "top_courts": top_courts,
        "top_sections": top_sections,
        "encoder": encoder,
        "mlb": mlb,
    }
    return structured, columns


def build_text_features(df: pd.DataFrame, vectorizer: TfidfVectorizer | None = None):
    text = (df["facts"].fillna("") + " " + df["legal_issues"].apply(lambda x: " ".join(x) if isinstance(x, list) else "")).tolist()
    if vectorizer is None:
        vectorizer = TfidfVectorizer(max_features=3000, ngram_range=(1, 2), min_df=2)
        matrix = vectorizer.fit_transform(text)
    else:
        matrix = vectorizer.transform(text)
    return matrix, vectorizer


def evaluate(model, X_test, y_test) -> dict:
    proba = model.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    return {
        "f1": round(float(f1_score(y_test, pred)), 4),
        "pr_auc": round(float(average_precision_score(y_test, proba)), 4),
        "proba": proba,
    }


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    df = load_and_clean()

    train_df, test_df = train_test_split(
        df, test_size=0.2, random_state=RANDOM_STATE, stratify=df["label"]
    )
    print(f"Train: {len(train_df)}  Test: {len(test_df)}")

    X_struct_train, cols = build_structured_features(train_df)
    X_struct_test, _ = build_structured_features(test_df, ref_columns=cols)

    X_text_train, vectorizer = build_text_features(train_df)
    X_text_test, _ = build_text_features(test_df, vectorizer=vectorizer)

    X_train = hstack([X_struct_train, X_text_train]).tocsr()
    X_test = hstack([X_struct_test, X_text_test]).tocsr()
    y_train, y_test = train_df["label"].to_numpy(), test_df["label"].to_numpy()

    # ---- Baseline: LogisticRegression ------------------------------------
    baseline = LogisticRegression(max_iter=2000, class_weight="balanced", random_state=RANDOM_STATE)
    baseline.fit(X_train, y_train)
    baseline_metrics = evaluate(baseline, X_test, y_test)
    print(f"Baseline (LogReg)   F1={baseline_metrics['f1']}  PR-AUC={baseline_metrics['pr_auc']}")

    # ---- Final: XGBoost ----------------------------------------------------
    final = XGBClassifier(
        n_estimators=300,
        max_depth=4,
        learning_rate=0.05,
        subsample=0.8,
        colsample_bytree=0.8,
        eval_metric="logloss",
        random_state=RANDOM_STATE,
    )
    final.fit(X_train, y_train)
    final_metrics = evaluate(final, X_test, y_test)
    print(f"Final (XGBoost)     F1={final_metrics['f1']}  PR-AUC={final_metrics['pr_auc']}")

    # ---- Ablation: structured-only XGBoost (disclosed in model card) -----
    ablation = XGBClassifier(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, eval_metric="logloss", random_state=RANDOM_STATE,
    )
    ablation.fit(X_struct_train, y_train)
    ablation_metrics = evaluate(ablation, X_struct_test, y_test)
    print(f"Ablation (struct-only) F1={ablation_metrics['f1']}  PR-AUC={ablation_metrics['pr_auc']}")

    # ---- Calibration (final model, held-out test) -------------------------
    frac_pos, mean_pred = calibration_curve(y_test, final_metrics["proba"], n_bins=5, strategy="quantile")
    calibration_points = [
        {"predicted": round(float(p), 3), "observed": round(float(o), 3)}
        for p, o in zip(mean_pred, frac_pos)
    ]

    # ---- Persist artifacts (what Phase 9 will load) -----------------------
    joblib.dump(baseline, ARTIFACTS_DIR / "baseline_logreg.joblib")
    joblib.dump(final, ARTIFACTS_DIR / "final_xgboost.joblib")
    joblib.dump(vectorizer, ARTIFACTS_DIR / "tfidf_vectorizer.joblib")
    joblib.dump(cols["encoder"], ARTIFACTS_DIR / "onehot_encoder.joblib")
    joblib.dump(cols["mlb"], ARTIFACTS_DIR / "section_binarizer.joblib")
    (ARTIFACTS_DIR / "feature_columns.json").write_text(
        json.dumps({"top_courts": cols["top_courts"], "top_sections": cols["top_sections"]}, indent=2),
        encoding="utf-8",
    )
    print(f"Artifacts written to {ARTIFACTS_DIR}")

    # ---- ml/reports/bail.json (ModuleMetrics shape, backend/app/schemas/metrics.py) ----
    report = {
        "baseline": [
            {"metric_name": "f1", "value": baseline_metrics["f1"]},
            {"metric_name": "pr_auc", "value": baseline_metrics["pr_auc"]},
        ],
        "final": [
            {"metric_name": "f1", "value": final_metrics["f1"]},
            {"metric_name": "pr_auc", "value": final_metrics["pr_auc"]},
        ],
        "calibration_points": calibration_points,
        "fairness": None,  # Phase 8
        "dataset_size": len(df),
        "last_trained": datetime.now(timezone.utc).isoformat(),
    }
    (REPORTS_DIR / "bail.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Report written to {REPORTS_DIR / 'bail.json'}")

    # Stash the ablation number for the model card writer to pick up.
    (REPORTS_DIR / "_bail_ablation.json").write_text(
        json.dumps({"f1": ablation_metrics["f1"], "pr_auc": ablation_metrics["pr_auc"]}), encoding="utf-8"
    )


if __name__ == "__main__":
    main()
