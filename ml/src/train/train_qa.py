"""
Extractive QA: TF-IDF retrieval -> fine-tuned InLegalBERT span head
(ARCHITECTURE.md section 7).

--- The data-sourcing detour that shaped this script ---

The sourcing brief's intended QA source was IL-TUR's 56-document expert
split with hand-annotated salient-sentence spans. That HF repo is gated
(requires manual per-account approval this session cannot grant). The
community mirror found instead (anuragiiser/ILDC_expert) turned out, on
inspection, to be a human EVALUATION dataset (model-generated explanations
judged against official reasoning) - not (question, answer_span) training
data at all.

IndianBailJudgments-1200 already has exactly the right shape for this,
unused until now: `legal_issues` holds genuine legal questions ("Whether
fresh bail is needed when..."), and `judgment_reason` is the court's answer
to them. Only ~2% of records store this as a list of ~3 discrete items,
though - discovered here, not assumed: 98% store it as a single string
(occasionally with 1-2 semicolon-separated sub-issues), which a naive
`for question in record["legal_issues"]` would iterate CHARACTER BY
CHARACTER, silently exploding one record into ~150 garbage "questions."
Caught before training by an example-count sanity check (expected ~1,400,
got 151,498), traced to this, and fixed with `normalize_legal_issues()`
(shared with train_bail.py, which had the same field and a different but
related bug - see decisions.md D-025). Logged as decisions.md D-022 for the
IL-TUR sourcing detour that led here in the first place.

--- The label-circularity problem, and how it was avoided ---

There is no human-annotated answer-span ground truth here either. A first
design used TF-IDF cosine similarity to both (a) generate the "gold" answer
span for each question and (b) serve as the "baseline" - which would have
scored the baseline at ~100% by construction (the baseline and the gold
label would literally be the same computation), proving nothing. Instead:

  - GOLD spans are located via semantic embedding similarity (sentence-
    transformers MiniLM) between the question and each candidate sentence
    in `facts + judgment_reason` - a different, independent signal from the
    baseline.
  - BASELINE is bare TF-IDF cosine similarity (lexical overlap only, no
    semantic model) - the ARCHITECTURE-specified "TF-IDF retrieval" tier.
  - FINAL is InLegalBERT fine-tuned as a genuine SQuAD-style span-prediction
    head (predicts start/end token positions directly), trained against the
    embedding-derived gold spans.

Both baseline and final are scored against the same embedding-derived gold,
which is itself a heuristic proxy, not hand-verified truth - disclosed
plainly in the model card, not implied to be gold-standard.
"""
from __future__ import annotations

import json
import random
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import spacy
import sys
import torch
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from torch.utils.data import DataLoader, Dataset
from transformers import AutoModelForQuestionAnswering, AutoTokenizer

sys.path.insert(0, str(Path(__file__).resolve().parent))
from train_bail import normalize_legal_issues  # noqa: E402

ML_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ML_ROOT.parent
DATA_PATH = ML_ROOT / "data" / "bail" / "raw.json"
ARTIFACTS_DIR = REPO_ROOT / "backend" / "artifacts" / "qa"
REPORTS_DIR = ML_ROOT / "reports"
RANDOM_STATE = 42
MAX_SEQ_LEN = 384
BACKBONE = "law-ai/InLegalBERT"

_sentencizer = spacy.blank("en")
_sentencizer.add_pipe("sentencizer")


def split_sentences_with_offsets(text: str) -> list[tuple[str, int, int]]:
    doc = _sentencizer(text)
    return [(s.text, s.start_char, s.end_char) for s in doc.sents if s.text.strip()]


def build_examples(records: list[dict], embedder: SentenceTransformer) -> list[dict]:
    examples = []
    for r in records:
        text = (r.get("facts", "") + " " + r.get("judgment_reason", "")).strip()
        sentences = split_sentences_with_offsets(text)
        questions = normalize_legal_issues(r.get("legal_issues"))
        if not sentences or not questions:
            continue
        sent_texts = [s[0] for s in sentences]
        sent_embeddings = embedder.encode(sent_texts, show_progress_bar=False)
        for question in questions:
            q_emb = embedder.encode([question], show_progress_bar=False)
            sims = cosine_similarity(q_emb, sent_embeddings)[0]
            best_idx = int(np.argmax(sims))
            answer_text, start, end = sentences[best_idx]
            examples.append(
                {
                    "case_id": r["case_id"],
                    "context": text,
                    "question": question,
                    "answer_text": answer_text,
                    "char_start": start,
                    "char_end": end,
                }
            )
    return examples


def tfidf_baseline_predict(context: str, question: str, sentences: list[tuple[str, int, int]]) -> tuple[int, int]:
    sent_texts = [s[0] for s in sentences]
    vec = TfidfVectorizer().fit(sent_texts + [question])
    sent_vecs = vec.transform(sent_texts)
    q_vec = vec.transform([question])
    sims = cosine_similarity(q_vec, sent_vecs)[0]
    best_idx = int(np.argmax(sims))
    return sentences[best_idx][1], sentences[best_idx][2]


def token_f1(pred: str, gold: str) -> float:
    pred_tokens, gold_tokens = pred.lower().split(), gold.lower().split()
    if not pred_tokens or not gold_tokens:
        return float(pred_tokens == gold_tokens)
    common = {}
    for t in pred_tokens:
        common[t] = min(pred_tokens.count(t), gold_tokens.count(t))
    num_same = sum(common.values())
    if num_same == 0:
        return 0.0
    precision = num_same / len(pred_tokens)
    recall = num_same / len(gold_tokens)
    return 2 * precision * recall / (precision + recall)


