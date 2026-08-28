"""
POST /qa/extract. Extractive only: the response is always a span inside the
source judgment, never generated text (decisions.md D-008).

Stub trigger: question == "__error__" raises for building the error state.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.fixtures import qa_case
from app.latency import simulate
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.qa import QaExtractRequest, QaExtractResponse

router = APIRouter(tags=["qa"])


@router.post("/qa/extract", response_model=Envelope[QaExtractResponse])
async def qa_extract(payload: QaExtractRequest) -> Envelope[QaExtractResponse]:
    with Timer() as t:
        await simulate("qa")
        if payload.question == "__error__":
            raise HTTPException(status_code=503, detail="model_unavailable")
        key = "low_confidence" if "?" not in payload.question else "example"
        data = QaExtractResponse(**qa_case(key))
    return ok(data, t.ms)
