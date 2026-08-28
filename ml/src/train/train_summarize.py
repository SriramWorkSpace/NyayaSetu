"""
Summarization: TextRank -> supervised sentence classifier (ARCHITECTURE.md
section 7).

Source text is `facts` + `judgment_reason` concatenated, sentence-split with
spaCy's rule-based sentencizer (no trained pipeline needed for splitting).
Unlike the bail predictor, using `judgment_reason` here is NOT leakage - a
summary of a judgment is SUPPOSED to say what was decided and why; that is
the entire point of a judgment summary, not something to hide from it.

The real dataset's `summary` field is ABSTRACTIVE (paraphrased prose, not
verbatim source sentences - confirmed by inspection before writing this
script), but the product needs an EXTRACTIVE summarizer with sentence
provenance (ARCHITECTURE.md section 2.2 #17). There is no direct
sentence-selection ground truth, so training labels are built via the
standard "oracle extractive" technique: greedily pick the source sentences
whose combination best reconstructs the reference summary by ROUGE-1
overlap. This is a well-established methodology (used to build extractive
training data from abstractive references in the summarization literature),
not something to hide - but it is a proxy label, not a hand-verified one,
and is disclosed as such in the model card.

Source documents here are the dataset's condensed fact/reasoning fields
(~100 words combined, a handful of sentences), not full multi-page
judgments - a real scoping limitation, disclosed rather than implied away.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import spacy
from rouge_score import rouge_scorer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics.pairwise import cosine_similarity
import networkx as nx

ML_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ML_ROOT.parent
DATA_PATH = ML_ROOT / "data" / "bail" / "raw.json"
ARTIFACTS_DIR = REPO_ROOT / "backend" / "artifacts" / "summarization"
REPORTS_DIR = ML_ROOT / "reports"
RANDOM_STATE = 42
MAX_ORACLE_SENTENCES = 3

_sentencizer = spacy.blank("en")
_sentencizer.add_pipe("sentencizer")
_scorer = rouge_scorer.RougeScorer(["rouge1", "rouge2", "rougeL"], use_stemmer=True)


def split_sentences(text: str) -> list[str]:
    doc = _sentencizer(text)
    return [s.text.strip() for s in doc.sents if s.text.strip()]


def oracle_labels(sentences: list[str], reference: str) -> list[int]:
    """Greedy ROUGE-1-maximizing sentence selection - the standard technique
    for deriving extractive labels from an abstractive reference summary."""
    if not sentences:
        return []
    selected: list[int] = []
    best_score = 0.0
    remaining = set(range(len(sentences)))
    for _ in range(min(MAX_ORACLE_SENTENCES, len(sentences))):
        best_idx, best_gain = None, 0.0
        for i in remaining:
            candidate = " ".join(sentences[j] for j in sorted(selected + [i]))
            score = _scorer.score(reference, candidate)["rouge1"].fmeasure
            if score > best_score + 1e-6 and score - best_score > best_gain:
                best_gain, best_idx = score - best_score, i
        if best_idx is None:
            break
        selected.append(best_idx)
        remaining.discard(best_idx)
        candidate = " ".join(sentences[j] for j in sorted(selected))
        best_score = _scorer.score(reference, candidate)["rouge1"].fmeasure
    labels = [0] * len(sentences)
    for i in selected:
        labels[i] = 1
    return labels


def textrank_select(sentences: list[str], k: int) -> list[int]:
    """Unsupervised baseline: TF-IDF sentence-similarity graph + PageRank."""
    if len(sentences) <= k:
        return list(range(len(sentences)))
    vec = TfidfVectorizer().fit_transform(sentences)
    sim = cosine_similarity(vec)
    np.fill_diagonal(sim, 0)
    graph = nx.from_numpy_array(sim)
    scores = nx.pagerank(graph, max_iter=200)
    ranked = sorted(scores, key=lambda i: scores[i], reverse=True)[:k]
    return sorted(ranked)


def sentence_features(sentences: list[str], tfidf_matrix, centroid) -> np.ndarray:
    n = len(sentences)
    sims = cosine_similarity(tfidf_matrix, centroid).flatten()
    positions = np.array([i / max(1, n - 1) for i in range(n)])
    lengths = np.array([len(s.split()) for s in sentences])
    lengths_norm = lengths / max(1, lengths.max())
    return np.column_stack([sims, positions, lengths_norm])


def rouge_of_selection(sentences: list[str], indices: list[int], reference: str) -> dict:
    if not indices:
        return {"rouge1": 0.0, "rouge2": 0.0, "rougeL": 0.0}
    summary = " ".join(sentences[i] for i in sorted(indices))
    scores = _scorer.score(reference, summary)
    return {k: v.fmeasure for k, v in scores.items()}


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    records = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    docs = []
    for r in records:
        text = (r.get("facts", "") + " " + r.get("judgment_reason", "")).strip()
        sentences = split_sentences(text)
        if not sentences:
            continue
        labels = oracle_labels(sentences, r["summary"])
        docs.append({"sentences": sentences, "labels": labels, "reference": r["summary"]})

    random.Random(RANDOM_STATE).shuffle(docs)
    n_test = int(len(docs) * 0.2)
    train_docs, test_docs = docs[n_test:], docs[:n_test]
    print(f"Train: {len(train_docs)}  Test: {len(test_docs)}")

    # ---- Build sentence-level feature matrix for the classifier -----------
    all_train_sentences = [s for d in train_docs for s in d["sentences"]]
    vectorizer = TfidfVectorizer(max_features=2000, ngram_range=(1, 2), min_df=1)
    vectorizer.fit(all_train_sentences)

    X_train_list, y_train_list = [], []
    for d in train_docs:
        tfidf = vectorizer.transform(d["sentences"])
        centroid = tfidf.mean(axis=0)
        centroid = np.asarray(centroid)
        feats = sentence_features(d["sentences"], tfidf, centroid)
        X_train_list.append(feats)
        y_train_list.extend(d["labels"])
    X_train = np.vstack(X_train_list)
    y_train = np.array(y_train_list)

    classifier = LogisticRegression(class_weight="balanced", max_iter=1000, random_state=RANDOM_STATE)
    classifier.fit(X_train, y_train)

    # ---- Evaluate: baseline (TextRank) vs final (classifier) --------------
    baseline_scores = {"rouge1": [], "rouge2": [], "rougeL": []}
    final_scores = {"rouge1": [], "rouge2": [], "rougeL": []}

    for d in test_docs:
        sentences, reference = d["sentences"], d["reference"]
        k = max(1, sum(d["labels"]))  # use the oracle's own count as the target length

        baseline_idx = textrank_select(sentences, k)
        b = rouge_of_selection(sentences, baseline_idx, reference)
        for m in baseline_scores:
            baseline_scores[m].append(b[m])

        tfidf = vectorizer.transform(sentences)
        centroid = np.asarray(tfidf.mean(axis=0))
        feats = sentence_features(sentences, tfidf, centroid)
        proba = classifier.predict_proba(feats)[:, 1]
        final_idx = list(np.argsort(-proba)[:k])
        f = rouge_of_selection(sentences, final_idx, reference)
        for m in final_scores:
            final_scores[m].append(f[m])

    baseline_avg = {m: round(float(np.mean(v)), 4) for m, v in baseline_scores.items()}
    final_avg = {m: round(float(np.mean(v)), 4) for m, v in final_scores.items()}
    print(f"Baseline (TextRank)  {baseline_avg}")
    print(f"Final (classifier)   {final_avg}")

    import joblib

    joblib.dump(classifier, ARTIFACTS_DIR / "sentence_classifier.joblib")
    joblib.dump(vectorizer, ARTIFACTS_DIR / "tfidf_vectorizer.joblib")
    print(f"Artifacts written to {ARTIFACTS_DIR}")

    report = {
        "baseline": [{"metric_name": k, "value": v} for k, v in baseline_avg.items()],
        "final": [{"metric_name": k, "value": v} for k, v in final_avg.items()],
        "calibration_points": None,
        "fairness": None,
        "dataset_size": len(docs),
        "last_trained": datetime.now(timezone.utc).isoformat(),
    }
    (REPORTS_DIR / "summarization.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Report written to {REPORTS_DIR / 'summarization.json'}")


if __name__ == "__main__":
    main()
