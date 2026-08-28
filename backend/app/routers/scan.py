"""
POST /scan/extract. Multipart image upload, standalone - never auto-runs
summarization (ARCHITECTURE.md section 2.1, section 4.4).

Stub trigger: a filename containing "lowquality" returns the low-quality OCR
fixture. Upload is capped on size and MIME type (SECURITY.md section 2).
"""
from __future__ import annotations

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.fixtures import scan_case
from app.latency import simulate
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.scan import ScanExtractResponse

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

        await simulate("scan")
        key = "low_quality" if "lowquality" in (file.filename or "") else "clean"
        data = ScanExtractResponse(**scan_case(key))
    return ok(data, t.ms)
