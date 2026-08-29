"""
POST /qa/extract. Extractive only: the response is always a span inside the
source judgment, never generated text (decisions.md D-008).

Phase 9: real model call. Documents in the retrieval corpus average 8.2
chunks (~2,900 words) - the fine-tuned QA model's 384-token window can only
ever see one ~350-word chunk at a time. The chunk most relevant to the
question is located first (app/models/retrieval.find_relevant_chunk) - the
"TF-IDF retrieval" step ARCHITECTURE.md section 7 names as part of the QA
approach, here doing real work rather than being purely a training-time
baseline - and the span-extraction offsets are mapped back to full-document
character positions before returning, so the frontend's highlight-in-place
UI can scroll to the right place in the FULL text it is displaying, not
just the chunk.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import qa as qa_model
from app.models import retrieval as retrieval_model
from app.schemas.envelope import Envelope, Timer, ok
from app.schemas.qa import QaExtractRequest, QaExtractResponse

router = APIRouter(tags=["qa"])


@router.post("/qa/extract", response_model=Envelope[QaExtractResponse])
async def qa_extract(payload: QaExtractRequest) -> Envelope[QaExtractResponse]:
    with Timer() as t:
        located = retrieval_model.find_relevant_chunk(payload.case_id, payload.question)
        if located is None:
            raise HTTPException(status_code=404, detail="case_not_found")
        chunk_text, chunk_offset = located

        result = qa_model.extract(chunk_text, payload.question)
        data = QaExtractResponse(
            answer_span=result["answer_span"],
            char_start=result["char_start"] + chunk_offset,
            char_end=result["char_end"] + chunk_offset,
            score=result["score"],
        )
    return ok(data, t.ms)
