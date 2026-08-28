"""
POST /qa/extract. Extractive only: the response is always a span inside the
source judgment, never generated text (decisions.md D-008).

Stub trigger: question == "__error__" raises for building the error state.
When case_id resolves to a known case fixture, the span is located inside
that case's actual full_text so the frontend's highlight-in-place UI has
real coordinates to scroll to, not numbers pointing at nothing.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.fixtures import case_detail, qa_case
from app.latency import simulate
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.qa import QaExtractRequest, QaExtractResponse

router = APIRouter(tags=["qa"])

# The sentence each known case answers most questions with, for the stub.
_ANSWER_SENTENCE_INDEX = {"case_0412": 8, "case_0198": 7}


def _answer_from_case(case_id: str) -> QaExtractResponse | None:
    case = case_detail(case_id)
    if case is None:
        return None
    text = case["full_text"]
    sentences = text.split("\n\n")
    idx = _ANSWER_SENTENCE_INDEX.get(case_id, len(sentences) - 1)
    idx = min(idx, len(sentences) - 1)
    span = sentences[idx].strip()
    start = text.index(span)
    return QaExtractResponse(answer_span=span, char_start=start, char_end=start + len(span), score=0.87)


@router.post("/qa/extract", response_model=Envelope[QaExtractResponse])
async def qa_extract(payload: QaExtractRequest) -> Envelope[QaExtractResponse]:
    with Timer() as t:
        await simulate("qa")
        if payload.question == "__error__":
            raise HTTPException(status_code=503, detail="model_unavailable")

        located = _answer_from_case(payload.case_id)
        if located is not None:
            data = located
        else:
            key = "low_confidence" if "?" not in payload.question else "example"
            data = QaExtractResponse(**qa_case(key))
    return ok(data, t.ms)