class QADataset(Dataset):
    def __init__(self, examples: list[dict], tokenizer):
        self.examples = examples
        self.tokenizer = tokenizer

    def __len__(self):
        return len(self.examples)

    def __getitem__(self, idx):
        ex = self.examples[idx]
        enc = self.tokenizer(
            ex["question"],
            ex["context"],
            max_length=MAX_SEQ_LEN,
            truncation="only_second",
            padding="max_length",
            return_offsets_mapping=True,
            return_tensors="pt",
        )
        offsets = enc.pop("offset_mapping")[0]
        sequence_ids = enc.sequence_ids(0)

        start_char, end_char = ex["char_start"], ex["char_end"]
        start_tok = end_tok = 0  # default: unanswerable-in-window -> points at CLS
        context_token_idxs = [i for i, sid in enumerate(sequence_ids) if sid == 1]
        if context_token_idxs:
            for i in context_token_idxs:
                tok_start, tok_end = offsets[i].tolist()
                if tok_start <= start_char < tok_end:
                    start_tok = i
                if tok_start < end_char <= tok_end:
                    end_tok = i

        item = {k: v.squeeze(0) for k, v in enc.items()}
        item["start_positions"] = torch.tensor(start_tok)
        item["end_positions"] = torch.tensor(end_tok)
        return item


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    records = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    random.Random(RANDOM_STATE).shuffle(records)
    n_test_records = int(len(records) * 0.2)
    train_records, test_records = records[n_test_records:], records[:n_test_records]

    print("Loading MiniLM for gold-span labeling...")
    embedder = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    print("Building examples (train)...")
    train_examples = build_examples(train_records, embedder)
    print("Building examples (test)...")
    test_examples = build_examples(test_records, embedder)
    print(f"Train examples: {len(train_examples)}  Test examples: {len(test_examples)}")

    # ---- Baseline: bare TF-IDF, no learned model at all ---------------------
    baseline_em, baseline_f1 = [], []
    for ex in test_examples:
        sentences = split_sentences_with_offsets(ex["context"])
        start, end = tfidf_baseline_predict(ex["context"], ex["question"], sentences)
        pred_text = ex["context"][start:end]
        baseline_em.append(float(pred_text.strip() == ex["answer_text"].strip()))
        baseline_f1.append(token_f1(pred_text, ex["answer_text"]))
    baseline_metrics = {"exact_match": round(float(np.mean(baseline_em)), 4), "f1": round(float(np.mean(baseline_f1)), 4)}
    print(f"Baseline (TF-IDF): {baseline_metrics}")

    # ---- Final: fine-tune InLegalBERT as a span-prediction head ------------
    print(f"Loading {BACKBONE} for fine-tuning...")
    tokenizer = AutoTokenizer.from_pretrained(BACKBONE)
    model = AutoModelForQuestionAnswering.from_pretrained(BACKBONE)

    train_ds = QADataset(train_examples, tokenizer)
    loader = DataLoader(train_ds, batch_size=8, shuffle=True)

    optimizer = torch.optim.AdamW(model.parameters(), lr=3e-5)
    n_epochs = 2
    model.train()
    for epoch in range(n_epochs):
        total_loss = 0.0
        for step, batch in enumerate(loader):
            optimizer.zero_grad()
            out = model(**batch)
            out.loss.backward()
            optimizer.step()
            total_loss += out.loss.item()
            if step % 20 == 0:
                print(f"  epoch {epoch+1} step {step}/{len(loader)} loss={out.loss.item():.3f}")
        print(f"Epoch {epoch+1}/{n_epochs}  avg_loss={total_loss/len(loader):.3f}")

    model.eval()
    final_em, final_f1 = [], []
    with torch.no_grad():
        for ex in test_examples:
            enc = tokenizer(
                ex["question"], ex["context"], max_length=MAX_SEQ_LEN,
                truncation="only_second", return_offsets_mapping=True, return_tensors="pt",
            )
            offsets = enc.pop("offset_mapping")[0]
            out = model(**enc)
            start_idx = int(torch.argmax(out.start_logits))
            end_idx = int(torch.argmax(out.end_logits))
            if end_idx < start_idx:
                end_idx = start_idx
            start_char = int(offsets[start_idx][0])
            end_char = int(offsets[end_idx][1])
            pred_text = ex["context"][start_char:end_char]
            final_em.append(float(pred_text.strip() == ex["answer_text"].strip()))
            final_f1.append(token_f1(pred_text, ex["answer_text"]))
    final_metrics = {"exact_match": round(float(np.mean(final_em)), 4), "f1": round(float(np.mean(final_f1)), 4)}
    print(f"Final (InLegalBERT): {final_metrics}")

    model.save_pretrained(ARTIFACTS_DIR / "inlegalbert_qa")
    tokenizer.save_pretrained(ARTIFACTS_DIR / "inlegalbert_qa")
    print(f"Model written to {ARTIFACTS_DIR / 'inlegalbert_qa'}")

    report = {
        "baseline": [{"metric_name": k, "value": v} for k, v in baseline_metrics.items()],
        "final": [{"metric_name": k, "value": v} for k, v in final_metrics.items()],
        "calibration_points": None,
        "fairness": None,
        "dataset_size": len(train_examples) + len(test_examples),
        "last_trained": datetime.now(timezone.utc).isoformat(),
    }
    (REPORTS_DIR / "qa.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Report written to {REPORTS_DIR / 'qa.json'}")


if __name__ == "__main__":
    main()
