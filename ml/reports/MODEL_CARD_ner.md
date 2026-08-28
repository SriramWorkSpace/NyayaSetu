# Model card — Document NER

**Module:** `ner` · **Version:** Phase 7, regex baseline → spaCy NER (decisions.md D-018: spaCy chosen without a blocking benchmark against InLegalBERT token classification).

## Data — and the two honest choices that shaped it

No raw scanned-document text with entity positions exists anywhere available to this project. IndianBailJudgments-1200's JSON has structured fields (`court`, `date`, `ipc_sections`, `case_title`), not page images with hand-annotated spans, and no NER-labeled Indian legal corpus was found that matches this exact entity set (case number, court, parties, IPC sections, dates).

**1. Training text is synthetically assembled**, not real OCR output: a judgment-shaped header (court / parties / date / IPC sections, in that order — the layout every real Indian judgment actually has, matching the Phase 3 `/scan/extract` fixture's shape) built from IndianBailJudgments-1200's known structured fields, followed by the real `facts` text as the body. **This is disclosed, not hidden**, and it directly explains the result below.

**2. Labels are distant supervision, not hand-annotated**: a known-correct field value (the real court name, the real IPC sections, etc.) is located inside the synthetic text by substring search, and that span becomes the label. Standard technique, but not the rigor of a human marking spans on a real document.

`case_number` is **not** trained as an entity at all. This corpus's `case_id` is a bare sequence number ("0001"), never a real citation string — there is no ground truth to train or evaluate against. It stays a pure regex extraction at serving time (Phase 9), of undisclosed quality until tested against real documents, rather than trained against an invented citation format that would only teach the model one made-up pattern.

## The baseline is not meaningfully "blind" here — and that is the finding

The regex baseline was designed to use only positional/format heuristics on raw text (first line is the court, "X vs Y" splits into two parties, `DD.MM.YYYY` is a date, digits after "Sections:" are IPC sections) with **no lookup of the known field values** — a genuine attempt at a fair comparison, not the same values found twice.

It still scored near-perfectly:

| Entity | Baseline (regex) F1 | Final (spaCy) F1 |
|---|---|---|
| COURT | 1.000 | 1.000 |
| PARTY | 1.000 | 1.000 |
| DATE | 0.952 | 1.000 |
| IPC_SECTION | 0.960 | 0.995 |
| **Overall** | **0.974** | **0.998** |

**This is not evidence that the task is solved.** It is evidence that the synthetic header's format is rigid enough — every document has exactly the same field order, on exactly the same lines — that a positional heuristic finds it perfectly, every time. Real scanned judgments vary in header layout across courts, decades, and OCR quality; nothing here has tested that variability. **The honest reading of this table is: it validates the training pipeline works end to end (labels build correctly, spaCy trains and improves on IPC_SECTION, the one entity type with any real positional ambiguity), not that document NER is a solved problem for this product.**

## What Phase 9 needs to actually test this

Real performance can only be measured against real OCR'd text from IndianBailJudgments-1200's 1,200 source PDFs (bundled with the dataset for exactly this purpose). That requires Tesseract wired in (CLAUDE.md's repeatable actions) and, ideally, a small hand-labeled validation sample — not more synthetic text, which this model card's own finding shows will just re-confirm the rigid-template ceiling rather than reveal anything new.

## Evaluation

Held-out test split (240 of 1,200 documents), scored with spaCy's `Scorer` (exact span-boundary + label match). `dataset_size: 1200`. OCR CER (ARCHITECTURE.md section 7's "per-entity F1 + OCR CER, separate") is not yet measured — no OCR has been run in this phase; it is a Phase 9 number, not a null placeholder pretending to be one.

## Limitations

1. Trained and evaluated entirely on synthetic document assembly, not real scanned text — the near-perfect scores above should not be read as production performance.
2. Distant-supervision labels, not hand-verified spans.
3. `case_number` has no trained model at all; regex-only at serving time, untested against real citation format variety.
4. Small, single-domain source corpus (bail judgments only) — generalization to non-bail judgment types is untested.
