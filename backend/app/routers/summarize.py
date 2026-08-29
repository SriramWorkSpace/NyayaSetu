"""
POST /summarize. A second, explicit step - never auto-triggered by scan
(ARCHITECTURE.md section 2.1). Phase 9: real model call, on either raw text
(e.g. OCR output from /scan/extract) or a case_id resolved against the
retrieval corpus.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import retrieval as retrieval_model
from app.models import summarization as summarization_model
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.summarize import SummarizeRequest, SummarizeResponse

router = APIRouter(tags=["summarize"])


@router.post("/summarize", response_model=Envelope[SummarizeResponse])
async def summarize(payload: SummarizeRequest) -> Envelope[SummarizeResponse]:
    with Timer() as t:
        if payload.case_id:
            text = retrieval_model.get_case_text(payload.case_id)
            if text is None:
                raise HTTPException(status_code=404, detail="case_not_found")
        else:
            # SummarizeRequest's validator already guarantees exactly one of
            # text/case_id is set - if case_id was falsy, text must be truthy.
            assert payload.text is not None
            text = payload.text

        result = summarization_model.summarize(text, payload.max_sentences)
        data = SummarizeResponse(**result)
    return ok(data, t.ms)
