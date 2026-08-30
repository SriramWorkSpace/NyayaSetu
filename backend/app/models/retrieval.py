"""
Precedent retrieval singleton, and the case-text resolution used by
/case/{case_id}, /qa/extract, and /summarize.

--- Why case text resolution lives here ---

Search results (POST /search/precedent) come from this module's corpus - the
ungated ILDC mirror, 10,000 Supreme Court judgments capped per decisions.md
D-019, chunked into ~350-word windows (ml/src/train/train_retrieval.py).
That is also the ONLY corpus a real user can ever navigate into a case_id
from in the actual product flow (Search -> Case Detail -> Ask/Summarize) -
IndianBailJudgments-1200's case_ids are never surfaced to the frontend
anywhere, so there is no dual-source lookup to build; every case_id the
backend ever receives is one of this corpus's doc_ids.

--- Two real, disclosed limitations this creates ---

1. No case-title metadata exists in this corpus (only `id`, `text`, `label`
   columns - checked directly, not assumed). `title` is a text preview
   (the document's own opening words), clearly not a formatted case
   citation - disclosed here and in MODEL_CARD_retrieval.md rather than
   fabricating an "X vs Y" title that does not exist. `court` is
   "Supreme Court of India" for every result: the sourcing brief describes
   this corpus as exactly that, and it is corroborated by the documents'
   own content (recurring "Leave granted" - a Supreme Court of India
   procedural term for admitting a Special Leave Petition - and references
   to specific High Courts as the court appealed FROM). `year` is parsed
   from the doc_id's "YYYY_N" prefix (verified against 9,998 of 10,000
   ids; 2 non-matching ids fall back to year 0, visibly wrong rather than
   silently guessed).

2. QA and the summarizer were trained on IndianBailJudgments' short
   facts+judgment_reason text (~100 words). These documents average 8.2
   chunks (~2,900 words) each - the QA model's 384-token window can only
   ever see one ~350-word chunk at a time. Rather than silently truncate to
   the document's first chunk (which would make QA blind to anything not
   in the opening paragraphs), `find_relevant_chunk` does the "TF-IDF
   retrieval" step ARCHITECTURE.md section 7 names as part of the QA
   approach: it locates the chunk of THIS specific document most relevant
   to the question (via the chunk embeddings already sitting in the FAISS
   index - reconstructed directly, no re-embedding needed) before span
   extraction runs on that localized passage. Offsets are mapped back to
   full-document character positions before returning.
"""
from __future__ import annotations

import json
import logging
import re
import time

import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from app.base_dir import backend_dir

logger = logging.getLogger("nyayasetu.models.retrieval")

ARTIFACTS_DIR = backend_dir() / "artifacts" / "retrieval"
MINILM_DIR = backend_dir() / "artifacts" / "minilm"
DEFAULT_COURT = "Supreme Court of India"
TITLE_PREVIEW_WORDS = 12

_state: dict = {}


def load() -> None:
    t0 = time.perf_counter()
    # A local copy of the model files, not the by-name "sentence-transformers/
    # all-MiniLM-L6-v2" id - that form depends on this machine's own
    # ~/.cache/huggingface already having it (true here, during development,
    # but never true on a machine that only ever installed the packaged app -
    # HF_HUB_OFFLINE=1 (main.py) means it can't fall back to downloading it
    # either). Loading a real local directory works identically in both
    # cases and removes that dependency entirely.
    _state["embedder"] = SentenceTransformer(str(MINILM_DIR))
    _state["index"] = faiss.read_index(str(ARTIFACTS_DIR / "faiss.index"))
    chunks: list[dict] = json.loads((ARTIFACTS_DIR / "chunks.json").read_text(encoding="utf-8"))
    _state["chunks"] = chunks

    doc_chunk_positions: dict[str, list[int]] = {}
    for i, c in enumerate(chunks):
        doc_chunk_positions.setdefault(c["doc_id"], []).append(i)
    for doc_id in doc_chunk_positions:
        doc_chunk_positions[doc_id].sort(key=lambda i: chunks[i]["chunk_idx"])
    _state["doc_chunk_positions"] = doc_chunk_positions

    logger.info(
        "Retrieval index loaded in %.2fs (%d chunks, %d documents)",
        time.perf_counter() - t0, len(chunks), len(doc_chunk_positions),
    )


