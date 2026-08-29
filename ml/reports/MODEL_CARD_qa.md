# Model card — Extractive Question Answering

**Module:** `qa` · **Version:** Phase 7, TF-IDF retrieval → fine-tuned InLegalBERT span head (ARCHITECTURE.md section 7). Extractive only — the answer is always a span highlighted inside the source judgment, never generated text (decisions.md D-008).

## Data — a sourcing detour, and why the substitute is arguably better-fitted

The sourcing brief's intended source was IL-TUR's 56-document expert split with hand-annotated salient-sentence spans. That repo is gated (decisions.md D-022) — inaccessible without a manual per-account approval this session cannot grant. The ungated community mirror found instead (`anuragiiser/ILDC_expert`) was inspected before use and turned out to be a **human evaluation dataset**: model-generated case explanations judged against official reasoning, with columns like `Model1 (Pretrained)`, `Feedback for Model 1` — not `(question, answer_span)` training pairs at all. **Not used.**

**Actual source: IndianBailJudgments-1200**, already fetched and audited in Phase 6, unused for this purpose until now. `legal_issues` is a list of ~3 genuine legal questions per record ("Whether fresh bail is needed when new, more serious penal sections are added"), and `judgment_reason` is the court's answer to them. Context text is `facts + judgment_reason` concatenated. This yields roughly 1,200 × 3 ≈ 3,600 (question, context) pairs — more training data than the 56-document split would have given, on a corpus this project already has deep audit provenance for (decisions.md D-023).

## The label-circularity problem, caught before training started

There is no hand-annotated answer-span ground truth here. The first design used TF-IDF cosine similarity to *both* generate the "gold" answer span *and* serve as the "baseline" — which would have scored the baseline at ~100% by construction, since baseline and gold would be the literal same computation. **Fixed before any model was trained:**

- **Gold spans** are located via semantic embedding similarity (sentence-transformers MiniLM) between the question and each candidate sentence — an independent signal from the baseline.
- **Baseline** is bare TF-IDF cosine similarity (lexical overlap only, the ARCHITECTURE-specified "TF-IDF retrieval" tier) — genuinely different from the gold-labeling method.
- **Final** is InLegalBERT fine-tuned as a real SQuAD-style span-prediction head (`AutoModelForQuestionAnswering`, predicting start/end token positions directly) — not a similarity reranker, an actual trained extractive model.

Both baseline and final are scored against the same MiniLM-derived gold, which is itself a heuristic proxy for a real human-verified span — disclosed here plainly, not implied to be gold-standard.

## Training

Split by record (not by individual question) 80/20, so no document's sentences appear in both train and test. Fine-tuned for 2 epochs, batch size 8, `AdamW` at `lr=3e-5`, sequence length capped at 384 tokens. Epoch count was set from an empirical CPU throughput benchmark on this machine (~428ms per InLegalBERT forward pass at this sequence length) rather than picked arbitrarily — full details and the benchmark numbers are in `decisions.md` and `MODEL_CARD_bail.md`'s fusion section, which used the same backbone.

## Evaluation

Held-out test split, 270 (question, context) pairs from 1,369 total examples across 1,200 records, scored against the MiniLM-derived gold spans described above.

| Model | Exact Match | F1 |
|---|---|---|
| Baseline — TF-IDF | 0.5889 | 0.6604 |
| **Final — InLegalBERT (fine-tuned)** | **0.6481** | **0.7393** |

The final model beats the baseline honestly — a real ~6-point EM and ~8-point F1 gain from 2 epochs of fine-tuning versus bare lexical similarity. Training loss dropped from 5.89 to 0.75 over the 2 epochs (276 batches total, batch size 8, `lr=3e-5`), confirming the model was still learning rather than plateaued — more epochs may improve this further, not attempted here given the CPU-only time budget for this phase.

## Phase 9 serving notes

**Limitations #2 and #3 below are now confirmed, not just anticipated.** Tested directly against the live retrieval corpus via `/qa/extract` (decisions.md D-030 item 4): the model was fine-tuned on `IndianBailJudgments-1200`'s short `facts + judgment_reason` context and formally-phrased `legal_issues` questions, but the live Case Detail / Ask flow runs on the ILDC retrieval corpus - full multi-page judgments, naturally-phrased user questions, and the "co"->"company" text corruption disclosed in `MODEL_CARD_retrieval.md`. Real questions against real documents returned near-zero-confidence or off-topic spans in several tested cases (score as low as 0.0002-0.0013), well under the 0.7393 held-out F1 above. Chunk retrieval and offset mapping (`app/models/retrieval.find_relevant_chunk`, `app/routers/qa.py`) were checked separately and are locating plausible, relevant chunks correctly - the gap is the fine-tuned model's real generalization shortfall to a different corpus and question style, not a serving-layer bug. The per-answer `score` the API returns already reflects this honestly (it is often near-zero on this corpus) - the UI must surface that low score rather than round it up to imply the reported F1's confidence level.

## Limitations

1. Answer spans are a semantic-similarity proxy, not hand-verified ground truth — a real number, but not the same rigor as a human marking spans.
2. Questions come from `legal_issues`' formal drafting convention ("Whether X requires Y..."), not natural conversational phrasing a real user might type into the app's "Ask" field. Real-user question phrasing is untested — worth a small hand-collected validation set before relying on this in a live demo with an actual audience typing questions.
3. Context is limited to `facts + judgment_reason` (a few hundred words), not a full multi-page judgment — the real Case Detail screen's `full_text` will be longer once Phase 9 wires in real documents, and answer-locating behavior at that length is untested here.
4. Single-domain (bail judgments only); generalization to other judgment types is untested.
