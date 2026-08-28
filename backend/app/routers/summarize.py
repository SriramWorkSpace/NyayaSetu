"""POST /summarize. A second, explicit step - never auto-triggered by scan."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.fixtures import summarize_case
from app.latency import simulate
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.summarize import SummarizeRequest, SummarizeResponse

router = APIRouter(tags=["summarize"])


@router.post("/summarize", response_model=Envelope[SummarizeResponse])
async def summarize(payload: SummarizeRequest) -> Envelope[SummarizeResponse]:
    with Timer() as t:
        await simulate("summarize")
        if payload.text == "__error__" or payload.case_id == "__error__":
            raise HTTPException(status_code=503, detail="model_unavailable")
        data = SummarizeResponse(**summarize_case("example"))
        data.summary_sentences = data.summary_sentences[: payload.max_sentences]
    return ok(data, t.ms)
