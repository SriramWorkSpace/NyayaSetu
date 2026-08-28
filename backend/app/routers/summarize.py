"""POST /summarize. A second, explicit step - never auto-triggered by scan."""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.fixtures import case_detail, summarize_case
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

        case = case_detail(payload.case_id) if payload.case_id else None
        if case is not None:
            data = SummarizeResponse(
                summary_sentences=case["summary_sentences"],
                source_indices=case["source_indices"],
                compression_ratio=round(len(" ".join(case["summary_sentences"])) / max(1, len(case["full_text"])), 2),
            )
        else:
            data = SummarizeResponse(**summarize_case("example"))
        data.summary_sentences = data.summary_sentences[: payload.max_sentences]
    return ok(data, t.ms)
