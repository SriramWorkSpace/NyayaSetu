"""
GET /case/{case_id}. Additive to the section 6 contract - see decisions.md
D-013. Phase 9: case_id resolves against the retrieval corpus's doc_ids -
every case_id a real user can ever reach comes from a /search/precedent
result (see app/models/retrieval.py's docstring for why there is no second,
separate case corpus to resolve against). The extractive summary is
computed live via the summarizer model, not pre-baked - this corpus was
never summarized ahead of time the way the old fixture's two hand-picked
cases were.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException

from app.models import retrieval as retrieval_model
from app.models import summarization as summarization_model
from app.schemas.case import CaseDetail
from app.schemas.envelope import Envelope, Timer, ok

router = APIRouter(tags=["case"])

CASE_DETAIL_SUMMARY_SENTENCES = 3


@router.get("/case/{case_id}", response_model=Envelope[CaseDetail])
async def get_case(case_id: str) -> Envelope[CaseDetail]:
    with Timer() as t:
        summary = retrieval_model.get_case_summary(case_id)
        if summary is None:
            raise HTTPException(status_code=404, detail="case_not_found")

        extractive = summarization_model.summarize(summary["full_text"], CASE_DETAIL_SUMMARY_SENTENCES)

        data = CaseDetail(
            case_id=summary["case_id"],
            title=summary["title"],
            court=summary["court"],
            year=summary["year"],
            case_number=summary["case_number"],
            ipc_sections=[],  # not extracted for retrieval-corpus documents; NER runs on scanned images, not this corpus
            full_text=summary["full_text"],
            summary_sentences=extractive["summary_sentences"],
            source_indices=extractive["source_indices"],
        )
    return ok(data, t.ms)
