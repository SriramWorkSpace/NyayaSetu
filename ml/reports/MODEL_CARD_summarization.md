# Model card — Case Summarization

**Module:** `summarization` · **Version:** Phase 7, TextRank → supervised sentence classifier (ARCHITECTURE.md section 7).

## Data

Source text: `facts + judgment_reason` from IndianBailJudgments-1200 (CC BY 4.0), split into sentences with spaCy's rule-based sentencizer. **Using `judgment_reason` here is not the leakage concern it is for bail prediction** (decisions.md D-014): a summary of a court judgment is *supposed* to say what was decided and why — that is the entire point of a judgment summary, not something to withhold from it.

Reference summaries are the dataset's `summary` field — confirmed **abstractive** (paraphrased prose averaging 25 words) by direct inspection before writing any training code, not verbatim extracted sentences (source `facts` averages 59 words, `judgment_reason` 39 words — clearly rewritten, not copied).

**Source documents here are short** — the dataset's condensed fact/reasoning fields (~100 words combined, typically 5–7 sentences), not full multi-page judgments. This is a real scoping characteristic of the corpus, not a full-length-judgment summarizer; stated here rather than implied away.

## Building extractive labels from an abstractive reference — the oracle technique

There is no direct "which sentences belong in the summary" ground truth, since the reference is abstractive. Labels are built via the standard **oracle extraction** technique from the summarization literature: greedily select the combination of up to 3 source sentences whose concatenation maximizes ROUGE-1 F1 against the reference summary. This is an established methodology (used to derive extractive training data from abstractive references, e.g. in CNN/DailyMail-style extractive summarization work), not something invented for this project — but it is a proxy label, not a hand-verified one.

## Approach

- **Baseline — TextRank**: unsupervised. A TF-IDF sentence-similarity graph scored with PageRank (`networkx`); top-k sentences selected by graph centrality, no training data used at all.
- **Final — supervised sentence classifier**: `LogisticRegression` (`class_weight="balanced"`) trained on the oracle labels, using per-sentence features: cosine similarity to the document's TF-IDF centroid, normalized position in the document, and normalized sentence length. At inference, the top-k sentences by predicted probability are selected, where k matches the oracle's own sentence count for that document (a stand-in for the request's `max_sentences` parameter in the real API).

## Evaluation

Held-out test split (20%, oracle labels computed independently per split — no leakage of test reference summaries into the training vectorizer, which is fit on train sentences only).

| Model | ROUGE-1 | ROUGE-2 | ROUGE-L |
|---|---|---|---|
| Baseline — TextRank | 0.3258 | 0.0961 | 0.2158 |
| **Final — sentence classifier** | **0.3377** | **0.0994** | **0.2190** |

The final model beats the baseline on all three ROUGE variants, honestly — but the margin is modest (~1 point on ROUGE-1). On short, few-sentence source documents, an unsupervised centrality-based method (TextRank) is already a reasonably strong baseline; the supervised classifier's main advantage is learning *which* structural signals (position, centroid similarity, length) tend to correlate with the oracle's sentence choices, which only helps at the margin when there are just 5–7 candidate sentences to choose from.

## Limitations

1. Reference summaries are abstractive; the extractive labels used for training and evaluation are a proxy (oracle ROUGE-maximizing selection), not hand-verified "this sentence belongs in the summary" annotations.
2. Source documents are short (condensed fact/reasoning fields), not full multi-page judgments — behavior on longer real documents (once Phase 9 wires in actual scanned/retrieved full text) is untested.
3. The modest baseline-to-final margin suggests limited headroom on documents this short; a longer-document setting (more candidate sentences per document) may show a larger, more meaningful gap between unsupervised and supervised selection.
