"""
POST /scan/extract. Multipart image upload, standalone - never auto-runs
summarization (ARCHITECTURE.md section 2.1, section 4.4).

Phase 9: real OCR (Tesseract via pytesseract) + real NER (spaCy). See
app/models/ner.py's docstring for the honest, disclosed gap between this
model's rigid synthetic training text and real scanned-document OCR output -
this endpoint is the first place that gap actually shows up in the running
app, not just in a model card. Upload is capped on size and MIME type
(SECURITY.md section 2).
"""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.models import ner as ner_model
from app.models import ocr as ocr_model
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.scan import ScanEntities, ScanExtractResponse

router = APIRouter(tags=["scan"])

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/scan/extract", response_model=Envelope[ScanExtractResponse])
async def scan_extract(file: UploadFile = File(...)) -> Envelope[ScanExtractResponse]:
    with Timer() as t:
        if file.content_type not in ALLOWED_CONTENT_TYPES:
            raise HTTPException(status_code=415, detail="unsupported_media_type")

        body = await file.read()
        if len(body) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail="file_too_large")
        if len(body) == 0:
            raise HTTPException(status_code=422, detail="empty_file")

        try:
            raw_text, word_spans, ocr_confidence = ocr_model.extract_text(body)
        except Exception as exc:  # e.g. an unreadable/corrupt image Pillow can't open
            raise HTTPException(status_code=422, detail="unreadable_image") from exc

        extraction = ner_model.extract_entities(raw_text, word_spans)

        data = ScanExtractResponse(
            raw_text=raw_text,
            ocr_confidence=ocr_confidence,
            entities=ScanEntities(**extraction["entities"]),
            field_confidence=extraction["field_confidence"],
        )
    return ok(data, t.ms)
