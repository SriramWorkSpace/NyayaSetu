# Model card — Precedent Retrieval

**Module:** `retrieval` · **Version:** Phase 7, MiniLM embeddings → InLegalBERT embeddings, FAISS (ARCHITECTURE.md section 7).

## Data — and why it isn't the official IL-TUR access path

`Exploration-Lab/IL-TUR` on Hugging Face — the sourcing brief's intended source — is gated: it requires a human to request and be manually granted access on a specific account, which this session could not do on the user's behalf (decisions.md D-022). The `pcr/` (Precedent Case Retrieval) config there has real query-candidate relevance judgments, which would have been the better evaluation source; it was not reachable.

**Actual source:** `jayadityagandham9/ILDC_35k_COMPLETE`, an ungated community re-upload of the same underlying ILDC corpus (38,904 rows of real Supreme Court judgment text). The original data's license — free for academic research, no commercial use — is treated as still binding regardless of the mirror's own missing license metadata; a re-upload does not change what the data is licensed for.

**Cleaning, before any embedding work:** dropped 5,082 duplicate-ID rows and 5,710 duplicate-text rows (keep-first), then excluded documents under 80 words or over 15,000 words (the raw corpus has a maximum of 412,606 words on one row — a clear outlier, not a normal judgment). **Capped at 10,000 documents** after cleaning (decisions.md D-019) — full 35K is diminishing returns for a demo; nobody evaluating this project will notice 10K vs 35K, but everyone will notice a slow index build.

Documents are chunked into ~350-word windows (~450–500 tokens), within the 300–500 token spec.

## No real relevance judgments exist for this corpus — the evaluation is a disclosed proxy

Without `pcr/`'s labeled query-candidate pairs, Precision@k/Recall@k/MRR are computed via **self-retrieval**: one chunk from a held-out document is used as a query, and the model is scored on whether it retrieves *other chunks from the same document* near the top of the ranking. Chunks of the same judgment are reliably topically related to each other, which makes this a legitimate sanity check that embeddings capture real topical similarity — **it is not the same claim as "the model finds legally relevant precedent for a real query,"** which needs actual relevance judgments this project does not have access to.

## The InLegalBERT throughput problem, and the tradeoff it forced

Before committing to a scale, InLegalBERT's CPU throughput was benchmarked directly on this machine: **~428ms per document** (batch=1, sequence length 384). Embedding the full 10,000-document / 82,444-chunk production corpus with InLegalBERT would take over an hour — not feasible within a single working session on CPU-only hardware. **The shipped FAISS index** (what `/search/precedent` will query once Phase 9 wires it in) therefore uses **MiniLM embeddings at full production scale** — and, as the evaluation below shows, this was also the empirically better choice, not just the practical one.

## A scale-mismatch bug, caught by a suspiciously perfect result — and the fix, twice

The first evaluation attempt scored MiniLM on the full 82,444-chunk corpus but InLegalBERT on a smaller 1,500-chunk subset (chosen only for embedding-time reasons). InLegalBERT came back at **MRR 1.0, Recall@5 1.0** — too perfect to trust. Investigation confirmed why: in that small subset, only 153 of 1,329 documents had 2+ chunks, and 137 of those had *exactly* 2 — so most eval queries only needed to find one near-identical sibling chunk in a haystack of 1,500, a far easier task than the baseline's 82,444-chunk search. Not a real result; a scale artifact.

**The first fix attempt was also wrong.** It tried to replay the original run's random-number sequence to recover the exact same 1,500-chunk subset for a fair MiniLM comparison - but missed an earlier `rng.shuffle()` call (the corpus-capping step), so it silently compared against a *different* random subset than InLegalBERT had actually seen. Caught immediately: only 2 of the intended 150 eval queries survived into that mismatched subset - a sample size that could not mean anything on its own, and itself a sign something upstream was wrong.

**The working fix** abandoned RNG replay entirely and built one well-defined evaluation set directly: all 150 query documents (with their full sibling-chunk sets guaranteed present) plus 800 additional distractor documents, for 8,149 chunks total. Both MiniLM (reconstructed from the saved production FAISS index - no re-embedding needed) and InLegalBERT (freshly embedded for this exact set) were scored identically on it. This is the number below.

