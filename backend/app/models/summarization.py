"""
Summarization singleton. Mirrors ml/src/train/train_summarize.py's inference
path exactly: split into sentences (spaCy sentencizer, no trained pipeline
needed for splitting), TF-IDF + centroid-similarity + position + length
features per sentence, top-k by the trained classifier's predicted
probability. Same feature order as training - see sentence_features() below,
copied verbatim rather than approximated.
"""
from __future__ import annotations

import logging
import time
from pathlib import Path

import joblib
import numpy as np
import spacy
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger("nyayasetu.models.summarization")

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "summarization"

_state: dict = {}


def load() -> None:
    t0 = time.perf_counter()
    _state["classifier"] = joblib.load(ARTIFACTS_DIR / "sentence_classifier.joblib")
    _state["vectorizer"] = joblib.load(ARTIFACTS_DIR / "tfidf_vectorizer.joblib")
    nlp = spacy.blank("en")
    nlp.add_pipe("sentencizer")
    _state["sentencizer"] = nlp
    logger.info("Summarization model loaded in %.2fs", time.perf_counter() - t0)


def _split_sentences(text: str) -> list[str]:
    doc = _state["sentencizer"](text)
    return [s.text.strip() for s in doc.sents if s.text.strip()]


def _sentence_features(sentences: list[str], tfidf_matrix, centroid) -> np.ndarray:
    n = len(sentences)
    sims = cosine_similarity(tfidf_matrix, centroid).flatten()
    positions = np.array([i / max(1, n - 1) for i in range(n)])
    lengths = np.array([len(s.split()) for s in sentences])
    lengths_norm = lengths / max(1, lengths.max())
    return np.column_stack([sims, positions, lengths_norm])


def summarize(text: str, max_sentences: int) -> dict:
    sentences = _split_sentences(text)
    if not sentences:
        return {"summary_sentences": [], "source_indices": [], "compression_ratio": 0.0}

    tfidf = _state["vectorizer"].transform(sentences)
    centroid = np.asarray(tfidf.mean(axis=0))
    feats = _sentence_features(sentences, tfidf, centroid)
    proba = _state["classifier"].predict_proba(feats)[:, 1]

    k = min(max_sentences, len(sentences))
    top_indices = sorted(np.argsort(-proba)[:k].tolist())

    summary_sentences = [sentences[i] for i in top_indices]
    # Found via Phase 9 real-endpoint testing on a short OCR'd document: when
    # nearly every sentence is selected (small texts with few sentences),
    # rejoining with a single space per boundary can come out very slightly
    # longer than the original's char count (which has its own newlines/
    # multi-space formatting) - a whitespace-accounting artifact, not a real
    # "summary bigger than the source" state. Clamped to 1.0 so the ratio
    # stays a meaningful compression figure and never trips
    # SummarizeResponse's `le=1` schema bound with an opaque 500.
    compression_ratio = min(1.0, round(len(" ".join(summary_sentences)) / max(1, len(text)), 4))

    return {
        "summary_sentences": summary_sentences,
        "source_indices": top_indices,
        "compression_ratio": compression_ratio,
    }
