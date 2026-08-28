"""
Document NER: regex baseline -> spaCy NER (ARCHITECTURE.md section 7, D-018).

No raw scanned-document text with entity positions exists anywhere in this
project's data - IndianBailJudgments-1200's JSON has structured fields
(court, date, ipc_sections, case_title), not page images with annotated
spans. Two honest choices had to be made before any training could start:

1. Training text is SYNTHETICALLY ASSEMBLED per record: a judgment-shaped
   header (court / parties / date / IPC sections) built from the known
   structured fields, followed by the real `facts` body. This mirrors the
   header shape every real Indian judgment actually has (and matches the
   Phase 3 /scan/extract fixture's shape), but it is not genuine OCR output.
   Disclosed plainly in the model card - the real test of this pipeline is
   Phase 9, against actual OCR'd text from the corpus's 1,200 source PDFs.

2. "Gold" labels are DISTANT SUPERVISION, not hand-annotated: a known-correct
   field value (e.g. the real court name) is located inside the synthetic
   text by substring search, and that span becomes the training/eval label.
   This is standard distant supervision, but it is not the same rigor as a
   human reading the text and marking spans - stated as a limitation, not
   hidden behind an F1 number that looks hand-verified.

The regex "baseline" is NOT the same values looked up again (that would
trivially score 100% and prove nothing) - it is a genuinely blind extractor
using only positional/format heuristics on the raw text (first line is
probably the court, "X vs Y" splits into two parties, DD.MM.YYYY is a date,
digits after "Sections:" are IPC sections), with no access to the known
field values at all. Both the regex baseline and the trained spaCy model are
scored against the same distant-supervision gold labels.

case_number is NOT trained as an NER label at all: this corpus's case_id is
a bare sequence number ("0001"), never a real citation string, so there is
no ground truth to train or evaluate a case-number extractor against. It
stays a pure regex extraction at serving time, undisclosed-quality, flagged
in the model card rather than faked with an invented citation format that
would only teach the model one made-up pattern.
"""
from __future__ import annotations

import json
import random
import re
from datetime import datetime, timezone
from pathlib import Path

import spacy
from spacy.tokens import DocBin
from spacy.training import Example
from spacy.scorer import Scorer

ML_ROOT = Path(__file__).resolve().parents[2]
REPO_ROOT = ML_ROOT.parent
DATA_PATH = ML_ROOT / "data" / "bail" / "raw.json"
ARTIFACTS_DIR = REPO_ROOT / "backend" / "artifacts" / "ner"
REPORTS_DIR = ML_ROOT / "reports"

RANDOM_STATE = 42
LABELS = ["COURT", "PARTY", "DATE", "IPC_SECTION"]


def indian_date(iso: str) -> str:
    dt = datetime.strptime(iso, "%Y-%m-%d")
    return dt.strftime("%d.%m.%Y")


def build_document(record: dict) -> tuple[str, list[tuple[int, int, str]]]:
    """Synthetic judgment-shaped text + distant-supervision gold spans."""
    parties = re.split(r"\s+vs\.?\s+", record["case_title"], flags=re.IGNORECASE, maxsplit=1)
    party1 = parties[0].strip()
    party2 = parties[1].strip() if len(parties) > 1 else ""

    date_str = indian_date(record["date"])
    sections = record.get("ipc_sections") or []
    sections_line = ", ".join(sections) if sections else "Not specified"

    court_line = record["court"]
    parties_line = f"{party1} vs {party2}" if party2 else party1
    date_line = f"Date of Judgment: {date_str}"
    sections_line_full = f"Sections: {sections_line}, IPC"
    header = f"{court_line}\n{parties_line}\n{date_line}\n{sections_line_full}\n\n"
    text = header + record.get("facts", "")

    spans: list[tuple[int, int, str]] = []

    def add_span(needle: str, label: str, search_from: int = 0, search_to: int | None = None) -> None:
        if not needle:
            return
        hay = text if search_to is None else text[:search_to]
        idx = hay.find(needle, search_from)
        if idx != -1:
            spans.append((idx, idx + len(needle), label))

    header_end = len(header)
    add_span(court_line, "COURT", 0, header_end)
    add_span(party1, "PARTY", 0, header_end)
    if party2:
        add_span(party2, "PARTY", 0, header_end)
    add_span(date_str, "DATE", 0, header_end)
    for s in sections:
        add_span(s, "IPC_SECTION", 0, header_end)

    return text, spans


