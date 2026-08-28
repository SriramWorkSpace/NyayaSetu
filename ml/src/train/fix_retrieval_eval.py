"""
Second, correct attempt at fixing train_retrieval.py's comparison methodology.

The first attempt at this fix (since replaced) tried to replay the original
script's RNG sequence to recover the same 1,500-chunk subset InLegalBERT was
scored on - but it skipped an earlier `rng.shuffle()` call (the corpus-cap
step), so it silently measured MiniLM against a DIFFERENT random subset than
InLegalBERT actually saw. Caught by inspecting the result before trusting it
(only 2 of 150 intended eval queries fell inside that mismatched subset -
a sample size too small to mean anything, and itself a sign something was
wrong). Neither version of "the comparison" was valid; this one is built
correctly instead of patched further.

This version builds ONE well-defined evaluation set directly, with no RNG
replay dependency on the original run at all:
  1. All EVAL_QUERY_DOCS query documents (with 2+ chunks) are chosen first,
     and every one of their chunks is included - guaranteeing all query
     documents actually have their sibling chunks present to be found.
  2. DISTRACTOR_DOCS additional random documents are added on top, to give
     the retrieval task a realistic amount of competition rather than a
     tiny, artificially easy haystack.
  3. Both MiniLM (reconstructed from the saved production FAISS index - no
     re-embedding needed) and InLegalBERT (freshly embedded, since no
     production index exists for it) are scored on this identical set.
"""
from __future__ import annotations

import json
import random
from pathlib import Path

import faiss
import numpy as np
import torch
from transformers import AutoModel, AutoTokenizer

ML_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ML_ROOT.parent
ARTIFACTS_DIR = REPO_ROOT / "backend" / "artifacts" / "retrieval"
REPORTS_DIR = ML_ROOT / "reports"
RANDOM_STATE = 43  # deliberately different from train_retrieval.py's 42 -
                    # this is a fresh, independently-defined eval set, not a
                    # replay of the original (flawed) one.
EVAL_QUERY_DOCS = 150
DISTRACTOR_DOCS = 800


def evaluate_self_retrieval(chunks: list[dict], embeddings: np.ndarray, query_positions: list[int], k: int = 5) -> dict:
    embeddings = embeddings.copy()
    faiss.normalize_L2(embeddings)
    dim = embeddings.shape[1]
    index = faiss.IndexFlatIP(dim)
    index.add(embeddings)
    doc_ids = [c["doc_id"] for c in chunks]

    precisions, recalls, reciprocal_ranks = [], [], []
    for qpos in query_positions:
        query_doc = doc_ids[qpos]
        same_doc_positions = {i for i, d in enumerate(doc_ids) if d == query_doc and i != qpos}
        if not same_doc_positions:
            continue
        query_vec = embeddings[qpos : qpos + 1].copy()
        _, indices = index.search(query_vec, k + 1)
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
        "n_queries": len(precisions),
    }


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
            if i % (batch_size * 20) == 0:
                print(f"    embedded {i}/{len(texts)}")
    return np.vstack(embeddings)


def main() -> None:
    rng = random.Random(RANDOM_STATE)
    all_chunks = json.loads((ARTIFACTS_DIR / "chunks.json").read_text(encoding="utf-8"))
    minilm_index = faiss.read_index(str(ARTIFACTS_DIR / "faiss.index"))
    print(f"Corpus: {len(all_chunks)} chunks")

    doc_chunk_positions: dict[str, list[int]] = {}
    for i, c in enumerate(all_chunks):
        doc_chunk_positions.setdefault(c["doc_id"], []).append(i)

    eligible_docs = [d for d, positions in doc_chunk_positions.items() if len(positions) >= 2]
    query_docs = rng.sample(eligible_docs, min(EVAL_QUERY_DOCS, len(eligible_docs)))

    remaining_docs = [d for d in doc_chunk_positions if d not in set(query_docs)]
    distractor_docs = rng.sample(remaining_docs, min(DISTRACTOR_DOCS, len(remaining_docs)))

    selected_docs = set(query_docs) | set(distractor_docs)
    selected_positions = sorted(p for d in selected_docs for p in doc_chunk_positions[d])
    subset_chunks = [all_chunks[p] for p in selected_positions]
    print(f"Eval set: {len(subset_chunks)} chunks from {len(selected_docs)} documents ({len(query_docs)} query docs, {len(distractor_docs)} distractors)")

    old_to_new = {old: new for new, old in enumerate(selected_positions)}
    query_positions_in_subset = []
    for d in query_docs:
        first_chunk_old_pos = doc_chunk_positions[d][0]
        query_positions_in_subset.append(old_to_new[first_chunk_old_pos])

    minilm_vectors = np.vstack([minilm_index.reconstruct(int(p)) for p in selected_positions])
    minilm_scores = evaluate_self_retrieval(subset_chunks, minilm_vectors, query_positions_in_subset)
    print(f"MiniLM @ {len(subset_chunks)}-chunk fair-comparison set: {minilm_scores}")

    print("Loading InLegalBERT...")
    tokenizer = AutoTokenizer.from_pretrained("law-ai/InLegalBERT")
    model = AutoModel.from_pretrained("law-ai/InLegalBERT")
    texts = [c["text"] for c in subset_chunks]
    print(f"Embedding {len(texts)} chunks with InLegalBERT...")
    inlegalbert_vectors = embed_inlegalbert(texts, tokenizer, model)
    inlegalbert_scores = evaluate_self_retrieval(subset_chunks, inlegalbert_vectors, query_positions_in_subset)
    print(f"InLegalBERT @ {len(subset_chunks)}-chunk fair-comparison set: {inlegalbert_scores}")

    existing = json.loads((REPORTS_DIR / "retrieval.json").read_text(encoding="utf-8"))
    existing["final"] = [{"metric_name": k, "value": v} for k, v in inlegalbert_scores.items() if k != "n_queries"]
    existing["baseline"] = [p for p in existing["baseline"] if not p["metric_name"].startswith("minilm_subset_")] + [
        {"metric_name": f"minilm_at_comparison_scale_{k}", "value": v}
        for k, v in minilm_scores.items() if k != "n_queries"
    ]
    existing["_comparison_scale_chunks"] = len(subset_chunks)
    existing["_comparison_scale_n_queries"] = minilm_scores["n_queries"]
    (REPORTS_DIR / "retrieval.json").write_text(json.dumps(existing, indent=2), encoding="utf-8")
    print("retrieval.json corrected with a valid, same-scale baseline-vs-final comparison")


if __name__ == "__main__":
    main()
