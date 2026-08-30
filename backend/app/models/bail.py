"""
Bail prediction singleton (CLAUDE.md section 3: models load once at startup).

--- Which tier is served, and why ---

Three tiers exist (ml/reports/MODEL_CARD_bail.md): LogReg, XGBoost+TF-IDF,
and InLegalBERT-fused. decisions.md D-027 found the fused tier is not an
unambiguous win - it improves F1 marginally but regresses PR-AUC and
calibration against XGBoost+TF-IDF. XGBoost+TF-IDF is served here (decisions
D-029): better PR-AUC and calibration, and it avoids loading a second,
~450MB InLegalBERT encoder purely for frozen embeddings when QA already
loads its own fine-tuned InLegalBERT checkpoint - keeping warm-up under the
quality floor's 10s budget matters more than a marginal, mixed-direction F1
gain (ARCHITECTURE.md section 11).

--- The feature-mapping gap, and how it is handled ---

The trained model uses seven fields the live API request does not collect:
`bail_type`, `court`, `bail_cancellation_case`, `landmark_case`,
`parity_argument_used` (structured), and `legal_issues` (text) - a real,
disclosed gap first found in ml/reports/bail_audit.md. At serving time these
are filled with the CORPUS'S OWN majority-class values (verified against the
real training data, not guessed):

  bail_type              "Regular"  (906/1200, 75.5%)
  court                  "Other"    (bucketed catch-all; no single court is
                                      close to a majority - 78 unique values)
  bail_cancellation_case False      (1084/1200, 90.3%)
  landmark_case          False      (1053/1200, 87.75%)
  parity_argument_used   False      (859/1200, 71.6%)
  legal_issues           ""         (never collected at all - the text
                                      feature is always missing this
                                      component in production, not just when
                                      a user skips narrative)

This measurably degrades predictions relative to the reported Phase 6/7
metrics, which used the real values for these fields. `narrative` maps to
`facts` - the one text field the UI actually collects. When narrative is
empty or short (under 15 words, well below the training corpus's 59-word
average), confidence_band is forced to "low" regardless of the raw
probability: the model is then operating on structured features plus an
empty text field, closer to the structured-only ablation (F1 0.7718) than
to the reported 0.8207 - the UI should not imply more confidence than that.
"""
from __future__ import annotations

import json
import logging
import time

import joblib
import numpy as np
import pandas as pd
import shap
from scipy.sparse import hstack, csr_matrix

from app.base_dir import backend_dir, repo_root

logger = logging.getLogger("nyayasetu.models.bail")

ARTIFACTS_DIR = backend_dir() / "artifacts" / "bail"
REPORTS_DIR = repo_root() / "ml" / "reports"

# Corpus majority-class defaults for fields the API never collects - see
# module docstring. Verified against ml/data/bail/raw.json, not guessed.
DEFAULT_BAIL_TYPE = "Regular"
DEFAULT_COURT = "Other"
DEFAULT_BAIL_CANCELLATION = False
DEFAULT_LANDMARK = False
DEFAULT_PARITY_ARGUMENT = False
MIN_NARRATIVE_WORDS_FOR_FULL_CONFIDENCE = 15

_PRIOR_RECORD_MAP = {"yes": "Yes", "no": "No", "unknown": "Unknown"}

_state: dict = {}


def load() -> None:
    t0 = time.perf_counter()
    _state["xgboost"] = joblib.load(ARTIFACTS_DIR / "final_xgboost.joblib")
    _state["logreg"] = joblib.load(ARTIFACTS_DIR / "baseline_logreg.joblib")
    _state["tfidf"] = joblib.load(ARTIFACTS_DIR / "tfidf_vectorizer.joblib")
    _state["onehot"] = joblib.load(ARTIFACTS_DIR / "onehot_encoder.joblib")
    _state["mlb"] = joblib.load(ARTIFACTS_DIR / "section_binarizer.joblib")
    cols = json.loads((ARTIFACTS_DIR / "feature_columns.json").read_text(encoding="utf-8"))
    _state["top_courts"] = cols["top_courts"]
    _state["top_sections"] = cols["top_sections"]
    _state["explainer"] = shap.TreeExplainer(_state["xgboost"])

    report = json.loads((REPORTS_DIR / "bail.json").read_text(encoding="utf-8"))
    _state["model_version"] = f"xgboost-tfidf-{(report.get('last_trained') or 'unknown')[:10]}"

    # Full feature name list, in the exact column order build_features()
    # produces, for mapping SHAP values back to human-readable factor names.
    onehot_names = list(_state["onehot"].get_feature_names_out(["crime_type", "bail_type", "prior_cases", "court"]))
    bin_names = ["bail_cancellation_case", "landmark_case", "parity_argument_used"]
    section_names = [f"ipc_section_{s}" for s in _state["mlb"].classes_]
    tfidf_names = [f"text_{t}" for t in _state["tfidf"].get_feature_names_out()]
    _state["feature_names"] = onehot_names + bin_names + section_names + tfidf_names

    logger.info("bail models loaded in %.2fs (serving %s)", time.perf_counter() - t0, _state["model_version"])


