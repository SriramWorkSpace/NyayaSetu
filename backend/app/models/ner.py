"""
Document NER singleton, serving the trained spaCy model
(ml/src/train/train_ner.py) plus a standalone case-number regex.

--- The real gap between this model's training and its serving conditions ---

The model was trained on SYNTHETICALLY assembled, rigidly-formatted text
(court on line 1, "party vs party" on line 2, a fixed date/sections header) -
there is no raw scanned-judgment text with entity positions anywhere in this
project's data to train on instead (ml/reports/MODEL_CARD_ner.md). Real
OCR'd text from an actual photographed document will not have that rigid
structure, and decisions.md D-024 already found the model's near-perfect
training-time scores are a synthetic-template artifact, not evidence the
task is solved. This is the first time the model sees real OCR output;
expect materially worse performance than the reported metrics, and this is
stated here deliberately, not discovered by a user first.

case_number was never trained as an entity at all (no real citation-format
ground truth exists in the source corpus) - it stays a standalone regex
here, undisclosed-quality, exactly as the model card states.

--- Field confidence: what it actually measures ---

spaCy's default transition-based EntityRecognizer exposes no per-span
confidence score through its standard API (checked directly - `Span`
objects have no `.score` attribute). Rather than fabricate one, field
confidence here measures something real and computable instead: the mean
Tesseract word-level OCR confidence for the text underneath each extracted
span. A field the model found nothing for gets confidence 0 (a genuine
extraction miss); a field it did find is only as trustworthy as the OCR
that produced its underlying characters. This does not distinguish "OCR was
fine but the model mislabeled it" from "OCR was fine and the model got it
right" - that distinction would need per-span model confidence, which does
not exist here - but it is an honest, real signal, not a placeholder
pretending to be something spaCy cannot provide.
"""
from __future__ import annotations

import logging
import re
import time
from pathlib import Path

import spacy

logger = logging.getLogger("nyayasetu.models.ner")

ARTIFACTS_DIR = Path(__file__).resolve().parents[2] / "artifacts" / "ner" / "spacy_model"

# Generic Indian legal citation shapes: "Crl.A. No. 1274/2019", "W.P.(C) 5678/2019",
# "Bail Appln. 910/2021", "SLP(Crl) No. 123/2020" - undisclosed-quality regex,
# never trained/evaluated against real ground truth (see module docstring).
CASE_NUMBER_RE = re.compile(
    r"\b[A-Za-z]{1,6}(?:\.[A-Za-z]{1,6})*\s*(?:\([A-Za-z]{1,6}\))?\s*(?:No\.?)?\s*\d{1,6}\s*(?:of|/)\s*\d{4}\b",
    re.IGNORECASE,
)

_state: dict = {}


def load() -> None:
    t0 = time.perf_counter()
    _state["nlp"] = spacy.load(ARTIFACTS_DIR)
    logger.info("NER model loaded in %.2fs", time.perf_counter() - t0)


def _word_confidence_for_span(start: int, end: int, word_spans: list[tuple[int, int, float]]) -> float:
    overlapping = [conf for w_start, w_end, conf in word_spans if w_start < end and w_end > start and conf >= 0]
    return round(sum(overlapping) / len(overlapping) / 100, 4) if overlapping else 0.0


def extract_entities(raw_text: str, word_spans: list[tuple[int, int, float]]) -> dict:
    """
    word_spans: (char_start, char_end, tesseract_confidence_0_to_100) for
    each OCR'd word in raw_text, in the same order/positions the text was
    assembled in (see app/models/ocr.py).
    """
    doc = _state["nlp"](raw_text)

    entities: dict[str, list] = {"COURT": [], "PARTY": [], "DATE": [], "IPC_SECTION": []}
    for ent in doc.ents:
        if ent.label_ in entities:
            entities[ent.label_].append(ent.text.strip())

    case_number_match = CASE_NUMBER_RE.search(raw_text)
    case_number = case_number_match.group(0).strip() if case_number_match else None

    court = entities["COURT"][0] if entities["COURT"] else None
    court_conf = 0.0
    if court:
        idx = raw_text.find(court)
        court_conf = _word_confidence_for_span(idx, idx + len(court), word_spans)

    parties_conf = 0.0
    if entities["PARTY"]:
        confs = []
        for p in entities["PARTY"]:
            idx = raw_text.find(p)
            if idx != -1:
                confs.append(_word_confidence_for_span(idx, idx + len(p), word_spans))
        parties_conf = round(sum(confs) / len(confs), 4) if confs else 0.0

    dates_conf = 0.0
    if entities["DATE"]:
        confs = []
        for d in entities["DATE"]:
            idx = raw_text.find(d)
            if idx != -1:
                confs.append(_word_confidence_for_span(idx, idx + len(d), word_spans))
        dates_conf = round(sum(confs) / len(confs), 4) if confs else 0.0

    sections_conf = 0.0
    if entities["IPC_SECTION"]:
        confs = []
        for s in entities["IPC_SECTION"]:
            idx = raw_text.find(s)
            if idx != -1:
                confs.append(_word_confidence_for_span(idx, idx + len(s), word_spans))
        sections_conf = round(sum(confs) / len(confs), 4) if confs else 0.0

    case_number_conf = 0.0
    if case_number_match:
        case_number_conf = _word_confidence_for_span(case_number_match.start(), case_number_match.end(), word_spans)

    return {
        "entities": {
            "case_number": case_number,
            "court": court,
            "parties": entities["PARTY"],
            "ipc_sections": entities["IPC_SECTION"],
            "dates": entities["DATE"],
        },
        "field_confidence": {
            "case_number": case_number_conf,
            "court": court_conf,
            "parties": parties_conf,
            "ipc_sections": sections_conf,
            "dates": dates_conf,
        },
    }
