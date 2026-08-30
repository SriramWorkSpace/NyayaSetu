"""
OCR wrapper around the Tesseract binary (CLAUDE.md section 2: Tesseract via
pytesseract). No "model" to load at startup in the singleton sense - this
just configures pytesseract to find the Windows binary explicitly, rather
than depending on PATH (winget installs do not reliably update the PATH a
running process inherited before install - checked directly, not assumed:
`tesseract --version` failed on PATH immediately after this session's own
winget install, even though the binary was present).

Reconstructs `raw_text` preserving line breaks (Tesseract's own line_num
grouping) rather than joining every word with a single space - the NER
model was trained on a rigidly line-structured synthetic header (court /
parties / date / sections, one per line, ml/reports/MODEL_CARD_ner.md), so
preserving real line structure gives it the best chance of matching that
shape when the scanned document happens to follow a similar convention.

Returns word_spans (char_start, char_end, confidence) alongside raw_text so
app/models/ner.py can compute field-level confidence from real per-word OCR
scores - see that module's docstring for why this, not a fabricated NER
confidence, is what "field_confidence" actually measures.
"""
from __future__ import annotations

import io
import sys
from pathlib import Path

import pytesseract
from PIL import Image


def _resolve_tesseract_cmd() -> str:
    """
    A packaged install has no system Tesseract to find - PyInstaller bundles
    a trimmed copy (backend/vendor/tesseract/) as a sidecar resource instead.
    `sys._MEIPASS` is the bundle's own runtime directory when frozen (set by
    PyInstaller, not a normal Python attribute - checked via getattr rather
    than assumed present).

    Preferring the vendored copy in dev too (when present) means local
    testing already exercises the exact binary + tessdata pairing that ships,
    rather than only ever testing the full system install and finding out
    about a missing bundled DLL for the first time in the packaged app.
    """
    if getattr(sys, "frozen", False):
        bundled = Path(sys._MEIPASS) / "vendor" / "tesseract" / "tesseract.exe"  # type: ignore[attr-defined]
    else:
        bundled = Path(__file__).resolve().parents[2] / "vendor" / "tesseract" / "tesseract.exe"
    if bundled.exists():
        return str(bundled)
    return r"C:\Program Files\Tesseract-OCR\tesseract.exe"


pytesseract.pytesseract.tesseract_cmd = _resolve_tesseract_cmd()


def extract_text(image_bytes: bytes) -> tuple[str, list[tuple[int, int, float]], float]:
    """Returns (raw_text, word_spans, overall_ocr_confidence_0_to_1)."""
    image = Image.open(io.BytesIO(image_bytes))
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)

    # Group recognized words into lines using Tesseract's own line grouping
    # (block/paragraph/line numbers) - conf < 0 marks non-text container
    # rows (page/block/par levels), not real words, and is skipped.
    lines: list[list[tuple[str, float]]] = []
    current_line_key = None
    for text, conf, block, par, line in zip(
        data["text"], data["conf"], data["block_num"], data["par_num"], data["line_num"]
    ):
        if not text.strip() or conf < 0:
            continue
        line_key = (block, par, line)
        if line_key != current_line_key:
            lines.append([])
            current_line_key = line_key
        lines[-1].append((text, float(conf)))

    raw_text = "\n".join(" ".join(word for word, _ in line) for line in lines)

    # Recompute each word's character span against the exact final string -
    # simpler and unambiguous than tracking an incremental cursor through a
    # join with two different separators (space within a line, newline
    # between lines).
    word_spans: list[tuple[int, int, float]] = []
    cursor = 0
    all_confidences: list[float] = []
    for line in lines:
        for word, conf in line:
            idx = raw_text.index(word, cursor)
            word_spans.append((idx, idx + len(word), conf))
            cursor = idx + len(word)
            all_confidences.append(conf)

    overall_confidence = round((sum(all_confidences) / len(all_confidences)) / 100, 4) if all_confidences else 0.0
    return raw_text, word_spans, overall_confidence