def _build_features(crime_category: str, ipc_sections: list[str], prior_record: str, narrative: str | None):
    """
    Mirrors ml/src/train/train_bail.py's build_structured_features and
    build_text_features exactly, applied to one request instead of a
    DataFrame - see the module docstring for the field-mapping and default
    values used for what the API does not collect.
    """
    # DEFAULT_COURT ("Other") is not one of top_courts by construction, which
    # matches how build_structured_features buckets any non-top-15 court -
    # no extra bucketing branch needed here since the request never supplies
    # a real court to bucket.
    cat_df = pd.DataFrame(
        {
            "crime_type": [crime_category],
            "bail_type": [DEFAULT_BAIL_TYPE],
            "prior_cases": [_PRIOR_RECORD_MAP[prior_record]],
            "court": [DEFAULT_COURT],
        }
    )
    cat_matrix = _state["onehot"].transform(cat_df)

    bin_matrix = csr_matrix(np.array([[DEFAULT_BAIL_CANCELLATION, DEFAULT_LANDMARK, DEFAULT_PARITY_ARGUMENT]], dtype=int))

    sections_bucketed = [[s if s in _state["top_sections"] else "OTHER_SECTION" for s in ipc_sections]]
    section_matrix = csr_matrix(_state["mlb"].transform(sections_bucketed))

    structured = hstack([cat_matrix, bin_matrix, section_matrix]).tocsr()

    # legal_issues is never collected by the API - always empty (see docstring).
    facts = narrative or ""
    text_matrix = _state["tfidf"].transform([facts])

    return hstack([structured, text_matrix]).tocsr(), facts


def _confidence_band(probability: float, narrative: str | None) -> str:
    narrative_words = len((narrative or "").split())
    if narrative_words < MIN_NARRATIVE_WORDS_FOR_FULL_CONFIDENCE:
        return "low"
    distance = abs(probability - 0.5)
    if distance >= 0.35:
        return "high"
    if distance >= 0.15:
        return "medium"
    return "low"


def predict(crime_category: str, ipc_sections: list[str], prior_record: str, narrative: str | None) -> dict:
    X, facts = _build_features(crime_category, ipc_sections, prior_record, narrative)
    proba = float(_state["xgboost"].predict_proba(X)[0, 1])
    outcome = "granted" if proba >= 0.5 else "denied"

    # shap.TreeExplainer(xgb).shap_values(X) empirically returns a plain 2D
    # array (n_samples, n_features) for this binary XGBClassifier - not a
    # per-class list, which some other shap/model combinations return.
    # Verified directly (not assumed): sigmoid(shap_values.sum() +
    # expected_value) reproduces predict_proba's positive-class probability
    # exactly, and a known feature (prior_cases=Yes) gets a negative value,
    # correctly pushing toward "denied" - confirming the sign convention
    # below (positive SHAP -> for_grant) is not inverted.
    row = _state["explainer"].shap_values(X)[0]
    top_idx = np.argsort(-np.abs(row))[:4]
    factors = [
        {
            "name": _readable_factor_name(_state["feature_names"][i]),
            "direction": "for_grant" if row[i] > 0 else "for_denial",
            "weight": round(float(row[i]), 4),
        }
        for i in top_idx
        if abs(row[i]) > 1e-6
    ]

    return {
        "outcome": outcome,
        "probability": round(proba, 4),
        "confidence_band": _confidence_band(proba, narrative),
        "factors": factors,
        "model_version": _state["model_version"],
    }


def predict_baseline(crime_category: str, ipc_sections: list[str], prior_record: str, narrative: str | None) -> dict:
    X, _ = _build_features(crime_category, ipc_sections, prior_record, narrative)
    proba = float(_state["logreg"].predict_proba(X)[0, 1])
    return {
        "outcome": "granted" if proba >= 0.5 else "denied",
        "probability": round(proba, 4),
        "model_name": "logistic_regression",
    }


def _readable_factor_name(raw: str) -> str:
    """crime_type_Murder -> 'Crime type: Murder'; text_bail -> 'Mentions "bail"'."""
    if raw.startswith("text_"):
        return f'Mentions "{raw[5:]}"'
    if raw.startswith("ipc_section_"):
        return f"IPC section {raw[len('ipc_section_'):]}"
    for prefix, label in [("crime_type_", "Crime type"), ("bail_type_", "Bail type"), ("prior_cases_", "Prior record"), ("court_", "Court")]:
        if raw.startswith(prefix):
            return f"{label}: {raw[len(prefix):]}"
    return raw.replace("_", " ").capitalize()