# ---- Regex baseline: blind extraction, no access to known field values ----

COURT_RE = re.compile(r"^(.+)$", re.MULTILINE)
PARTY_SPLIT_RE = re.compile(r"\s+vs\.?\s+", re.IGNORECASE)
DATE_RE = re.compile(r"\b\d{2}\.\d{2}\.\d{4}\b")
SECTIONS_LINE_RE = re.compile(r"Sections?:\s*([^\n]+)", re.IGNORECASE)
SECTION_TOKEN_RE = re.compile(r"\b\d{1,3}[A-Z]?\b")


def regex_extract(text: str) -> list[tuple[int, int, str]]:
    spans = _regex_extract_raw(text)
    return dedupe_overlaps(spans)


def _regex_extract_raw(text: str) -> list[tuple[int, int, str]]:
    spans: list[tuple[int, int, str]] = []
    lines = text.split("\n")

    # Heuristic: the court name is the first non-empty line - a genuine
    # positional convention in Indian judgments, not a lookup.
    if lines and lines[0].strip():
        spans.append((0, len(lines[0]), "COURT"))

    # Heuristic: line 2 is "party vs party".
    if len(lines) > 1 and PARTY_SPLIT_RE.search(lines[1]):
        line_start = len(lines[0]) + 1
        parts = PARTY_SPLIT_RE.split(lines[1])
        cursor = line_start
        for i, part in enumerate(parts):
            part_stripped = part.strip()
            if part_stripped:
                start = text.find(part_stripped, cursor)
                if start != -1:
                    spans.append((start, start + len(part_stripped), "PARTY"))
                    cursor = start + len(part_stripped)

    for m in DATE_RE.finditer(text):
        spans.append((m.start(), m.end(), "DATE"))

    sec_match = SECTIONS_LINE_RE.search(text)
    if sec_match:
        line_text = sec_match.group(1)
        line_start = sec_match.start(1)
        for tok in SECTION_TOKEN_RE.finditer(line_text):
            spans.append((line_start + tok.start(), line_start + tok.end(), "IPC_SECTION"))

    return spans


def dedupe_overlaps(spans: list[tuple[int, int, str]]) -> list[tuple[int, int, str]]:
    """Greedily keep non-overlapping spans, longest first - a short spurious
    substring match (e.g. a section number occurring inside a date) must not
    block a legitimate longer span from the same character range."""
    ordered = sorted(spans, key=lambda s: (s[1] - s[0]), reverse=True)
    kept: list[tuple[int, int, str]] = []
    occupied: list[tuple[int, int]] = []
    for start, end, label in ordered:
        if any(start < o_end and end > o_start for o_start, o_end in occupied):
            continue
        kept.append((start, end, label))
        occupied.append((start, end))
    return sorted(kept, key=lambda s: s[0])


def spans_to_scorer_input(nlp, text: str, spans: list[tuple[int, int, str]]):
    doc = nlp.make_doc(text)
    ents = []
    for start, end, label in dedupe_overlaps(spans):
        span = doc.char_span(start, end, label=label, alignment_mode="expand")
        if span is not None:
            ents.append(span)
    # Overlaps can also survive dedup after char_span's alignment_mode="expand"
    # widens a span to token boundaries - filter again on the resulting Span
    # objects, which is what set_ents actually validates against.
    ents = sorted(ents, key=lambda s: (s.end_char - s.start_char), reverse=True)
    final: list = []
    occupied_tok: list[tuple[int, int]] = []
    for span in ents:
        if any(span.start < o_end and span.end > o_start for o_start, o_end in occupied_tok):
            continue
        final.append(span)
        occupied_tok.append((span.start, span.end))
    doc.set_ents(sorted(final, key=lambda s: s.start_char), default="outside")
    return doc