def _year_from_doc_id(doc_id: str) -> int:
    m = re.match(r"^(\d{4})_", doc_id)
    return int(m.group(1)) if m else 0


def _title_preview(text: str) -> str:
    words = text.split()[:TITLE_PREVIEW_WORDS]
    preview = " ".join(words)
    return preview + ("..." if len(text.split()) > TITLE_PREVIEW_WORDS else "")


def search(query: str, top_k: int) -> list[dict]:
    q_vec = _state["embedder"].encode([query], convert_to_numpy=True)
    faiss.normalize_L2(q_vec)
    # Over-fetch chunk hits since multiple chunks of the same document can
    # rank highly; dedupe to one (the best) result per document before
    # truncating to top_k.
    scores, indices = _state["index"].search(q_vec, top_k * 5)

    seen_docs: set[str] = set()
    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0:
            continue
        chunk = _state["chunks"][idx]
        doc_id = chunk["doc_id"]
        if doc_id in seen_docs:
            continue
        seen_docs.add(doc_id)
        # `title` is the document's own opening words (chunk_idx 0 for this
        # doc_id) - a per-document identity, not per-match text. Found via
        # Phase 9 Playwright testing: using the matched chunk's text here
        # instead gave the same case_id a different title on the search
        # results page than on its own Case Detail page (whose title always
        # comes from the document start via get_case_summary), which is
        # exactly the identity a saved-case list needs to match against.
        # `snippet` still shows the query-relevant matched chunk - that's a
        # different, legitimate job (showing why this result matched).
        first_chunk_idx = _state["doc_chunk_positions"][doc_id][0]
        title_text = _state["chunks"][first_chunk_idx]["text"]
        results.append(
            {
                "case_id": doc_id,
                "title": _title_preview(title_text),
                "court": DEFAULT_COURT,
                "year": _year_from_doc_id(doc_id),
                "score": round(float(score), 4),
                "snippet": chunk["text"][:280] + ("..." if len(chunk["text"]) > 280 else ""),
            }
        )
        if len(results) >= top_k:
            break
    return results


def get_case_text(doc_id: str) -> str | None:
    positions = _state["doc_chunk_positions"].get(doc_id)
    if not positions:
        return None
    return " ".join(_state["chunks"][i]["text"] for i in positions)


def get_case_summary(doc_id: str) -> dict | None:
    """title/court/year/case_number for GET /case/{case_id} - same fields
    used everywhere else, plus a full_text for display."""
    full_text = get_case_text(doc_id)
    if full_text is None:
        return None
    return {
        "case_id": doc_id,
        "title": _title_preview(full_text),
        "court": DEFAULT_COURT,
        "year": _year_from_doc_id(doc_id),
        # No real case-number citation exists in this corpus (see module
        # docstring) - the doc_id is shown as-is rather than a fabricated
        # citation format.
        "case_number": doc_id,
        "full_text": full_text,
    }


def find_relevant_chunk(doc_id: str, question: str) -> tuple[str, int] | None:
    """Returns (chunk_text, char_offset_of_chunk_in_full_text) for the chunk
    of this document most relevant to the question - the TF-IDF-retrieval
    step ARCHITECTURE.md section 7 names as part of the QA approach, applied
    here to localize a long document to something the 384-token span model
    can actually see. Returns None if doc_id is unknown."""
    positions = _state["doc_chunk_positions"].get(doc_id)
    if not positions:
        return None

    vectors = np.vstack([_state["index"].reconstruct(int(i)) for i in positions])
    q_vec = _state["embedder"].encode([question], convert_to_numpy=True)
    faiss.normalize_L2(vectors)
    faiss.normalize_L2(q_vec)
    sims = vectors @ q_vec[0]
    best = int(np.argmax(sims))

    char_offset = sum(len(_state["chunks"][i]["text"]) + 1 for i in positions[:best])  # +1 for the join space
    return _state["chunks"][positions[best]]["text"], char_offset
