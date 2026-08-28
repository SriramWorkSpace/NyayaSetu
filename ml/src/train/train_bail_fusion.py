"""
Bail prediction, third tier: InLegalBERT-fused (ARCHITECTURE.md section 7's
full progression: LogReg -> XGBoost (structured + TF-IDF) -> InLegalBERT
(fused)). Phase 6 already produced the first two tiers; this adds the third
on top of the exact same structured features and train/test split, for a
clean apples-to-apples comparison - `build_structured_features` and
`load_and_clean` are imported directly from train_bail.py, not reimplemented.

"Fused" here means frozen InLegalBERT embeddings concatenated with the same
structured features, feeding an XGBoost head - not full end-to-end
fine-tuning of the transformer jointly with the tabular features. That
would need a custom PyTorch training loop and materially more compute; the
QA module (train_qa.py) already does genuine end-to-end fine-tuning to prove
the pipeline can, when the task actually requires it (span prediction
structurally needs a trained head - there is no "frozen embeddings" version
of that task). For bail, frozen-embedding fusion is a legitimate, widely
used technique on its own merits, and was benchmarked as CPU-feasible before
being chosen (InLegalBERT forward-only throughput: ~428ms/doc, so 958+240
documents embed in under 10 minutes - full fine-tuning would cost
materially more for a benefit that is not established up front).

The ModuleMetrics schema has two slots (baseline, final) but ARCHITECTURE.md
section 4.7 explicitly describes a THREE-bar comparison for bail
(LogReg -> XGBoost -> InLegalBERT). No schema change was made for this:
`MetricPoint.metric_name` is a free-form string, so the intermediate
XGBoost+TF-IDF tier's numbers are carried as extra, clearly-named entries
inside the `baseline` array rather than requiring a third top-level slot.
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
from sklearn.calibration import calibration_curve
from sklearn.metrics import average_precision_score, f1_score
from sklearn.model_selection import train_test_split
from transformers import AutoModel, AutoTokenizer
from xgboost import XGBClassifier

sys.path.insert(0, str(Path(__file__).resolve().parent))
from train_bail import ARTIFACTS_DIR, DATA_PATH, REPORTS_DIR, RANDOM_STATE, build_structured_features, load_and_clean, normalize_legal_issues  # noqa: E402

BACKBONE = "law-ai/InLegalBERT"


def embed_inlegalbert(texts: list[str], tokenizer, model, batch_size: int = 8) -> np.ndarray:
    embeddings = []
    model.eval()
    with torch.no_grad():
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            enc = tokenizer(batch, padding=True, truncation=True, max_length=384, return_tensors="pt")
            out = model(**enc)
            mask = enc["attention_mask"].unsqueeze(-1).float()
            pooled = (out.last_hidden_state * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
            embeddings.append(pooled.numpy())
            print(f"    embedded {min(i + batch_size, len(texts))}/{len(texts)}")
    return np.vstack(embeddings)


def main() -> None:
    df = load_and_clean()
    train_df, test_df = train_test_split(df, test_size=0.2, random_state=RANDOM_STATE, stratify=df["label"])
    print(f"Train: {len(train_df)}  Test: {len(test_df)}  (identical split to Phase 6's train_bail.py)")

    X_struct_train, cols = build_structured_features(train_df)
    X_struct_test, _ = build_structured_features(test_df, ref_columns=cols)
    y_train, y_test = train_df["label"].to_numpy(), test_df["label"].to_numpy()

    print(f"Loading {BACKBONE}...")
    tokenizer = AutoTokenizer.from_pretrained(BACKBONE)
    model = AutoModel.from_pretrained(BACKBONE)

    def doc_text(d):
        issues = d["legal_issues"].apply(lambda x: " ".join(normalize_legal_issues(x)))
        return (d["facts"].fillna("") + " " + issues).tolist()

    print("Embedding train set...")
    train_embeddings = embed_inlegalbert(doc_text(train_df), tokenizer, model)
    print("Embedding test set...")
    test_embeddings = embed_inlegalbert(doc_text(test_df), tokenizer, model)

    X_train = hstack([X_struct_train, train_embeddings]).tocsr()
    X_test = hstack([X_struct_test, test_embeddings]).tocsr()

    fused = XGBClassifier(
        n_estimators=300, max_depth=4, learning_rate=0.05,
        subsample=0.8, colsample_bytree=0.8, eval_metric="logloss", random_state=RANDOM_STATE,
    )
    fused.fit(X_train, y_train)

    proba = fused.predict_proba(X_test)[:, 1]
    pred = (proba >= 0.5).astype(int)
    fused_metrics = {
        "f1": round(float(f1_score(y_test, pred)), 4),
        "pr_auc": round(float(average_precision_score(y_test, proba)), 4),
    }
    print(f"Fused (InLegalBERT + structured -> XGBoost): {fused_metrics}")

    frac_pos, mean_pred = calibration_curve(y_test, proba, n_bins=5, strategy="quantile")
    calibration_points = [{"predicted": round(float(p), 3), "observed": round(float(o), 3)} for p, o in zip(mean_pred, frac_pos)]

    joblib.dump(fused, ARTIFACTS_DIR / "final_inlegalbert_fused.joblib")
    # The encoder itself is never fine-tuned here (frozen embeddings only -
    # see this file's docstring), so saving a local copy of law-ai/InLegalBERT
    # would just duplicate ~420MB of unmodified pretrained weights that
    # Phase 9's serving code can load fresh with AutoModel.from_pretrained,
    # exactly as this script does above. Not persisted.
    print(f"Artifacts written to {ARTIFACTS_DIR}")

    # Merge into the existing bail.json rather than overwrite it blind - keep
    # Phase 6's LogReg baseline and XGBoost+TF-IDF numbers, add this tier.
    existing = json.loads((REPORTS_DIR / "bail.json").read_text(encoding="utf-8"))
    xgboost_tfidf_points = [p for p in existing["final"]]  # Phase 6's final tier, now the middle tier
    baseline_points = existing["baseline"] + [
        {"metric_name": "f1_xgboost_tfidf", "value": xgboost_tfidf_points[0]["value"]},
        {"metric_name": "pr_auc_xgboost_tfidf", "value": xgboost_tfidf_points[1]["value"]},
    ]
    report = {
        "baseline": baseline_points,
        "final": [{"metric_name": k, "value": v} for k, v in fused_metrics.items()],
        "calibration_points": calibration_points,
        "fairness": None,  # Phase 8
        "dataset_size": existing["dataset_size"],
        "last_trained": datetime.now(timezone.utc).isoformat(),
    }
    (REPORTS_DIR / "bail.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"bail.json updated with the InLegalBERT-fused tier -> {REPORTS_DIR / 'bail.json'}")


if __name__ == "__main__":
    main()