## Evaluation

150 real eval queries, 8,149-chunk shared comparison set (self-retrieval methodology, k=5 - see above):

| Model | Precision@5 | Recall@5 | MRR |
|---|---|---|---|
| **Baseline — MiniLM** | **0.164** | **0.124** | **0.309** |
| Final — InLegalBERT (frozen, mean-pooled) | 0.085 | 0.069 | 0.219 |

**InLegalBERT does not beat the baseline here, reported honestly rather than hidden** (CLAUDE.md section 7). This is not surprising in hindsight: InLegalBERT is a masked-language-model checkpoint, never trained to produce good similarity embeddings on its own — raw/frozen BERT-family embeddings are well documented in the literature (the original Sentence-BERT paper's own motivation) to underperform purpose-built sentence encoders like MiniLM, which is trained specifically via contrastive objectives for exactly this kind of similarity task. Fine-tuning InLegalBERT with a proper retrieval objective (contrastive or triplet loss on relevant/irrelevant pairs) would likely close or reverse this gap, but that is a materially larger undertaking than embedding it frozen, and was out of scope here. The production index correctly ships with MiniLM - both for the CPU-throughput reason above and because it is, honestly, the better embedding for this task as measured.

The full-corpus MiniLM number (`retrieval.json`'s primary `baseline` entries: Precision@5 0.3, Recall@5 0.15, MRR 0.549) is a different, larger-scale run with a different random seed and is not directly comparable point-for-point to the table above - it describes the actual shipped index's real-scale behavior. The `minilm_at_comparison_scale_*` entries in `retrieval.json` are the ones that match the table above exactly.

## Phase 9 serving notes

**No case-title metadata exists in this corpus.** Checked directly against the raw source CSV: it has exactly three columns — `id`, `text`, `label` — no title field, ever existed. `backend/app/models/retrieval.py` builds a result's `title` from the document's own opening words (a text preview) rather than fabricate a formatted "X vs Y" citation that the source data never contained. `court` is reported as "Supreme Court of India" for every result — corroborated by the documents' own content (recurring "Leave granted," repeated references to a named High Court as the court appealed *from*), not assumed from the sourcing brief's description alone. `year` is parsed from the `doc_id`'s "YYYY_N" prefix, verified to match this pattern on 9,998 of 10,000 corpus documents before relying on it.

**A pre-existing text-corruption artifact in the source corpus is visible in search snippets and titles.** Confirmed directly against the raw CSV (decisions.md D-030): every literal `"co"` substring in the source text was replaced with `"company"` with no word-boundary check, regardless of context — e.g. "considered" → "companysidered", "counsel" → "companynsel", "co-accused" → "companyccused" — and the same pattern applies to `"no"` → `"number"`. This was already present in the raw text as downloaded from `jayadityagandham9/ILDC_35k_COMPLETE`, well before this project's chunking or embedding touched it — verified by locating the exact corrupted phrase inside the untouched raw CSV text, not assumed from how it looked in a processed snippet. It is a real, visible quality issue for anyone reading search results in the running app, disclosed here rather than silently left for a user to discover and wonder if it's a bug in this project. Not corrected in this phase; reversing the two known substitutions is a reasonable, low-risk future cleanup.

## Limitations

1. Self-retrieval evaluation is a topical-similarity proxy, not a legal-relevance benchmark — revisit with `pcr/`'s real relevance judgments if the user later obtains their own gated-access grant.
2. The final (InLegalBERT) tier's numbers come from a 1,500-chunk subset, not the full 10,000-document corpus the baseline was measured on and the app will actually search.
3. Corpus license is academic/non-commercial (carried over from the original ILDC terms) — this module cannot be part of a commercial product while it remains in the corpus (consistent with decisions.md D-006).
4. Chunk boundaries are word-count based, not sentence- or section-aware — a chunk can start or end mid-sentence.