def score_spans(nlp, predicted_by_doc: list[list[tuple[int, int, str]]], gold_docs: list, texts: list[str]) -> dict:
    examples = []
    for text, gold_doc, pred_spans in zip(texts, gold_docs, predicted_by_doc):
        pred_doc = spans_to_scorer_input(nlp, text, pred_spans)
        examples.append(Example(pred_doc, gold_doc))
    scores = Scorer().score(examples)
    return scores


def main() -> None:
    ARTIFACTS_DIR.mkdir(parents=True, exist_ok=True)
    REPORTS_DIR.mkdir(parents=True, exist_ok=True)

    records = json.loads(DATA_PATH.read_text(encoding="utf-8"))
    random.Random(RANDOM_STATE).shuffle(records)

    docs = [build_document(r) for r in records]
    texts = [t for t, _ in docs]
    gold_spans = [s for _, s in docs]

    n_test = int(len(docs) * 0.2)
    train_texts, test_texts = texts[n_test:], texts[:n_test]
    train_spans, test_spans = gold_spans[n_test:], gold_spans[:n_test]
    print(f"Train: {len(train_texts)}  Test: {len(test_texts)}")

    nlp = spacy.blank("en")
    ner = nlp.add_pipe("ner")
    for label in LABELS:
        ner.add_label(label)

    gold_docs_test = [spans_to_scorer_input(nlp, t, s) for t, s in zip(test_texts, test_spans)]

    # ---- Baseline: blind regex extraction, scored on the test split -------
    baseline_preds = [regex_extract(t) for t in test_texts]
    baseline_scores = score_spans(nlp, baseline_preds, gold_docs_test, test_texts)
    print("Baseline (regex) per-entity F1:", {k: v for k, v in baseline_scores.items() if "ents_per_type" in k})

    # ---- Final: train spaCy NER -------------------------------------------
    train_examples = []
    for text, spans in zip(train_texts, train_spans):
        doc = nlp.make_doc(text)
        example = Example.from_dict(doc, {"entities": dedupe_overlaps(spans)})
        train_examples.append(example)

    optimizer = nlp.initialize(lambda: train_examples)
    n_epochs = 15
    for epoch in range(n_epochs):
        random.Random(RANDOM_STATE + epoch).shuffle(train_examples)
        losses: dict = {}
        for i in range(0, len(train_examples), 32):
            batch = train_examples[i : i + 32]
            nlp.update(batch, sgd=optimizer, losses=losses, drop=0.2)
        print(f"Epoch {epoch + 1}/{n_epochs}  loss={losses.get('ner', 0):.2f}")

    final_preds = []
    for text in test_texts:
        doc = nlp(text)
        final_preds.append([(e.start_char, e.end_char, e.label_) for e in doc.ents])
    final_scores = score_spans(nlp, final_preds, gold_docs_test, test_texts)
    print("Final (spaCy) per-entity F1:", {k: v for k, v in final_scores.items() if "ents_per_type" in k})

    # ---- Persist ------------------------------------------------------------
    nlp.to_disk(ARTIFACTS_DIR / "spacy_model")
    print(f"Model written to {ARTIFACTS_DIR / 'spacy_model'}")

    def per_entity_points(scores: dict) -> list[dict]:
        points = [{"metric_name": "entity_f1", "value": round(scores.get("ents_f", 0.0) or 0.0, 4)}]
        per_type = scores.get("ents_per_type") or {}
        for label in LABELS:
            f1 = (per_type.get(label) or {}).get("f", 0.0) or 0.0
            points.append({"metric_name": f"entity_f1_{label.lower()}", "value": round(f1, 4)})
        return points

    baseline_points = per_entity_points(baseline_scores)
    final_points = per_entity_points(final_scores)

    report = {
        "baseline": baseline_points,
        "final": final_points,
        "calibration_points": None,
        "fairness": None,
        "dataset_size": len(records),
        "last_trained": datetime.now(timezone.utc).isoformat(),
    }
    (REPORTS_DIR / "ner.json").write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"Report written to {REPORTS_DIR / 'ner.json'}")


if __name__ == "__main__":
    main()
