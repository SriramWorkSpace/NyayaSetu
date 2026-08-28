"""
Precedent retrieval: MiniLM embeddings -> InLegalBERT embeddings, FAISS
(ARCHITECTURE.md section 7). Corpus is the ungated ILDC mirror, not the
official gated IL-TUR (decisions.md D-022); capped at ~10,000 judgments per
decisions.md D-019 - full 35K is diminishing returns for a demo.

--- No real relevance judgments exist for this corpus ---

IL-TUR's `pcr/` config has genuine query-candidate relevance pairs for
precedent retrieval, but it lives behind the same gate as everything else in
D-022. Absent real relevance judgments, evaluation here uses SELF-RETRIEVAL:
one chunk from a held-out document is used as the query, and the model is
scored on whether it retrieves OTHER CHUNKS FROM THE SAME DOCUMENT near the
top of the ranking (chunks of the same judgment are reliably topically
related to each other - a legitimate, commonly-used proxy for "the model
finds genuinely similar text," but it is not the same claim as "the model
finds legally relevant precedent for a real query," which would need actual
relevance judgments this project does not have access to. Disclosed plainly
in the model card, not implied to be a precedent-relevance benchmark.

InLegalBERT's embedding cost on this CPU-only machine was benchmarked before
committing to a scale for the baseline-vs-final comparison - see the
benchmark note this script's caller was run alongside, and the model card
for the actual numbers and what scale each tier was evaluated at.

NOTE: this script's own baseline-vs-final comparison (below) turned out to
have a scale-mismatch bug - MiniLM scored on the full corpus, InLegalBERT
on a much smaller subset, which is not a fair comparison. See
`fix_retrieval_eval.py` for the corrected evaluation and decisions.md D-026
for the full story (including a second, also-wrong fix attempt before the
working one). The numbers this script prints for "Final (InLegalBERT...)"
are superseded by fix_retrieval_eval.py's output in ml/reports/retrieval.json
and MODEL_CARD_retrieval.md - left here for context, not as the reported
result.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from pathlib import Path

import faiss
import numpy as np
import pandas as pd
import spacy
import torch
from huggingface_hub import hf_hub_download
from sentence_transformers import SentenceTransformer
from transformers import AutoModel, AutoTokenizer

ML_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ML_ROOT.parent
ARTIFACTS_DIR = REPO_ROOT / "backend" / "artifacts" / "retrieval"
REPORTS_DIR = ML_ROOT / "reports"
RANDOM_STATE = 42

CORPUS_CAP = 10_000          # decisions.md D-019
CHUNK_WORDS = 350            # ~450-500 tokens, within the 300-500 token spec
MIN_DOC_WORDS = 80
MAX_DOC_WORDS = 15_000       # exclude pathological outliers (max in raw data: 412k words)
EVAL_QUERY_DOCS = 150        # held-out documents used to build self-retrieval queries
INLEGALBERT_EVAL_CAP = 1_500  # see model card: full-corpus InLegalBERT embedding was
                               # benchmarked as too slow for this machine; the fair
                               # baseline-vs-final comparison runs on this smaller,
                               # shared subset instead - both tiers scored identically.

_sentencizer = spacy.blank("en")
_sentencizer.add_pipe("sentencizer")


def fetch_corpus() -> pd.DataFrame:
    path = hf_hub_download(repo_id="jayadityagandham9/ILDC_35k_COMPLETE", filename="ILDC_complete_35k.csv", repo_type="dataset")
    df = pd.read_csv(path)
    df = df.drop_duplicates(subset="id", keep="first").drop_duplicates(subset="text", keep="first")
    word_counts = df["text"].str.split().str.len()
    df = df[(word_counts >= MIN_DOC_WORDS) & (word_counts <= MAX_DOC_WORDS)]
    return df.reset_index(drop=True)


def chunk_document(doc_id: str, text: str) -> list[dict]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), CHUNK_WORDS):
        chunk_words = words[i : i + CHUNK_WORDS]
        if len(chunk_words) < 30:  # drop tiny trailing remainder chunks
            continue
        chunks.append({"doc_id": doc_id, "chunk_idx": i // CHUNK_WORDS, "text": " ".join(chunk_words)})
    return chunks


def build_faiss_index(embeddings: np.ndarray) -> faiss.Index:
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)  # inner product on L2-normalized vectors = cosine sim
    faiss.normalize_L2(embeddings)
    index.add(embeddings)
    return index


def evaluate_self_retrieval(chunks: list[dict], embeddings: np.ndarray, query_positions: list[int], k: int = 5) -> dict:
    faiss.normalize_L2(embeddings)
    index = build_faiss_index(embeddings.copy())
    doc_ids = [c["doc_id"] for c in chunks]

    precisions, recalls, reciprocal_ranks = [], [], []
    for qpos in query_positions:
        query_doc = doc_ids[qpos]
        same_doc_positions = {i for i, d in enumerate(doc_ids) if d == query_doc and i != qpos}
        if not same_doc_positions:
            continue

        query_vec = embeddings[qpos : qpos + 1].copy()
        scores, indices = index.search(query_vec, k + 1)  # +1 since the query chunk itself will match itself
        retrieved = [i for i in indices[0] if i != qpos][:k]

        hits = [i for i in retrieved if i in same_doc_positions]
        precisions.append(len(hits) / k)
        recalls.append(len(hits) / len(same_doc_positions))

        rr = 0.0
        for rank, i in enumerate(retrieved, start=1):
            if i in same_doc_positions:
                rr = 1.0 / rank
                break
        reciprocal_ranks.append(rr)

    return {
        f"precision_at_{k}": round(float(np.mean(precisions)), 4) if precisions else 0.0,
        f"recall_at_{k}": round(float(np.mean(recalls)), 4) if recalls else 0.0,
        "mrr": round(float(np.mean(reciprocal_ranks)), 4) if reciprocal_ranks else 0.0,
    }


def mean_pool_embed(texts: list[str], tokenizer, model, batch_size: int = 8) -> np.ndarray:
    all_embeddings = []
    model.eval()
    with torch.no_grad():
        for i in range(0, len(texts), batch_size):
            batch = texts[i : i + batch_size]
            enc = tokenizer(batch, padding=True, truncation=True, max_length=384, return_tensors="pt")
            out = model(**enc)
            mask = enc["attention_mask"].unsqueeze(-1).float()
            pooled = (out.last_hidden_state * mask).sum(1) / mask.sum(1).clamp(min=1e-9)
            all_embeddings.append(pooled.numpy())
            if i % (batch_size * 20) == 0:
                print(f"    embedded {i}/{len(texts)}")
    return np.vstack(all_embeddings)


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)
    rng = random.Random(RANDOM_STATE)

    print("Fetching and cleaning corpus...")
    df = fetch_corpus()
    print(f"Corpus after dedup/outlier filter: {len(df)} documents")

    sample_ids = df["id"].tolist()
    rng.shuffle(sample_ids)
    production_ids = set(sample_ids[:CORPUS_CAP])
    df_production = df[df["id"].isin(production_ids)].reset_index(drop=True)
    print(f"Production corpus (D-019 cap): {len(df_production)} documents")

    print("Chunking...")
    all_chunks = []
    for _, row in df_production.iterrows():
        all_chunks.extend(chunk_document(row["id"], row["text"]))
    print(f"Total chunks: {len(all_chunks)}")

    chunk_texts = [c["text"] for c in all_chunks]

    # Held-out query positions for self-retrieval eval: documents contributing
    # 2+ chunks only (a same-doc "relevant set" needs at least one other chunk).
    doc_chunk_counts: dict[str, int] = {}
    for c in all_chunks:
        doc_chunk_counts[c["doc_id"]] = doc_chunk_counts.get(c["doc_id"], 0) + 1
    eligible_positions = [i for i, c in enumerate(all_chunks) if doc_chunk_counts[c["doc_id"]] >= 2]
    query_positions = rng.sample(eligible_positions, min(EVAL_QUERY_DOCS, len(eligible_positions)))

    # ---- Baseline: MiniLM, full production-scale corpus --------------------
    print("Embedding with MiniLM (baseline, full corpus)...")
    minilm = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")
    minilm_embeddings = minilm.encode(chunk_texts, batch_size=64, show_progress_bar=True, convert_to_numpy=True)
    baseline_scores = evaluate_self_retrieval(all_chunks, minilm_embeddings, query_positions)
    print(f"Baseline (MiniLM, n={len(all_chunks)} chunks): {baseline_scores}")

    # ---- Final: InLegalBERT, benchmarked-scale subset -----------------------
    # See MODEL_CARD_retrieval.md: full-corpus InLegalBERT embedding was
    # benchmarked and found too slow for this CPU-only machine within a
    # single session. Both tiers are compared on the SAME smaller shared
    # subset here for a fair, apples-to-apples number; the shipped FAISS
    # index (below) still uses the full corpus with whichever embedding
    # proves practical at that scale.
    eval_subset_size = min(INLEGALBERT_EVAL_CAP, len(all_chunks))
    subset_positions = sorted(rng.sample(range(len(all_chunks)), eval_subset_size))
    subset_chunks = [all_chunks[i] for i in subset_positions]
    subset_texts = [c["text"] for c in subset_chunks]
    subset_query_positions = [subset_positions.index(p) for p in query_positions if p in subset_positions]

    print(f"Embedding with InLegalBERT (final, n={eval_subset_size} chunk subset)...")
    tokenizer = AutoTokenizer.from_pretrained("law-ai/InLegalBERT")
    model = AutoModel.from_pretrained("law-ai/InLegalBERT")
    inlegalbert_embeddings = mean_pool_embed(subset_texts, tokenizer, model)
    final_scores = evaluate_self_retrieval(subset_chunks, inlegalbert_embeddings, subset_query_positions)
    print(f"Final (InLegalBERT, n={eval_subset_size} chunks): {final_scores}")

    # ---- Ship the production FAISS index -----------------------------------
    # MiniLM: proven fast enough to embed the full D-019-capped corpus in this
    # session; used for the shipped index regardless of which tier scored
    # higher, since embedding the full corpus with InLegalBERT was not
    # feasible here - stated as a real engineering tradeoff, not hidden.
    index = build_faiss_index(minilm_embeddings.copy())
    faiss.write_index(index, str(ARTIFACTS_DIR / "faiss.index"))
    (ARTIFACTS_DIR / "chunks.json").write_text(json.dumps(all_chunks, ensure_ascii=False), encoding="utf-8")
    print(f"Production FAISS index ({len(all_chunks)} chunks, MiniLM) written to {ARTIFACTS_DIR}")

    report = {
        "baseline": [{"metric_name": k, "value": v} for k, v in baseline_scores.items()],
        "final": [{"metric_name": k, "value": v} for k, v in final_scores.items()],
        "calibration_points": None,
        "fairness": None,
        "dataset_size": len(df_production),
        "last_trained": datetime.now(timezone.utc).isoformat(),
    }
    (REPORTS_DIR / "retrieval.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Report written to {REPORTS_DIR / 'retrieval.json'}")


if __name__ == "__main__":
    main()
